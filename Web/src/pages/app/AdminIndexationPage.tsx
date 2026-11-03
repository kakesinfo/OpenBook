import { WrapperHeader } from "../../components/Wrapper/Wrapper.tsx";
import { useState, useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faRotate,
    faCheck,
    faClock,
    faBookOpen,
    faBolt,
    faLayerGroup,
    faServer,
    faTriangleExclamation,
    faStop
} from "@fortawesome/free-solid-svg-icons";
import useSession from "../../hooks/UseSession.tsx";
import useLanguage from "../../hooks/UseLanguage.tsx";
import "./AdminPage.scss";

export interface ScraperSource {
    id: string;
    name: string;
    desc: string;
    color: string;
    enabled: boolean;
}

interface JobHistory {
    start_time: string;
    source: string;
    total_scraped: number;
    total_saved: number;
    status: string;
}

export interface LiveScanStatus {
    is_running: boolean;
    job_name?: string | null;
    current_source?: string | null;
    current_source_name?: string | null;
    current_source_color?: string | null;
    current_step?: string | null;
    total_found: number;
    total_saved: number;
    started_at?: string | null;
    ended_at?: string | null;
    last_error?: string | null;
}

interface ScraperStatus {
    is_running: boolean;
    current_job: string | null;
    last_run: string | null;
    last_status: string;
    sources?: ScraperSource[];
    available_sources?: string[];
    disabled_sources?: string[];
    enabled_sources?: string[];
    connected?: boolean;
    schedule?: {
        daily_at: string;
        scrape_on_startup: boolean;
    };
    recent_history?: JobHistory[];
    live_scan?: LiveScanStatus;
}

