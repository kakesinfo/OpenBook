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
    faWrench,
    faServer,
    faCircleCheck,
    faTriangleExclamation,
    faStop
} from "@fortawesome/free-solid-svg-icons";
import useSession from "../../hooks/UseSession.tsx";
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
    total_found: number;
    total_saved: number;
    started_at?: string | null;
    ended_at?: string | null;
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

export default function AdminPage() {
    const session = useSession();
    const [status, setStatus] = useState<ScraperStatus | null>(null);
    const [sources, setSources] = useState<ScraperSource[]>([]);
    const [loading, setLoading] = useState(false);
    const [triggerMessage, setTriggerMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [totalBooks, setTotalBooks] = useState<number>(0);
    const [serverConnected, setServerConnected] = useState<boolean | null>(null);

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
                setServerConnected(data.connected !== false);

                if (Array.isArray(data.sources)) {
                    setSources(data.sources);
                    // Filter out any selected source that became disabled
                    setSelectedSources((prev) =>
                        prev.filter((id) => data.sources?.find((s) => s.id === id)?.enabled)
                    );
                }
            } else {
                setServerConnected(false);
            }
        } catch {
            setServerConnected(false);
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
                    text: `Scraper pour ${target.name} ${nextState ? "activé" : "désactivé"}.`
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

            let targetLabel = "toutes les sources actives";
            if (targetSources && targetSources.length > 0) {
                targetLabel = targetSources
                    .map((id) => sources.find((s) => s.id === id)?.name || id)
                    .join(", ");
            }

            setTriggerMessage({
                type: "success",
                text: data.message || `Scan ${full ? "complet" : "rapide"} lancé pour : ${targetLabel} !`
            });
            await fetchStatus();
            setTimeout(fetchTotalBooks, 2000);
        } catch {
            setTriggerMessage({
                type: "error",
                text: "Erreur lors du déclenchement du scraper."
            });
        } finally {
            setLoading(false);
        }
    };

    const handleQuickScan = () => {
        if (selectedSources.length === 0) {
            setTriggerMessage({
                type: "error",
                text: "Veuillez cocher au moins une source active dans le tableau pour lancer un scan rapide."
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
                    text: "Toutes les sources sont désactivées. Activez au moins une source pour lancer un scan complet."
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
                text: data.message || "Arrêt du scan demandé."
            });
            await fetchStatus();
        } catch {
            setTriggerMessage({
                type: "error",
                text: "Erreur lors de la demande d'arrêt du scan."
            });
        } finally {
            setLoading(false);
        }
    };

    const handleRepair = async () => {
        setLoading(true);
        setTriggerMessage(null);
        try {
            const resp = await session.customFetch("/admin/scrapers/repair", {
                method: "POST"
            });
            const data = await resp.json();
            setTriggerMessage({
                type: "success",
                text: data.message || "Nettoyage et réparation UTF-8 effectués !"
            });
            setTimeout(fetchTotalBooks, 2000);
        } catch {
            setTriggerMessage({
                type: "error",
                text: "Erreur lors de l'appel au service de réparation."
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
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", flexWrap: "wrap", gap: "12px" }}>
                    <div>
                        <h2>Administration</h2>
                    </div>

                    <div style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "6px 14px",
                        borderRadius: "20px",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        background: serverConnected ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                        color: serverConnected ? "#10b981" : "#ef4444",
                        border: `1px solid ${serverConnected ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`
                    }}>
                        <FontAwesomeIcon icon={serverConnected ? faCircleCheck : faTriangleExclamation} />
                        <span>{serverConnected ? "Microservice Scraper Connecté" : "Microservice Injoignable"}</span>
                    </div>
                </div>
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
                        background: triggerMessage.type === "success" ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                        border: `1px solid ${triggerMessage.type === "success" ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                        color: triggerMessage.type === "success" ? "#34d399" : "#f87171"
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
                        background: "var(--card-bg, #1e1e24)",
                        border: "1px solid var(--border-color, #2a2a32)",
                        borderRadius: "14px",
                        padding: "18px 20px",
                        display: "flex",
                        alignItems: "center",
                        gap: "16px"
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
                            <div style={{ fontSize: "0.8rem", color: "var(--text-muted, #9ca3af)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                                Albums indexés
                            </div>
                            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary, #fff)" }}>
                                {totalBooks}
                            </div>
                        </div>
                    </div>

                    <div style={{
                        background: "var(--card-bg, #1e1e24)",
                        border: "1px solid var(--border-color, #2a2a32)",
                        borderRadius: "14px",
                        padding: "18px 20px",
                        display: "flex",
                        alignItems: "center",
                        gap: "16px"
                    }}>
                        <div style={{
                            width: "48px",
                            height: "48px",
                            borderRadius: "12px",
                            background: isScanRunning ? "rgba(245, 158, 11, 0.15)" : "rgba(16, 185, 129, 0.15)",
                            color: isScanRunning ? "#f59e0b" : "#10b981",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "22px"
                        }}>
                            <FontAwesomeIcon icon={faRotate} spin={isScanRunning || loading} />
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: "0.8rem", color: "var(--text-muted, #9ca3af)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                                État du robot
                            </div>
                            {isScanRunning ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "2px" }}>
                                    <div style={{ fontSize: "1rem", fontWeight: 700, color: "#f59e0b", display: "flex", alignItems: "center", gap: "6px" }}>
                                        <span>Scan :</span>
                                        <span style={{
                                            color: liveScan?.current_source_color || "#f59e0b",
                                            fontWeight: 800
                                        }}>
                                            {liveScan?.current_source_name || liveScan?.current_source || "En cours"}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: "0.85rem", color: "var(--text-muted, #9ca3af)", fontWeight: 500 }}>
                                        <strong style={{ color: "#fff", fontWeight: 700 }}>{liveScan?.total_found ?? 0}</strong> {((liveScan?.total_found ?? 0) > 1) ? "livres trouvés" : "livre trouvé"}
                                    </div>
                                </div>
                            ) : (
                                <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#10b981", marginTop: "2px" }}>
                                    En veille (Prêt)
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{
                        background: "var(--card-bg, #1e1e24)",
                        border: "1px solid var(--border-color, #2a2a32)",
                        borderRadius: "14px",
                        padding: "18px 20px",
                        display: "flex",
                        alignItems: "center",
                        gap: "16px"
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
                            <div style={{ fontSize: "0.8rem", color: "var(--text-muted, #9ca3af)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                                Planification auto
                            </div>
                            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary, #fff)" }}>
                                Quotidien à {status?.schedule?.daily_at || "03:00"}
                            </div>
                        </div>
                    </div>

                    <div style={{
                        background: "var(--card-bg, #1e1e24)",
                        border: "1px solid var(--border-color, #2a2a32)",
                        borderRadius: "14px",
                        padding: "18px 20px",
                        display: "flex",
                        alignItems: "center",
                        gap: "16px"
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
                            <div style={{ fontSize: "0.8rem", color: "var(--text-muted, #9ca3af)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                                Sources configurées
                            </div>
                            <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--text-primary, #fff)" }}>
                                {activeCount} / {sources.length} <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text-muted, #9ca3af)" }}>actives</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sources & Publishers Section (Table with Multi-select and Header Actions) */}
                <div className="admin-sources-panel">
                    <div className="admin-sources-panel__header">
                        <div className="admin-sources-panel__title-group">
                            <div className="admin-sources-panel__title-row">
                                <h3 className="admin-sources-panel__title">
                                    Éditeurs & Sources
                                </h3>
                                <span className="admin-sources-panel__badge">
                                    {activeCount} / {sources.length} actives
                                </span>
                                {selectedSources.length > 0 && (
                                    <span className="admin-sources-panel__badge admin-sources-panel__badge--selected">
                                        {selectedSources.length} cochée{selectedSources.length > 1 ? "s" : ""}
                                    </span>
                                )}
                            </div>
                            <p className="admin-sources-panel__subtitle">
                                Cochez les sources actives pour un scan ciblé ou activez/désactivez le scraper de chaque éditeur.
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
                                                ? "Cochez au moins une source active dans le tableau pour lancer un scan rapide"
                                                : "Lancer un scan rapide (nouveautés) sur les sources cochées"
                                        }
                                    >
                                        <FontAwesomeIcon icon={faBolt} />
                                        <span>
                                            Scan rapide {selectedSources.length > 0 ? `(${selectedSources.length})` : ""}
                                        </span>
                                    </button>

                                    <button
                                        type="button"
                                        className="admin-btn admin-btn--full"
                                        onClick={handleFullScan}
                                        disabled={loading || (selectedSources.length === 0 && activeCount === 0)}
                                        title={
                                            selectedSources.length > 0
                                                ? "Lancer un scan complet du catalogue sur les sources cochées"
                                                : "Lancer un scan complet du catalogue sur toutes les sources actives"
                                        }
                                    >
                                        <FontAwesomeIcon icon={faLayerGroup} />
                                        <span>
                                            Scan complet {selectedSources.length > 0 ? `(${selectedSources.length})` : "(actives)"}
                                        </span>
                                    </button>
                                </>
                            ) : (
                                <button
                                    type="button"
                                    className="admin-btn admin-btn--stop"
                                    onClick={handleStopScan}
                                    disabled={loading}
                                    title="Arrêter le scan en cours"
                                >
                                    <FontAwesomeIcon icon={faStop} />
                                    <span>Arrêter de scanner</span>
                                </button>
                            )}

                            <button
                                type="button"
                                className="admin-btn admin-btn--repair"
                                onClick={handleRepair}
                                disabled={loading || isScanRunning}
                                title="Nettoyer les caractères corrompus UTF-8 et consolider les séries"
                            >
                                <FontAwesomeIcon icon={faWrench} />
                                <span>Réparer UTF-8</span>
                            </button>
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
                                            title={allActiveSelected ? "Tout désélectionner" : "Sélectionner toutes les sources actives"}
                                        />
                                    </th>
                                    <th>Nom de la source / Éditeur</th>
                                    <th>Description</th>
                                    <th style={{ width: "190px", textAlign: "center" }}>État du Scraper</th>
                                    <th style={{ width: "120px", textAlign: "right" }}>Action</th>
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
                                                    <span className="admin-sources-table__no-check" title="Scraper désactivé">-</span>
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
                                                    title={isEnabled ? "Désactiver le scraper de cette source" : "Activer le scraper de cette source"}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isEnabled}
                                                        onChange={() => handleToggleSource(source.id)}
                                                        disabled={loading || isScanRunning}
                                                    />
                                                    <span className="admin-toggle__slider" />
                                                    <span className={`admin-toggle__label ${isEnabled ? "is-active" : "is-inactive"}`}>
                                                        {isEnabled ? "Activé" : "Désactivé"}
                                                    </span>
                                                </label>
                                            </td>

                                            {/* Action column: scanner button ONLY if enabled */}
                                            <td
                                                style={{ textAlign: "right" }}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {isEnabled && (
                                                    <button
                                                        type="button"
                                                        className="admin-row-btn"
                                                        onClick={() => handleTriggerScrape([source.id], false)}
                                                        disabled={loading || isScanRunning}
                                                        title={`Scanner ${source.name} (scan rapide)`}
                                                    >
                                                        <FontAwesomeIcon icon={faBolt} style={{ color: source.color }} />
                                                        <span>Scanner</span>
                                                    </button>
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
