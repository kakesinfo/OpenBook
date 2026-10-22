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
    faTriangleExclamation
} from "@fortawesome/free-solid-svg-icons";
import useSession from "../../hooks/UseSession.tsx";
import "./AdminPage.scss";

interface JobHistory {
    start_time: string;
    source: string;
    total_scraped: number;
    total_saved: number;
    status: string;
}

interface ScraperStatus {
    is_running: boolean;
    current_job: string | null;
    last_run: string | null;
    last_status: string;
    available_sources: string[];
    disabled_sources?: string[];
    enabled_sources?: string[];
    schedule: {
        daily_at: string;
        scrape_on_startup: boolean;
    };
    recent_history?: JobHistory[];
}

const SCRAPER_API_URL = "http://localhost:5001";

const PUBLISHERS = [
    { id: "urban_comics", name: "Urban Comics", desc: "Comics DC, Indies, Urban Link", color: "#3b82f6" },
    { id: "panini", name: "Panini Comics", desc: "Marvel, Star Wars, Panini Manga", color: "#ef4444" },
    { id: "morgen_bd", name: "Morgen BD", desc: "Boutique & nouveautés indés Morgen", color: "#8b5cf6" },
    { id: "mangetsu", name: "Mangetsu", desc: "Mangas seinen, shonen & nouveautés japonaises", color: "#f59e0b" },
    { id: "label619", name: "Label 619", desc: "Mutafukaz, Rue de Sèvres, BD alternatives", color: "#ec4899" }
];

