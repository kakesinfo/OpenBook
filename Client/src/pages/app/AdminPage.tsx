import { WrapperHeader } from "../../components/Wrapper/Wrapper.tsx";
import { useState, useEffect } from "react";
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

    const fetchStatus = async () => {
        try {
            const resp = await fetch(`${SCRAPER_API_URL}/api/status`);
            if (resp.ok) {
                const data = await resp.json();
                setStatus(data);
                setServerConnected(true);
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

    const handleTriggerScrape = async (source?: string, full: boolean = false) => {
        setLoading(true);
        setTriggerMessage(null);
        try {
            let url = source
                ? `${SCRAPER_API_URL}/api/scrape/${source}`
                : `${SCRAPER_API_URL}/api/scrape`;
            if (full) {
                url += `${url.includes("?") ? "&" : "?"}full=true`;
            }
            const resp = await fetch(url, { method: "POST" });
            const data = await resp.json();
            setTriggerMessage({
                type: "success",
                text: data.message || `Scan lancé en tâche de fond pour ${source || "tous les éditeurs"} !`
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
                                Éditeurs supportés
                            </div>
                            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary, #fff)" }}>
                                {PUBLISHERS.length} sources
                            </div>
                        </div>
                    </div>
                </div>

                {/* Global Actions Panel */}
                <div style={{
                    background: "var(--card-bg, #1e1e24)",
                    border: "1px solid var(--border-color, #2a2a32)",
                    borderRadius: "16px",
                    padding: "24px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "20px"
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>
                                Actions Globales de Scan
                            </h3>
                            <p style={{ margin: "4px 0 0", color: "var(--text-muted, #9ca3af)", fontSize: "0.85rem" }}>
                                Déclenchez une synchronisation manuelle sur l'ensemble des éditeurs configurés
                            </p>
                        </div>

                        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                            <button
                                onClick={() => handleTriggerScrape(undefined, false)}
                                disabled={loading || status?.is_running}
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    padding: "10px 18px",
                                    borderRadius: "10px",
                                    background: status?.is_running ? "#4b5563" : "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                                    color: "#fff",
                                    border: "none",
                                    fontWeight: 600,
                                    fontSize: "0.9rem",
                                    cursor: status?.is_running ? "not-allowed" : "pointer",
                                    boxShadow: "0 2px 10px rgba(99, 102, 241, 0.3)"
                                }}
                            >
                                <FontAwesomeIcon icon={faBolt} />
                                <span>Scan Rapide (Nouveautés)</span>
                            </button>

                            <button
                                onClick={() => handleTriggerScrape(undefined, true)}
                                disabled={loading || status?.is_running}
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    padding: "10px 18px",
                                    borderRadius: "10px",
                                    background: status?.is_running ? "#4b5563" : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                                    color: "#fff",
                                    border: "none",
                                    fontWeight: 600,
                                    fontSize: "0.9rem",
                                    cursor: status?.is_running ? "not-allowed" : "pointer",
                                    boxShadow: "0 2px 10px rgba(16, 185, 129, 0.3)"
                                }}
                            >
                                <FontAwesomeIcon icon={faLayerGroup} />
                                <span>Scan Complet (Catalogue entier)</span>
                            </button>

                            <button
                                onClick={handleRepair}
                                disabled={loading || status?.is_running}
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    padding: "10px 18px",
                                    borderRadius: "10px",
                                    background: "rgba(255, 255, 255, 0.08)",
                                    color: "#e5e7eb",
                                    border: "1px solid rgba(255, 255, 255, 0.15)",
                                    fontWeight: 600,
                                    fontSize: "0.9rem",
                                    cursor: status?.is_running ? "not-allowed" : "pointer"
                                }}
                                title="Nettoyer les caractères corrompus UTF-8 et consolider les séries"
                            >
                                <FontAwesomeIcon icon={faWrench} />
                                <span>Réparer Textes UTF-8</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Individual Publisher Scrapers */}
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>
                        Éditeurs & Sources Individuelles
                    </h3>

                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                        gap: "16px"
                    }}>
                        {PUBLISHERS.map((pub) => (
                            <div
                                key={pub.id}
                                style={{
                                    background: "var(--card-bg, #1e1e24)",
                                    border: "1px solid var(--border-color, #2a2a32)",
                                    borderRadius: "14px",
                                    padding: "20px",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "14px",
                                    position: "relative",
                                    overflow: "hidden"
                                }}
                            >
                                <div style={{
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    width: "4px",
                                    height: "100%",
                                    backgroundColor: pub.color
                                }} />

                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                    <div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                            <span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: pub.color }} />
                                            <h4 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700 }}>{pub.name}</h4>
                                        </div>
                                        <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--text-muted, #9ca3af)" }}>
                                            {pub.desc}
                                        </p>
                                    </div>
                                </div>

                                <div style={{ display: "flex", gap: "8px", marginTop: "auto", paddingTop: "8px" }}>
                                    <button
                                        onClick={() => handleTriggerScrape(pub.id, false)}
                                        disabled={loading || status?.is_running}
                                        style={{
                                            flex: 1,
                                            display: "inline-flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            gap: "6px",
                                            padding: "8px 12px",
                                            borderRadius: "8px",
                                            background: "rgba(255, 255, 255, 0.05)",
                                            border: "1px solid rgba(255, 255, 255, 0.12)",
                                            color: "var(--text-primary, #fff)",
                                            fontSize: "0.8rem",
                                            fontWeight: 600,
                                            cursor: status?.is_running ? "not-allowed" : "pointer"
                                        }}
                                    >
                                        <FontAwesomeIcon icon={faBolt} style={{ color: pub.color }} />
                                        <span>Scan Rapide</span>
                                    </button>

                                    <button
                                        onClick={() => handleTriggerScrape(pub.id, true)}
                                        disabled={loading || status?.is_running}
                                        style={{
                                            flex: 1,
                                            display: "inline-flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            gap: "6px",
                                            padding: "8px 12px",
                                            borderRadius: "8px",
                                            background: "rgba(255, 255, 255, 0.05)",
                                            border: "1px solid rgba(255, 255, 255, 0.12)",
                                            color: "var(--text-primary, #fff)",
                                            fontSize: "0.8rem",
                                            fontWeight: 600,
                                            cursor: status?.is_running ? "not-allowed" : "pointer"
                                        }}
                                    >
                                        <FontAwesomeIcon icon={faLayerGroup} style={{ color: pub.color }} />
                                        <span>Scan Complet</span>
                                    </button>
                                </div>
                            </div>
                        ))}
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
                                                    background: job.status === "completed" ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                                                    color: job.status === "completed" ? "#10b981" : "#ef4444"
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
