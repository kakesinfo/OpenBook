import { useCallback, useEffect, useState } from "react";
import { WrapperHeader } from "../../components/Wrapper/Wrapper.tsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faCheck,
    faCircleNotch,
    faClock,
    faMagnifyingGlass,
    faRotate,
    faTriangleExclamation,
    faUser
} from "@fortawesome/free-solid-svg-icons";
import { enqueueSnackbar } from "notistack";
import useSession from "../../hooks/UseSession.tsx";
import useLanguage from "../../hooks/UseLanguage.tsx";
import Select from "../../components/Select/Select.tsx";
import { AdminAuditLogDTO, AdminAuditLogPageResponse } from "../../dto/AdminAuditLog.dto.ts";
import "./AdminLogsPage.scss";

function formatDateTime(iso: string, locale: string): string {
    try {
        const d = new Date(iso);
        return d.toLocaleString(locale, {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        });
    } catch {
        return iso;
    }
}

export default function AdminLogsPage() {
    const session = useSession();
    const { language, locale, tr } = useLanguage();

    const [logs, setLogs] = useState<AdminAuditLogDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [totalElements, setTotalElements] = useState(0);

    const [category, setCategory] = useState("ALL");
    const [status, setStatus] = useState("ALL");
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(0);
        }, 250);
        return () => clearTimeout(timer);
    }, [search]);

    const fetchLogs = useCallback(async () => {
        if (!session.token) return;
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: String(page),
                size: "30"
            });
            if (category !== "ALL") params.set("category", category);
            if (status !== "ALL") params.set("status", status);
            if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());

            const res = await session.customFetch(`/admin/logs?${params.toString()}`, {
                method: "GET"
            });
            if (!res.ok) {
                throw new Error(tr("Failed to load audit logs", "Impossible de charger le journal"));
            }
            const data: AdminAuditLogPageResponse = await res.json();
            setLogs(data.logs || []);
            setTotalPages(data.totalPages || 0);
            setTotalElements(data.totalElements || 0);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : tr("Error loading logs", "Erreur de chargement");
            enqueueSnackbar(msg, { variant: "error" });
        } finally {
            setLoading(false);
        }
    }, [session.token, page, category, status, debouncedSearch, language]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const categoryLabel = (cat: string) => {
        switch (cat) {
            case "SCRAPER": return tr("Scraper", "Scraper");
            case "MAINTENANCE": return tr("Maintenance", "Maintenance");
            case "BACKUP": return tr("Backup", "Sauvegarde");
            case "USER": return tr("User", "Utilisateur");
            case "BOOK": return tr("Book", "Livre");
            case "CONFIG": return tr("Config", "Configuration");
            default: return cat;
        }
    };

    const renderStatusBadge = (st: string) => {
        const upper = (st || "").toUpperCase();
        if (upper === "FAILURE") {
            return (
                <span className="admin-logs__status-badge admin-logs__status-badge--failure">
                    <FontAwesomeIcon icon={faTriangleExclamation} />
                    {tr("Failure", "Échec")}
                </span>
            );
        }
        if (upper === "STARTED") {
            return (
                <span className="admin-logs__status-badge admin-logs__status-badge--started">
                    <FontAwesomeIcon icon={faClock} />
                    {tr("Started", "Démarré")}
                </span>
            );
        }
        return (
            <span className="admin-logs__status-badge admin-logs__status-badge--success">
                <FontAwesomeIcon icon={faCheck} />
                {tr("Success", "Succès")}
            </span>
        );
    };

    return (
        <div className="admin-logs">
            <WrapperHeader>
                <div className="admin-logs__header-title">
                    <h2>{tr("Audit Journal", "Journal d'activité")}</h2>
                </div>
            </WrapperHeader>

            <div className="admin-logs__content">
                <div className="admin-logs__toolbar">
                    <div className="admin-logs__filters">
                        <div className="admin-logs__search">
                            <FontAwesomeIcon icon={faMagnifyingGlass} />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder={tr("Search action, actor or comment...", "Rechercher action, acteur, commentaire...")}
                            />
                        </div>

                        <Select
                            className="admin-logs__select-wrap"
                            value={category}
                            onChange={(val) => {
                                setCategory(typeof val === "string" ? val : "ALL");
                                setPage(0);
                            }}
                            options={[
                                { value: "ALL", label: tr("All categories", "Toutes catégories") },
                                { value: "SCRAPER", label: "Scraping" },
                                { value: "MAINTENANCE", label: "Maintenance" },
                                { value: "BACKUP", label: tr("Backups", "Sauvegardes") },
                                { value: "USER", label: tr("Users", "Utilisateurs") },
                                { value: "BOOK", label: tr("Books", "Livres") },
                                { value: "CONFIG", label: tr("Configuration", "Configuration") }
                            ]}
                        />

                        <Select
                            className="admin-logs__select-wrap"
                            value={status}
                            onChange={(val) => {
                                setStatus(typeof val === "string" ? val : "ALL");
                                setPage(0);
                            }}
                            options={[
                                { value: "ALL", label: tr("All statuses", "Tous statuts") },
                                { value: "SUCCESS", label: tr("Success", "Succès") },
                                { value: "FAILURE", label: tr("Failure", "Échec") },
                                { value: "STARTED", label: tr("Started", "Démarré") }
                            ]}
                        />
                    </div>

                    <button
                        type="button"
                        className="admin-logs__refresh-btn"
                        onClick={fetchLogs}
                        disabled={loading}
                    >
                        <FontAwesomeIcon icon={loading ? faCircleNotch : faRotate} spin={loading} />
                        {tr("Refresh", "Actualiser")}
                    </button>
                </div>

                <div className="admin-logs__table-card">
                    <div className="admin-logs__table-scroll">
                        <table className="admin-logs__table">
                            <thead>
                                <tr>
                                    <th>{tr("Date & Time", "Date & Heure")}</th>
                                    <th>{tr("Action", "Action")}</th>
                                    <th>{tr("Actor", "Qui")}</th>
                                    <th>{tr("Status", "Statut")}</th>
                                    <th>{tr("Comment", "Commentaire")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading && logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="admin-logs__empty">
                                            <FontAwesomeIcon icon={faCircleNotch} spin /> {tr("Loading...", "Chargement...")}
                                        </td>
                                    </tr>
                                ) : logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="admin-logs__empty">
                                            {tr("No log entries found.", "Aucune entrée trouvée dans le journal.")}
                                        </td>
                                    </tr>
                                ) : (
                                    logs.map((entry) => {
                                        const isCron = entry.actor === "CRON";
                                        return (
                                            <tr key={entry.id}>
                                                <td className="admin-logs__date">
                                                    {formatDateTime(entry.createdAt, locale)}
                                                </td>
                                                <td>
                                                    <div className="admin-logs__action-cell">
                                                        <span>{entry.action}</span>
                                                        <span className="admin-logs__cat-badge">
                                                            {categoryLabel(entry.category)}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={`admin-logs__actor-badge ${isCron ? "admin-logs__actor-badge--cron" : ""}`}>
                                                        <FontAwesomeIcon icon={isCron ? faClock : faUser} />
                                                        {entry.actor}
                                                    </span>
                                                </td>
                                                <td>{renderStatusBadge(entry.status)}</td>
                                                <td className="admin-logs__comment">
                                                    {entry.comment || "—"}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="admin-logs__pagination">
                        <span>
                            {totalElements} {tr("entry(ies)", "entrée(s)")}
                        </span>
                        <div className="admin-logs__pagination-controls">
                            <button
                                type="button"
                                disabled={page <= 0 || loading}
                                onClick={() => setPage((p) => Math.max(0, p - 1))}
                            >
                                {tr("Previous", "Précédent")}
                            </button>
                            <span>
                                {tr("Page", "Page")} {totalPages === 0 ? 0 : page + 1} / {totalPages}
                            </span>
                            <button
                                type="button"
                                disabled={page + 1 >= totalPages || loading}
                                onClick={() => setPage((p) => p + 1)}
                            >
                                {tr("Next", "Suivant")}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
