import { WrapperHeader } from "../../components/Wrapper/Wrapper.tsx";
import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faWrench,
    faClone,
    faBroom,
    faCheck,
    faRotate,
    faCircleCheck,
    faTriangleExclamation,
    faBookOpen,
    faLayerGroup,
    faBuilding,
    faUsers
} from "@fortawesome/free-solid-svg-icons";
import useSession from "../../hooks/UseSession.tsx";
import "./AdminMaintenancePage.scss";

interface MaintenanceStats {
    total_books: number;
    total_series: number;
    total_editors: number;
    total_authors: number;
}

interface MaintenanceResult {
    taskName: string;
    type: "success" | "error";
    message: string;
    timestamp: string;
}

export default function AdminMaintenancePage() {
    const session = useSession();
    const [stats, setStats] = useState<MaintenanceStats | null>(null);
    const [serverConnected, setServerConnected] = useState<boolean | null>(null);
    const [loadingTask, setLoadingTask] = useState<"utf8" | "dedup" | "all" | null>(null);
    const [result, setResult] = useState<MaintenanceResult | null>(null);

    const fetchStats = async () => {
        try {
            const resp = await session.customFetch("/admin/scrapers/maintenance/stats", { method: "GET" });
            if (resp.ok) {
                const data = await resp.json();
                if (data.stats) {
                    setStats(data.stats);
                    setServerConnected(true);
                    return;
                }
            }

            // Fallback status check
            const statusResp = await session.customFetch("/admin/scrapers/status", { method: "GET" });
            if (statusResp.ok) {
                const sData = await statusResp.json();
                setServerConnected(sData.connected !== false);
            } else {
                setServerConnected(false);
            }
        } catch {
            setServerConnected(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    const nowFormatted = () => {
        const d = new Date();
        return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    };

    const handleRepairUtf8 = async () => {
        setLoadingTask("utf8");
        setResult(null);
        try {
            const resp = await session.customFetch("/admin/scrapers/repair", {
                method: "POST"
            });
            const data = await resp.json();
            setResult({
                taskName: "Réparation UTF-8",
                type: "success",
                message: data.message || "Nettoyage et réparation UTF-8 terminés avec succès !",
                timestamp: nowFormatted()
            });
            await fetchStats();
        } catch (err: any) {
            setResult({
                taskName: "Réparation UTF-8",
                type: "error",
                message: err?.message || "Erreur lors de l'exécution de la réparation UTF-8.",
                timestamp: nowFormatted()
            });
        } finally {
            setLoadingTask(null);
        }
    };

    const handleDeduplicate = async () => {
        setLoadingTask("dedup");
        setResult(null);
        try {
            const resp = await session.customFetch("/admin/scrapers/deduplicate", {
                method: "POST"
            });
            const data = await resp.json();
            setResult({
                taskName: "Déduplication",
                type: "success",
                message: data.message || "Déduplication des albums terminée avec succès !",
                timestamp: nowFormatted()
            });
            await fetchStats();
        } catch (err: any) {
            setResult({
                taskName: "Déduplication",
                type: "error",
                message: err?.message || "Erreur lors de la déduplication des albums.",
                timestamp: nowFormatted()
            });
        } finally {
            setLoadingTask(null);
        }
    };

    const handleRunAll = async () => {
        setLoadingTask("all");
        setResult(null);
        try {
            // 1. Repair UTF8
            const respRepair = await session.customFetch("/admin/scrapers/repair", { method: "POST" });
            const dataRepair = await respRepair.json();

            // 2. Deduplicate
            const respDedup = await session.customFetch("/admin/scrapers/deduplicate", { method: "POST" });
            const dataDedup = await respDedup.json();

            const combinedMsg = `${dataRepair.message || "Réparation UTF-8 effectuée."} | ${dataDedup.message || "Déduplication effectuée."}`;
            setResult({
                taskName: "Maintenance complète",
                type: "success",
                message: combinedMsg,
                timestamp: nowFormatted()
            });
            await fetchStats();
        } catch (err: any) {
            setResult({
                taskName: "Maintenance complète",
                type: "error",
                message: err?.message || "Erreur lors de la maintenance complète.",
                timestamp: nowFormatted()
            });
        } finally {
            setLoadingTask(null);
        }
    };

    return (
        <div className="admin-maintenance">
            <WrapperHeader>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", flexWrap: "wrap", gap: "12px" }}>
                    <div className="admin-maintenance__header-title">
                        <h2>Maintenance</h2>
                        <p>Administration / Maintenance</p>
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
                        <span>{serverConnected ? "Microservice Connecté" : "Microservice Injoignable"}</span>
                    </div>
                </div>
            </WrapperHeader>

            <div className="admin-maintenance__content">
                {/* Result Message */}
                {result && (
                    <div className={`admin-maintenance__result admin-maintenance__result--${result.type}`}>
                        <div className="admin-maintenance__result-content">
                            <FontAwesomeIcon icon={result.type === "success" ? faCheck : faTriangleExclamation} />
                            <span><strong>{result.taskName} :</strong> {result.message}</span>
                        </div>
                        <div className="admin-maintenance__result-time">
                            Exécuté à {result.timestamp}
                        </div>
                    </div>
                )}

                {/* Metrics */}
                <div className="admin-maintenance__metrics">
                    <div className="admin-maintenance__metric-card">
                        <div className="admin-maintenance__metric-icon admin-maintenance__metric-icon--books">
                            <FontAwesomeIcon icon={faBookOpen} />
                        </div>
                        <div className="admin-maintenance__metric-info">
                            <span className="admin-maintenance__metric-label">Tomes en base</span>
                            <span className="admin-maintenance__metric-value">{stats ? stats.total_books.toLocaleString() : "..."}</span>
                        </div>
                    </div>

                    <div className="admin-maintenance__metric-card">
                        <div className="admin-maintenance__metric-icon admin-maintenance__metric-icon--series">
                            <FontAwesomeIcon icon={faLayerGroup} />
                        </div>
                        <div className="admin-maintenance__metric-info">
                            <span className="admin-maintenance__metric-label">Séries créées</span>
                            <span className="admin-maintenance__metric-value">{stats ? stats.total_series.toLocaleString() : "..."}</span>
                        </div>
                    </div>

                    <div className="admin-maintenance__metric-card">
                        <div className="admin-maintenance__metric-icon admin-maintenance__metric-icon--editors">
                            <FontAwesomeIcon icon={faBuilding} />
                        </div>
                        <div className="admin-maintenance__metric-info">
                            <span className="admin-maintenance__metric-label">Éditeurs</span>
                            <span className="admin-maintenance__metric-value">{stats ? stats.total_editors.toLocaleString() : "..."}</span>
                        </div>
                    </div>

                    <div className="admin-maintenance__metric-card">
                        <div className="admin-maintenance__metric-icon admin-maintenance__metric-icon--authors">
                            <FontAwesomeIcon icon={faUsers} />
                        </div>
                        <div className="admin-maintenance__metric-info">
                            <span className="admin-maintenance__metric-label">Auteurs</span>
                            <span className="admin-maintenance__metric-value">{stats ? stats.total_authors.toLocaleString() : "..."}</span>
                        </div>
                    </div>
                </div>

                {/* Maintenance Tasks Cards */}
                <div className="admin-maintenance__actions-grid">
                    {/* Task 1: UTF-8 Mojibake Repair */}
                    <div className="admin-maintenance__card admin-maintenance__card--utf8">
                        <div>
                            <div className="admin-maintenance__card-header">
                                <div className="admin-maintenance__card-icon admin-maintenance__card-icon--utf8">
                                    <FontAwesomeIcon icon={faWrench} />
                                </div>
                                <div className="admin-maintenance__card-title-group">
                                    <h3>Réparer l'UTF-8</h3>
                                    <span>Encodage & Typographie</span>
                                </div>
                            </div>
                            <p className="admin-maintenance__card-desc" style={{ marginTop: "16px" }}>
                                Analyse la base pour détecter et réparer les caractères altérés par un double encodage UTF-8 (ex: <em>dÃ©mon</em> &rarr; <em>démon</em>), normalise les tirets Unicode cadratins (–, —), supprime les rôles parasites d'auteurs et consolide les séries corrompues.
                            </p>
                        </div>

                        <div className="admin-maintenance__card-footer">
                            <button
                                type="button"
                                className="admin-maintenance__btn admin-maintenance__btn--indigo"
                                onClick={handleRepairUtf8}
                                disabled={loadingTask !== null}
                            >
                                <FontAwesomeIcon icon={loadingTask === "utf8" ? faRotate : faWrench} spin={loadingTask === "utf8"} />
                                <span>{loadingTask === "utf8" ? "Réparation en cours..." : "Lancer la réparation UTF-8"}</span>
                            </button>
                        </div>
                    </div>

                    {/* Task 2: Deduplication */}
                    <div className="admin-maintenance__card admin-maintenance__card--dedup">
                        <div>
                            <div className="admin-maintenance__card-header">
                                <div className="admin-maintenance__card-icon admin-maintenance__card-icon--dedup">
                                    <FontAwesomeIcon icon={faClone} />
                                </div>
                                <div className="admin-maintenance__card-title-group">
                                    <h3>Dédupliquer les albums</h3>
                                    <span>Intégrité du catalogue</span>
                                </div>
                            </div>
                            <p className="admin-maintenance__card-desc" style={{ marginTop: "16px" }}>
                                Recherche et fusionne les albums en double d'un même éditeur (ayant une couverture identique, un même ISBN, ou des titres quasi-identiques avec différences de ponctuation/tirets). Réattribue automatiquement vos lectures et possessions vers le tome canonique sans perte de données.
                            </p>
                        </div>

                        <div className="admin-maintenance__card-footer">
                            <button
                                type="button"
                                className="admin-maintenance__btn admin-maintenance__btn--primary"
                                onClick={handleDeduplicate}
                                disabled={loadingTask !== null}
                            >
                                <FontAwesomeIcon icon={loadingTask === "dedup" ? faRotate : faClone} spin={loadingTask === "dedup"} />
                                <span>{loadingTask === "dedup" ? "Déduplication en cours..." : "Lancer la déduplication"}</span>
                            </button>
                        </div>
                    </div>

                    {/* Task 3: Global Maintenance */}
                    <div className="admin-maintenance__card admin-maintenance__card--all">
                        <div>
                            <div className="admin-maintenance__card-header">
                                <div className="admin-maintenance__card-icon admin-maintenance__card-icon--all">
                                    <FontAwesomeIcon icon={faBroom} />
                                </div>
                                <div className="admin-maintenance__card-title-group">
                                    <h3>Maintenance complète</h3>
                                    <span>Nettoyage global</span>
                                </div>
                            </div>
                            <p className="admin-maintenance__card-desc" style={{ marginTop: "16px" }}>
                                Lance consécutivement la réparation intégrale de l'encodage UTF-8, la consolidation des séries et la déduplication de tous les albums pour un catalogue 100% propre et optimisé.
                            </p>
                        </div>

                        <div className="admin-maintenance__card-footer">
                            <button
                                type="button"
                                className="admin-maintenance__btn admin-maintenance__btn--amber"
                                onClick={handleRunAll}
                                disabled={loadingTask !== null}
                            >
                                <FontAwesomeIcon icon={loadingTask === "all" ? faRotate : faBroom} spin={loadingTask === "all"} />
                                <span>{loadingTask === "all" ? "Maintenance globale..." : "Exécuter tout"}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