export default function AdminPage() {
    const session = useSession();
    const [status, setStatus] = useState<ScraperStatus | null>(null);
    const [loading, setLoading] = useState(false);
    const [triggerMessage, setTriggerMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [totalBooks, setTotalBooks] = useState<number>(0);
    const [serverConnected, setServerConnected] = useState<boolean | null>(null);

    // Enabled/Disabled state per scraper source
    const [enabledSources, setEnabledSources] = useState<Record<string, boolean>>(() => {
        try {
            const saved = localStorage.getItem("scraper_enabled_sources");
            if (saved) {
                return JSON.parse(saved);
            }
        } catch {
            // fallback
        }
        return PUBLISHERS.reduce<Record<string, boolean>>((acc, p) => {
            acc[p.id] = true;
            return acc;
        }, {});
    });

    // Multiple selection of sources
    const [selectedSources, setSelectedSources] = useState<string[]>([]);
    const headerCheckboxRef = useRef<HTMLInputElement>(null);

    const activeCount = PUBLISHERS.filter((p) => enabledSources[p.id] !== false).length;

    // Manage indeterminate state on header checkbox
    useEffect(() => {
        if (headerCheckboxRef.current) {
            headerCheckboxRef.current.indeterminate =
                selectedSources.length > 0 && selectedSources.length < PUBLISHERS.length;
        }
    }, [selectedSources]);

    const fetchStatus = async () => {
        try {
            const resp = await fetch(`${SCRAPER_API_URL}/api/status`);
            if (resp.ok) {
                const data: ScraperStatus = await resp.json();
                setStatus(data);
                setServerConnected(true);

                if (Array.isArray(data.disabled_sources)) {
                    setEnabledSources((prev) => {
                        const updated = { ...prev };
                        PUBLISHERS.forEach((p) => {
                            updated[p.id] = !data.disabled_sources?.includes(p.id);
                        });
                        try {
                            localStorage.setItem("scraper_enabled_sources", JSON.stringify(updated));
                        } catch {
                            // ignore
                        }
                        return updated;
                    });
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

    useEffect(() => {
        fetchStatus();
        fetchTotalBooks();
        const interval = setInterval(fetchStatus, 5000);
        return () => clearInterval(interval);
    }, [session]);

    const handleToggleSelect = (sourceId: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setSelectedSources((prev) =>
            prev.includes(sourceId)
                ? prev.filter((id) => id !== sourceId)
                : [...prev, sourceId]
        );
    };

    const handleSelectAll = () => {
        if (selectedSources.length === PUBLISHERS.length) {
            setSelectedSources([]);
        } else {
            setSelectedSources(PUBLISHERS.map((p) => p.id));
        }
    };

    const handleToggleSource = async (sourceId: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const nextState = !enabledSources[sourceId];
        const updated = { ...enabledSources, [sourceId]: nextState };
        setEnabledSources(updated);

        try {
            localStorage.setItem("scraper_enabled_sources", JSON.stringify(updated));
        } catch {
            // ignore
        }

        try {
            const resp = await fetch(`${SCRAPER_API_URL}/api/sources/${sourceId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enabled: nextState })
            });
            if (resp.ok) {
                const pubName = PUBLISHERS.find((p) => p.id === sourceId)?.name || sourceId;
                setTriggerMessage({
                    type: "success",
                    text: `Scraper pour ${pubName} ${nextState ? "activé" : "désactivé"}.`
                });
                await fetchStatus();
            }
        } catch {
            // Keep local state even if remote endpoint fails
        }
    };

    const handleTriggerScrape = async (sources?: string[], full: boolean = false) => {
        setLoading(true);
        setTriggerMessage(null);
        try {
            let url = `${SCRAPER_API_URL}/api/scrape`;
            const params = new URLSearchParams();
            if (sources && sources.length > 0) {
                params.append("sources", sources.join(","));
            }
            if (full) {
                params.append("full", "true");
            }
            const qs = params.toString();
            if (qs) {
                url += `?${qs}`;
            }

            const resp = await fetch(url, { method: "POST" });
            const data = await resp.json();

            let targetLabel = "toutes les sources actives";
            if (sources && sources.length > 0) {
                targetLabel = sources
                    .map((s) => PUBLISHERS.find((p) => p.id === s)?.name || s)
                    .join(", ");
            }

            setTriggerMessage({
                type: "success",
                text: data.message || `Scan ${full ? "complet" : "rapide"} lancé pour : ${targetLabel} !`
            });
            await fetchStatus();
            setTimeout(fetchTotalBooks, 4000);
        } catch {
            setTriggerMessage({
                type: "error",
                text: "Impossible de joindre le microservice scraper sur le port 5001."
            });
        } finally {
            setLoading(false);
        }
    };

    const handleQuickScan = () => {
        if (selectedSources.length === 0) {
            setTriggerMessage({
                type: "error",
                text: "Veuillez cocher au moins une source dans le tableau pour lancer un scan rapide."
            });
            return;
        }
        handleTriggerScrape(selectedSources, false);
    };

    const handleFullScan = () => {
        // If sources are checked, scan those checked.
        // Otherwise, scan all active (enabled) sources.
        if (selectedSources.length > 0) {
            handleTriggerScrape(selectedSources, true);
        } else {
            const activeList = PUBLISHERS.filter((p) => enabledSources[p.id] !== false).map((p) => p.id);
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

    const handleRepair = async () => {
        setLoading(true);
        setTriggerMessage(null);
        try {
            const resp = await fetch(`${SCRAPER_API_URL}/api/repair`, { method: "POST" });
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
                        border: `1px solid ${triggerMessage.type === "success" ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}` ,
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
                            background: status?.is_running ? "rgba(245, 158, 11, 0.15)" : "rgba(16, 185, 129, 0.15)",
                            color: status?.is_running ? "#f59e0b" : "#10b981",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "22px"
                        }}>
                            <FontAwesomeIcon icon={faRotate} spin={status?.is_running || loading} />
                        </div>
                        <div>
                            <div style={{ fontSize: "0.8rem", color: "var(--text-muted, #9ca3af)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                                État du robot
                            </div>
                            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: status?.is_running ? "#f59e0b" : "#10b981" }}>
                                {status?.is_running ? (status.current_job || "Scan en cours...") : "En veille (Prêt)"}
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
                                {activeCount} / {PUBLISHERS.length} <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text-muted, #9ca3af)" }}>actives</span>
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
                                    {activeCount} / {PUBLISHERS.length} actives
                                </span>
                                {selectedSources.length > 0 && (
                                    <span className="admin-sources-panel__badge admin-sources-panel__badge--selected">
                                        {selectedSources.length} cochée{selectedSources.length > 1 ? "s" : ""}
                                    </span>
                                )}
                            </div>
                            <p className="admin-sources-panel__subtitle">
                                Cochez les sources pour un scan ciblé ou activez/désactivez le scraper de chaque éditeur.
                            </p>
                        </div>

                        <div className="admin-sources-panel__actions">
                            <button
                                type="button"
                                className="admin-btn admin-btn--quick"
                                onClick={handleQuickScan}
                                disabled={loading || status?.is_running || selectedSources.length === 0}
                                title={
                                    selectedSources.length === 0
                                        ? "Cochez au moins une source dans le tableau pour lancer un scan rapide"
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
                                disabled={loading || status?.is_running || (selectedSources.length === 0 && activeCount === 0)}
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

                            <button
                                type="button"
                                className="admin-btn admin-btn--repair"
                                onClick={handleRepair}
                                disabled={loading || status?.is_running}
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
                                            checked={selectedSources.length === PUBLISHERS.length && PUBLISHERS.length > 0}
                                            onChange={handleSelectAll}
                                            title={selectedSources.length === PUBLISHERS.length ? "Tout désélectionner" : "Tout sélectionner"}
                                        />
                                    </th>
                                    <th>Nom de la source / Éditeur</th>
                                    <th>Description</th>
                                    <th style={{ width: "190px", textAlign: "center" }}>État du Scraper</th>
                                    <th style={{ width: "120px", textAlign: "right" }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {PUBLISHERS.map((pub) => {
                                    const isSelected = selectedSources.includes(pub.id);
                                    const isEnabled = enabledSources[pub.id] !== false;

                                    return (
                                        <tr
                                            key={pub.id}
                                            className={`admin-sources-table__row ${isSelected ? "is-selected" : ""} ${!isEnabled ? "is-disabled" : ""}`}
                                            onClick={() => handleToggleSelect(pub.id)}
                                        >
                                            <td
                                                style={{ textAlign: "center" }}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <input
                                                    type="checkbox"
                                                    className="admin-checkbox"
                                                    checked={isSelected}
                                                    onChange={() => handleToggleSelect(pub.id)}
                                                />
                                            </td>

                                            <td>
                                                <div className="source-cell">
                                                    <span
                                                        className="source-cell__dot"
                                                        style={{ backgroundColor: pub.color }}
                                                    />
                                                    <div className="source-cell__info">
                                                        <span className="source-cell__name">{pub.name}</span>
                                                        <span className="source-cell__code">{pub.id}</span>
                                                    </div>
                                                </div>
                                            </td>

                                            <td>
                                                <span className="source-description">{pub.desc}</span>
                                            </td>

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
                                                        onChange={() => handleToggleSource(pub.id)}
                                                        disabled={loading || status?.is_running}
                                                    />
                                                    <span className="admin-toggle__slider" />
                                                    <span className={`admin-toggle__label ${isEnabled ? "is-active" : "is-inactive"}`}>
                                                        {isEnabled ? "Activé" : "Désactivé"}
                                                    </span>
                                                </label>
                                            </td>

                                            <td
                                                style={{ textAlign: "right" }}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <button
                                                    type="button"
                                                    className="admin-row-btn"
                                                    onClick={() => handleTriggerScrape([pub.id], false)}
                                                    disabled={loading || status?.is_running || !isEnabled}
                                                    title={`Scanner ${pub.name} (scan rapide)`}
                                                >
                                                    <FontAwesomeIcon icon={faBolt} style={{ color: pub.color }} />
                                                    <span>Scanner</span>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* History Table */}
                {status?.recent_history && status.recent_history.length > 0 && (
                    <div style={{
                        background: "var(--card-bg, #1e1e24)",
                        border: "1px solid var(--border-color, #2a2a32)",
                        borderRadius: "16px",
                        padding: "24px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "16px"
                    }}>
                        <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>
                            Historique récent des exécutions
                        </h3>

                        <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                                <thead>
                                    <tr style={{ borderBottom: "1px solid var(--border-color, #2a2a32)", color: "var(--text-muted, #9ca3af)", textAlign: "left" }}>
                                        <th style={{ padding: "10px 12px" }}>Date & Heure</th>
                                        <th style={{ padding: "10px 12px" }}>Source</th>
                                        <th style={{ padding: "10px 12px" }}>Scannés</th>
                                        <th style={{ padding: "10px 12px" }}>Enregistrés</th>
                                        <th style={{ padding: "10px 12px" }}>Statut</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {status.recent_history.map((job, idx) => (
                                        <tr key={idx} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                                            <td style={{ padding: "10px 12px", color: "var(--text-muted, #9ca3af)" }}>
                                                {job.start_time ? new Date(job.start_time).toLocaleString("fr-FR") : "-"}
                                            </td>
                                            <td style={{ padding: "10px 12px", fontWeight: 600 }}>{job.source}</td>
                                            <td style={{ padding: "10px 12px" }}>{job.total_scraped}</td>
                                            <td style={{ padding: "10px 12px", color: "#10b981", fontWeight: 600 }}>+{job.total_saved}</td>
                                            <td style={{ padding: "10px 12px" }}>
                                                <span style={{
                                                    padding: "3px 8px",
                                                    borderRadius: "6px",
                                                    fontSize: "0.75rem",
                                                    fontWeight: 600,
                                                    background: job.status === "completed" || job.status === "success" ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                                                    color: job.status === "completed" || job.status === "success" ? "#10b981" : "#ef4444"
                                                }}>
                                                    {job.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