export default function AdminIndexationPage() {
    const session = useSession();
    const { tr } = useLanguage();
    const [status, setStatus] = useState<ScraperStatus | null>(null);
    const [sources, setSources] = useState<ScraperSource[]>([]);
    const [loading, setLoading] = useState(false);
    const [triggerMessage, setTriggerMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [totalBooks, setTotalBooks] = useState<number>(0);

    // Multiple selection of sources (only active sources can be selected)
    const [selectedSources, setSelectedSources] = useState<string[]>([]);
    const headerCheckboxRef = useRef<HTMLInputElement>(null);

    // Active sources derived from backend data
    const activeSources = sources.filter((s) => s.enabled);
    const activeCount = activeSources.length;

    // Sort: active scrapers first, inactive scrapers sorted at the bottom
    const sortedSources = [...sources].sort((a, b) => {
        if (a.enabled === b.enabled) return 0;
        return a.enabled ? -1 : 1;
    });

    // Checkbox select all state
    const allActiveSelected = activeCount > 0 && activeSources.every((s) => selectedSources.includes(s.id));
    const isIndeterminate = selectedSources.length > 0 && !allActiveSelected;

    useEffect(() => {
        if (headerCheckboxRef.current) {
            headerCheckboxRef.current.indeterminate = isIndeterminate;
        }
    }, [isIndeterminate]);

    const fetchStatus = async () => {
        try {
            const resp = await session.customFetch("/admin/scrapers/status", { method: "GET" });
            if (resp.ok) {
                const data: ScraperStatus = await resp.json();
                setStatus(data);

                if (Array.isArray(data.sources)) {
                    setSources(data.sources);
                    // Filter out any selected source that became disabled
                    setSelectedSources((prev) =>
                        prev.filter((id) => data.sources?.find((s) => s.id === id)?.enabled)
                    );
                }
            } else {
            }
        } catch {
        }
    };

    const fetchTotalBooks = async () => {
        try {
            const response = await session.customFetch("/books", { method: "GET" });
            if (response.ok) {
                const data = await response.json();
                setTotalBooks(Array.isArray(data) ? data.length : 0);
            }
        } catch (err) {
            console.error("Admin fetch total books error:", err);
        }
    };

    // Initial load
    useEffect(() => {
        fetchStatus();
        fetchTotalBooks();
    }, [session]);

    // Adaptive polling: 1 second during active scan for real-time live updates, 5 seconds when idle
    useEffect(() => {
        const intervalMs = status?.is_running ? 1000 : 5000;
        const interval = setInterval(() => {
            fetchStatus();
            if (status?.is_running) {
                fetchTotalBooks();
            }
        }, intervalMs);
        return () => clearInterval(interval);
    }, [status?.is_running]);

    const handleToggleSelect = (sourceId: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const src = sources.find((s) => s.id === sourceId);
        if (!src || !src.enabled) return;

        setSelectedSources((prev) =>
            prev.includes(sourceId)
                ? prev.filter((id) => id !== sourceId)
                : [...prev, sourceId]
        );
    };

    const handleSelectAll = () => {
        if (activeCount === 0) return;
        if (allActiveSelected) {
            setSelectedSources([]);
        } else {
            setSelectedSources(activeSources.map((s) => s.id));
        }
    };

    const handleToggleSource = async (sourceId: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const target = sources.find((s) => s.id === sourceId);
        if (!target) return;
        const nextState = !target.enabled;

        // Optimistic UI update
        setSources((prev) =>
            prev.map((s) => (s.id === sourceId ? { ...s, enabled: nextState } : s))
        );

        if (!nextState) {
            setSelectedSources((prev) => prev.filter((id) => id !== sourceId));
        }

        try {
            const resp = await session.customFetch(`/admin/scrapers/${sourceId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enabled: nextState })
            });
            if (resp.ok) {
                setTriggerMessage({
                    type: "success",
                    text: tr(
                        `Scraper for ${target.name} ${nextState ? "enabled" : "disabled"}.`,
                        `Scraper pour ${target.name} ${nextState ? "activé" : "désactivé"}.`
                    )
                });
                await fetchStatus();
            }
        } catch {
            await fetchStatus();
        }
    };

    const handleTriggerScrape = async (targetSources?: string[], full: boolean = false) => {
        setLoading(true);
        setTriggerMessage(null);
        try {
            const resp = await session.customFetch("/admin/scrapers/scan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sources: targetSources && targetSources.length > 0 ? targetSources : null,
                    full: full
                })
            });
            const data = await resp.json();

            let targetLabel = tr("all active sources", "toutes les sources actives");
            if (targetSources && targetSources.length > 0) {
                targetLabel = targetSources
                    .map((id) => sources.find((s) => s.id === id)?.name || id)
                    .join(", ");
            }

            setTriggerMessage({
                type: "success",
                text: data.message || tr(
                    `${full ? "Full" : "Quick"} scan started for: ${targetLabel}!`,
                    `Scan ${full ? "complet" : "rapide"} lancé pour : ${targetLabel} !`
                )
            });
            await fetchStatus();
            setTimeout(fetchTotalBooks, 2000);
        } catch {
            setTriggerMessage({
                type: "error",
                text: tr("Error while triggering the scraper.", "Erreur lors du déclenchement du scraper.")
            });
        } finally {
            setLoading(false);
        }
    };

    const handleQuickScan = () => {
        if (selectedSources.length === 0) {
            setTriggerMessage({
                type: "error",
                text: tr(
                    "Please check at least one active source in the table to start a quick scan.",
                    "Veuillez cocher au moins une source active dans le tableau pour lancer un scan rapide."
                )
            });
            return;
        }
        handleTriggerScrape(selectedSources, false);
    };

    const handleFullScan = () => {
        if (selectedSources.length > 0) {
            handleTriggerScrape(selectedSources, true);
        } else {
            const activeList = activeSources.map((s) => s.id);
            if (activeList.length === 0) {
                setTriggerMessage({
                    type: "error",
                    text: tr(
                        "All sources are disabled. Enable at least one source to start a full scan.",
                        "Toutes les sources sont désactivées. Activez au moins une source pour lancer un scan complet."
                    )
                });
                return;
            }
            handleTriggerScrape(undefined, true);
        }
    };

    const handleStopScan = async () => {
        setLoading(true);
        setTriggerMessage(null);
        try {
            const resp = await session.customFetch("/admin/scrapers/stop", {
                method: "POST"
            });
            const data = await resp.json();
            setTriggerMessage({
                type: "success",
                text: data.message || tr("Scan stop requested.", "Arrêt du scan demandé.")
            });
            await fetchStatus();
        } catch {
            setTriggerMessage({
                type: "error",
                text: tr("Error while requesting to stop the scan.", "Erreur lors de la demande d'arrêt du scan.")
            });
        } finally {
            setLoading(false);
        }
    };



    const liveScan = status?.live_scan;
    const isScanRunning = Boolean(status?.is_running);

    return (
        <div className="admin-page">
            <WrapperHeader>
                <h2>{tr("Catalog Indexing", "Indexation des catalogues")}</h2>
            </WrapperHeader>

            <div className="admin-page__content">
                {triggerMessage && (
                    <div style={{
                        padding: "14px 18px",
                        borderRadius: "12px",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        fontSize: "0.9rem",
                        fontWeight: 500,
                        background: triggerMessage.type === "success" ? "var(--accent-primary-light)" : "rgba(239, 68, 68, 0.15)",
                        border: `1px solid ${triggerMessage.type === "success" ? "var(--border-focus)" : "rgba(239, 68, 68, 0.3)"}`,
                        color: triggerMessage.type === "success" ? "var(--accent-primary)" : "#f87171"
                    }}>
                        <FontAwesomeIcon icon={triggerMessage.type === "success" ? faCheck : faTriangleExclamation} />
                        <span>{triggerMessage.text}</span>
                    </div>
                )}

                {/* Quick Metrics Bar */}
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "16px"
                }}>
                    <div style={{
                        background: "var(--bg-surface)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "14px",
                        padding: "18px 20px",
                        display: "flex",
                        alignItems: "center",
                        gap: "16px",
                        boxShadow: "var(--shadow-sm)"
                    }}>
                        <div style={{
                            width: "48px",
                            height: "48px",
                            borderRadius: "12px",
                            background: "rgba(99, 102, 241, 0.15)",
                            color: "#818cf8",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "22px"
                        }}>
                            <FontAwesomeIcon icon={faBookOpen} />
                        </div>
                        <div>
                            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                                {tr("Indexed books", "Albums indexés")}
                            </div>
                            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)" }}>
                                {totalBooks}
                            </div>
                        </div>
                    </div>

                    <div style={{
                        background: "var(--bg-surface)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "14px",
                        padding: "18px 20px",
                        display: "flex",
                        alignItems: "center",
                        gap: "16px",
                        boxShadow: "var(--shadow-sm)"
                    }}>
                        <div style={{
                            width: "48px",
                            height: "48px",
                            borderRadius: "12px",
                            background: isScanRunning ? "rgba(245, 158, 11, 0.15)" : "var(--accent-primary-light)",
                            color: isScanRunning ? "var(--accent-amber)" : "var(--accent-primary)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "22px"
                        }}>
                            <FontAwesomeIcon icon={faRotate} spin={isScanRunning || loading} />
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                                {tr("Bot status", "État du robot")}
                            </div>
                            {isScanRunning ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "2px" }}>
                                    <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--accent-amber)", display: "flex", alignItems: "center", gap: "6px" }}>
                                        <span>{tr("Scan:", "Scan :")}</span>
                                        <span style={{
                                            color: liveScan?.current_source_color || "var(--accent-amber)",
                                            fontWeight: 800
                                        }}>
                                            {liveScan?.current_source_name || liveScan?.current_source || tr("In progress", "En cours")}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 500 }}>
                                        {(liveScan?.total_found ?? 0) === 0 ? (
                                            <span style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "6px",
                                                color: "var(--accent-amber)",
                                                fontWeight: 600
                                            }}>
                                                <span className="admin-status-pulse" />
                                                {liveScan?.current_step || tr("Exploring catalog...", "Exploration du catalogue...")}
                                            </span>
                                        ) : (
                                            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                                <span>
                                                    <strong style={{ color: "var(--text-primary)", fontWeight: 700 }}>{liveScan?.total_found}</strong>{" "}
                                                    {((liveScan?.total_found ?? 0) > 1) ? tr("books found", "livres trouvés") : tr("book found", "livre trouvé")}
                                                </span>
                                                {liveScan?.current_step && (
                                                    <span style={{
                                                        fontSize: "0.75rem",
                                                        color: "var(--accent-amber)",
                                                        background: "rgba(245, 158, 11, 0.12)",
                                                        padding: "1px 7px",
                                                        borderRadius: "10px",
                                                        fontWeight: 600
                                                    }}>
                                                        {liveScan.current_step}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : liveScan?.last_error ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "2px" }}>
                                    <div style={{ fontSize: "1rem", fontWeight: 700, color: "#ef4444" }}>
                                        {tr("Error", "Erreur")}
                                    </div>
                                    <div style={{ fontSize: "0.75rem", color: "#f87171", fontWeight: 500, lineHeight: 1.2 }}>
                                        {liveScan.last_error}
                                    </div>
                                </div>
                            ) : (
                                <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--accent-primary)", marginTop: "2px" }}>
                                    {tr("Idle (Ready)", "En veille (Prêt)")}
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{
                        background: "var(--bg-surface)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "14px",
                        padding: "18px 20px",
                        display: "flex",
                        alignItems: "center",
                        gap: "16px",
                        boxShadow: "var(--shadow-sm)"
                    }}>
                        <div style={{
                            width: "48px",
                            height: "48px",
                            borderRadius: "12px",
                            background: "rgba(139, 92, 246, 0.15)",
                            color: "#a78bfa",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "22px"
                        }}>
                            <FontAwesomeIcon icon={faClock} />
                        </div>
                        <div>
                            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                                {tr("Auto schedule", "Planification auto")}
                            </div>
                            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                                {tr(`Daily at ${status?.schedule?.daily_at || "03:00"}`, `Quotidien à ${status?.schedule?.daily_at || "03:00"}`)}
                            </div>
                        </div>
                    </div>

                    <div style={{
                        background: "var(--bg-surface)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "14px",
                        padding: "18px 20px",
                        display: "flex",
                        alignItems: "center",
                        gap: "16px",
                        boxShadow: "var(--shadow-sm)"
                    }}>
                        <div style={{
                            width: "48px",
                            height: "48px",
                            borderRadius: "12px",
                            background: "rgba(236, 72, 153, 0.15)",
                            color: "#f472b6",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "22px"
                        }}>
                            <FontAwesomeIcon icon={faServer} />
                        </div>
                        <div>
                            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                                {tr("Configured sources", "Sources configurées")}
                            </div>
                            <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--text-primary)" }}>
                                {activeCount} / {sources.length} <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text-muted)" }}>{tr("active", "actives")}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Live Scan In-Progress Banner */}
                {isScanRunning && (
                    <div style={{
                        background: "var(--bg-surface)",
                        border: "1px solid var(--border-subtle)",
                        borderLeft: `4px solid ${liveScan?.current_source_color || "var(--accent-amber)"}`,
                        borderRadius: "14px",
                        padding: "16px 20px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "16px",
                        boxShadow: "var(--shadow-sm)",
                        flexWrap: "wrap"
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
                            <div style={{
                                width: "40px",
                                height: "40px",
                                borderRadius: "10px",
                                background: "rgba(245, 158, 11, 0.15)",
                                color: "var(--accent-amber)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "18px"
                            }}>
                                <FontAwesomeIcon icon={faRotate} spin />
                            </div>
                            <div>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                    <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)" }}>
                                        {tr("Scan in progress:", "Scan en cours :")}
                                    </span>
                                    <span style={{
                                        fontWeight: 800,
                                        fontSize: "0.95rem",
                                        color: liveScan?.current_source_color || "var(--accent-amber)"
                                    }}>
                                        {liveScan?.current_source_name || liveScan?.current_source || tr("In progress", "En cours")}
                                    </span>
                                </div>
                                <div style={{
                                    fontSize: "0.85rem",
                                    color: "var(--text-muted)",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    marginTop: "3px",
                                    flexWrap: "wrap"
                                }}>
                                    <span style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "6px",
                                        color: "var(--accent-amber)",
                                        fontWeight: 600
                                    }}>
                                        <span className="admin-status-pulse" />
                                        {(liveScan?.total_found ?? 0) === 0
                                            ? (liveScan?.current_step || tr("Exploring catalog...", "Exploration du catalogue..."))
                                            : (liveScan?.current_step || tr("Indexing books...", "Indexation des albums..."))}
                                    </span>
                                    {(liveScan?.total_found ?? 0) > 0 && (
                                        <>
                                            <span>•</span>
                                            <span>
                                                <strong style={{ color: "var(--text-primary)" }}>{liveScan?.total_found}</strong> {tr("found", "trouvés")}
                                            </span>
                                            <span>•</span>
                                            <span>
                                                <strong style={{ color: "var(--text-primary)" }}>{liveScan?.total_saved}</strong> {tr("saved", "enregistrés")}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <button
                            type="button"
                            className="admin-btn admin-btn--stop"
                            onClick={handleStopScan}
                            disabled={loading}
                            style={{ padding: "8px 16px", fontSize: "0.85rem" }}
                            title={tr("Stop current scan", "Arrêter le scan en cours")}
                        >
                            <FontAwesomeIcon icon={faStop} />
                            <span>{tr("Stop", "Arrêter")}</span>
                        </button>
                    </div>
                )}

                {/* Sources & Publishers Section (Table with Multi-select and Header Actions) */}
                <div className="admin-sources-panel">
                    <div className="admin-sources-panel__header">
                        <div className="admin-sources-panel__title-group">
                            <div className="admin-sources-panel__title-row">
                                <h3 className="admin-sources-panel__title">
                                    {tr("Publishers & Sources", "Éditeurs & Sources")}
                                </h3>
                                <span className="admin-sources-panel__badge">
                                    {activeCount} / {sources.length} {tr("active", "actives")}
                                </span>
                                {selectedSources.length > 0 && (
                                    <span className="admin-sources-panel__badge admin-sources-panel__badge--selected">
                                        {tr(
                                            `${selectedSources.length} selected`,
                                            `${selectedSources.length} cochée${selectedSources.length > 1 ? "s" : ""}`
                                        )}
                                    </span>
                                )}
                            </div>
                            <p className="admin-sources-panel__subtitle">
                                {tr(
                                    "Check active sources for a targeted scan or enable/disable each publisher's scraper.",
                                    "Cochez les sources actives pour un scan ciblé ou activez/désactivez le scraper de chaque éditeur."
                                )}
                            </p>
                        </div>

                        <div className="admin-sources-panel__actions">
                            {!isScanRunning ? (
                                <>
                                    <button
                                        type="button"
                                        className="admin-btn admin-btn--quick"
                                        onClick={handleQuickScan}
                                        disabled={loading || selectedSources.length === 0}
                                        title={
                                            selectedSources.length === 0
                                                ? tr("Check at least one active source in the table to start a quick scan", "Cochez au moins une source active dans le tableau pour lancer un scan rapide")
                                                : tr("Start a quick scan (new releases) on selected sources", "Lancer un scan rapide (nouveautés) sur les sources cochées")
                                        }
                                    >
                                        <FontAwesomeIcon icon={faBolt} />
                                        <span>
                                            {tr("Quick scan", "Scan rapide")} {selectedSources.length > 0 ? `(${selectedSources.length})` : ""}
                                        </span>
                                    </button>

                                    <button
                                        type="button"
                                        className="admin-btn admin-btn--full"
                                        onClick={handleFullScan}
                                        disabled={loading || (selectedSources.length === 0 && activeCount === 0)}
                                        title={
                                            selectedSources.length > 0
                                                ? tr("Start a full catalog scan on selected sources", "Lancer un scan complet du catalogue sur les sources cochées")
                                                : tr("Start a full catalog scan on all active sources", "Lancer un scan complet du catalogue sur toutes les sources actives")
                                        }
                                    >
                                        <FontAwesomeIcon icon={faLayerGroup} />
                                        <span>
                                            {tr("Full scan", "Scan complet")} {selectedSources.length > 0 ? `(${selectedSources.length})` : tr("(active)", "(actives)")}
                                        </span>
                                    </button>
                                </>
                            ) : (
                                <button
                                    type="button"
                                    className="admin-btn admin-btn--stop"
                                    onClick={handleStopScan}
                                    disabled={loading}
                                    title={tr("Stop current scan", "Arrêter le scan en cours")}
                                >
                                    <FontAwesomeIcon icon={faStop} />
                                    <span>{tr("Stop scanning", "Arrêter de scanner")}</span>
                                </button>
                            )}


                        </div>
                    </div>

                    <div className="admin-sources-panel__table-wrapper">
                        <table className="admin-sources-table">
                            <thead>
                                <tr>
                                    <th style={{ width: "48px", textAlign: "center" }}>
                                        <input
                                            ref={headerCheckboxRef}
                                            type="checkbox"
                                            className="admin-checkbox"
                                            checked={allActiveSelected}
                                            disabled={activeCount === 0}
                                            onChange={handleSelectAll}
                                            title={allActiveSelected ? tr("Deselect all", "Tout désélectionner") : tr("Select all active sources", "Sélectionner toutes les sources actives")}
                                        />
                                    </th>
                                    <th>{tr("Source / Publisher Name", "Nom de la source / Éditeur")}</th>
                                    <th>{tr("Description", "Description")}</th>
                                    <th style={{ width: "190px", textAlign: "center" }}>{tr("Scraper Status", "État du Scraper")}</th>
                                    <th style={{ width: "120px", textAlign: "right" }}>{tr("Action", "Action")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedSources.map((source) => {
                                    const isEnabled = source.enabled;
                                    const isSelected = isEnabled && selectedSources.includes(source.id);

                                    return (
                                        <tr
                                            key={source.id}
                                            className={`admin-sources-table__row ${isSelected ? "is-selected" : ""} ${!isEnabled ? "is-disabled" : ""}`}
                                            onClick={isEnabled ? () => handleToggleSelect(source.id) : undefined}
                                        >
                                            {/* Checkbox column: only if enabled */}
                                            <td
                                                style={{ textAlign: "center" }}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {isEnabled ? (
                                                    <input
                                                        type="checkbox"
                                                        className="admin-checkbox"
                                                        checked={isSelected}
                                                        onChange={() => handleToggleSelect(source.id)}
                                                    />
                                                ) : (
                                                    <span className="admin-sources-table__no-check" title={tr("Scraper disabled", "Scraper désactivé")}>-</span>
                                                )}
                                            </td>

                                            <td>
                                                <div className="source-cell">
                                                    <div className="source-cell__info">
                                                        <span className="source-cell__name">{source.name}</span>
                                                        <span className="source-cell__code">{source.id}</span>
                                                    </div>
                                                </div>
                                            </td>

                                            <td>
                                                <span className="source-description">{source.desc}</span>
                                            </td>

                                            {/* Toggle switch: always available to re-enable or disable */}
                                            <td
                                                style={{ textAlign: "center" }}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <label
                                                    className="admin-toggle"
                                                    title={isEnabled ? tr("Disable scraper for this source", "Désactiver le scraper de cette source") : tr("Enable scraper for this source", "Activer le scraper de cette source")}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isEnabled}
                                                        onChange={() => handleToggleSource(source.id)}
                                                        disabled={loading || isScanRunning}
                                                    />
                                                    <span className="admin-toggle__slider" />
                                                    <span className={`admin-toggle__label ${isEnabled ? "is-active" : "is-inactive"}`}>
                                                        {isEnabled ? tr("Enabled", "Activé") : tr("Disabled", "Désactivé")}
                                                    </span>
                                                </label>
                                            </td>

                                            {/* Action column: scanner button ONLY if enabled */}
                                            <td
                                                style={{ textAlign: "right" }}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {isEnabled && (
                                                    isScanRunning && liveScan?.current_source === source.id ? (
                                                        <span
                                                            style={{
                                                                display: "inline-flex",
                                                                alignItems: "center",
                                                                gap: "6px",
                                                                padding: "6px 12px",
                                                                borderRadius: "8px",
                                                                background: "rgba(245, 158, 11, 0.12)",
                                                                color: "var(--accent-amber)",
                                                                fontSize: "0.8rem",
                                                                fontWeight: 600
                                                            }}
                                                        >
                                                            <FontAwesomeIcon icon={faRotate} spin />
                                                            <span>
                                                                {(liveScan?.total_found ?? 0) === 0
                                                                    ? (liveScan?.current_step || tr("Exploring...", "Exploration..."))
                                                                    : tr(`${liveScan?.total_found} found`, `${liveScan?.total_found} trouvés`)}
                                                            </span>
                                                        </span>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            className="admin-row-btn"
                                                            onClick={() => handleTriggerScrape([source.id], true)}
                                                            disabled={loading || isScanRunning}
                                                            title={tr(`Scan ${source.name} (full catalog)`, `Scanner ${source.name} (catalogue complet)`)}
                                                        >
                                                            <FontAwesomeIcon icon={faBolt} style={{ color: source.color }} />
                                                            <span>{tr("Scan", "Scanner")}</span>
                                                        </button>
                                                    )
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
}
