import { WrapperHeader } from "../../components/Wrapper/Wrapper.tsx";
import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faCheck,
    faRotate,
    faCircleCheck,
    faTriangleExclamation,
    faBookOpen,
    faCodeBranch,
    faChevronDown,
    faChevronUp,
    faTag
} from "@fortawesome/free-solid-svg-icons";
import useSession from "../../hooks/UseSession.tsx";
import "./AdminConflictsPage.scss";

interface ConflictingBook {
    id: number;
    title: string;
    volume: number | null;
    isbn?: string | null;
    price?: number | null;
    page_count?: number | null;
    release_date?: string | null;
    cover_url?: string | null;
    collection_name?: string | null;
}

interface SeriesConflict {
    series_id: number;
    series_name: string;
    conflicting_volume: number;
    books: ConflictingBook[];
}

interface ActionResult {
    type: "success" | "error";
    message: string;
    timestamp: string;
}

export default function AdminConflictsPage() {
    const session = useSession();
    const [serverConnected, setServerConnected] = useState<boolean | null>(null);
    const [conflicts, setConflicts] = useState<SeriesConflict[]>([]);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<ActionResult | null>(null);

    const [expandedSeries, setExpandedSeries] = useState<Record<number, boolean>>({});
    const [selectedBooksBySeries, setSelectedBooksBySeries] = useState<Record<number, number[]>>({});
    const [newSeriesNames, setNewSeriesNames] = useState<Record<number, string>>({});
    const [splitProcessing, setSplitProcessing] = useState<number | null>(null);

    const nowFormatted = () => {
        const d = new Date();
        return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    };

    const fetchConflicts = async () => {
        setLoading(true);
        try {
            const resp = await session.customFetch("/admin/scrapers/maintenance/conflicts", { method: "GET" });
            if (resp.ok) {
                const data = await resp.json();
                const list: SeriesConflict[] = data.conflicts || [];
                setConflicts(list);
                setServerConnected(true);

                const defaultSelections: Record<number, number[]> = {};
                const defaultNames: Record<number, string> = {};
                const defaultExpanded: Record<number, boolean> = {};

                list.forEach((s) => {
                    defaultExpanded[s.series_id] = true;

                    const hasPoche = s.books.some(
                        b => b.title.toLowerCase().includes("poche") ||
                        (b.page_count && b.page_count <= 300 && b.price && b.price <= 10)
                    );
                    defaultNames[s.series_id] = hasPoche ? `${s.series_name} (Poche)` : `${s.series_name} (Autre édition)`;

                    const toDetach: number[] = [];
                    s.books.forEach(b => {
                        if (
                            b.title.toLowerCase().includes("poche") ||
                            b.title.toLowerCase().includes("variante") ||
                            b.title.toLowerCase().includes("collector") ||
                            (b.page_count && b.page_count <= 300 && b.price && b.price <= 10)
                        ) {
                            toDetach.push(b.id);
                        }
                    });
                    defaultSelections[s.series_id] = toDetach;
                });

                setSelectedBooksBySeries(defaultSelections);
                setNewSeriesNames(defaultNames);
                setExpandedSeries(defaultExpanded);
            } else {
                setServerConnected(false);
            }
        } catch {
            setServerConnected(false);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConflicts();
    }, []);

    const toggleBookSelection = (seriesId: number, bookId: number) => {
        setSelectedBooksBySeries(prev => {
            const current = prev[seriesId] || [];
            const next = current.includes(bookId)
                ? current.filter(id => id !== bookId)
                : [...current, bookId];
            return { ...prev, [seriesId]: next };
        });
    };

    const handleSplitSeries = async (series: SeriesConflict) => {
        const booksToMove = selectedBooksBySeries[series.series_id] || [];
        const newName = (newSeriesNames[series.series_id] || "").trim();

        if (booksToMove.length === 0) {
            alert("Veuillez sélectionner au moins un tome à détacher.");
            return;
        }
        if (!newName) {
            alert("Veuillez renseigner un nom pour la nouvelle série.");
            return;
        }

        setSplitProcessing(series.series_id);
        try {
            const resp = await session.customFetch("/admin/scrapers/maintenance/split", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    source_series_id: series.series_id,
                    new_series_name: newName,
                    book_ids: booksToMove
                })
            });

            if (resp.ok) {
                setResult({
                    type: "success",
                    message: `${booksToMove.length} tome(s) déplacés avec succès vers la nouvelle série « ${newName} ».`,
                    timestamp: nowFormatted()
                });
                await fetchConflicts();
            } else {
                const errData = await resp.json().catch(() => ({}));
                setResult({
                    type: "error",
                    message: errData.detail || "Erreur lors de la scission de la série.",
                    timestamp: nowFormatted()
                });
            }
        } catch (e: any) {
            setResult({
                type: "error",
                message: e?.message || "Erreur réseau lors de la scission.",
                timestamp: nowFormatted()
            });
        } finally {
            setSplitProcessing(null);
        }
    };

    return (
        <div className="admin-conflicts">
            <WrapperHeader>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", flexWrap: "wrap", gap: "12px" }}>
                    <div className="admin-conflicts__header-title">
                        <h2>Conflits</h2>
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

            <div className="admin-conflicts__content">
                {/* Result Message */}
                {result && (
                    <div className={`admin-conflicts__result admin-conflicts__result--${result.type}`}>
                        <div className="admin-conflicts__result-content">
                            <FontAwesomeIcon icon={result.type === "success" ? faCheck : faTriangleExclamation} />
                            <span>{result.message}</span>
                        </div>
                        <div className="admin-conflicts__result-time">
                            Effectué à {result.timestamp}
                        </div>
                    </div>
                )}

                {/* Main Panel */}
                <div className="admin-conflicts__panel">
                    <div className="admin-conflicts__panel-header">
                        <div className="admin-conflicts__panel-title-group">
                            <div className="admin-conflicts__panel-title-row">
                                <h3>Gestion des conflits de tomes & Scission</h3>
                                <span className={`admin-conflicts__badge ${conflicts.length > 0 ? "admin-conflicts__badge--warning" : "admin-conflicts__badge--clean"}`}>
                                    {loading ? "Analyse..." : `${conflicts.length} série(s) en conflit`}
                                </span>
                            </div>
                            <p className="admin-conflicts__panel-subtitle">
                                Détectez les séries comportant des tomes en doublon de volume (ex: édition poche vs grand format, intégrales, couvertures variantes) et scindez-les en séries distinctes.
                            </p>
                        </div>

                        <button
                            type="button"
                            className="admin-conflicts__btn-refresh"
                            onClick={fetchConflicts}
                            disabled={loading}
                            title="Réanalyser la base de données"
                        >
                            <FontAwesomeIcon icon={faRotate} spin={loading} />
                            <span>Actualiser</span>
                        </button>
                    </div>

                    {loading ? (
                        <div className="admin-conflicts__loading-state">
                            <FontAwesomeIcon icon={faRotate} spin />
                            <span>Analyse des séries et détection des conflits de volumes...</span>
                        </div>
                    ) : conflicts.length === 0 ? (
                        <div className="admin-conflicts__empty-state">
                            <FontAwesomeIcon icon={faCircleCheck} className="admin-conflicts__empty-icon" />
                            <h4>Toutes vos séries sont parfaitement cohérentes</h4>
                            <p>Aucun doublon de volume n'a été détecté (chaque tome possède un numéro unique au sein de sa série).</p>
                        </div>
                    ) : (
                        <div className="admin-conflicts__list">
                            {conflicts.map((series) => {
                                const isExpanded = Boolean(expandedSeries[series.series_id]);
                                const selectedBookIds = selectedBooksBySeries[series.series_id] || [];
                                const newName = newSeriesNames[series.series_id] || "";
                                const isSplitting = splitProcessing === series.series_id;

                                return (
                                    <div key={series.series_id} className="admin-conflicts__card">
                                        <div
                                            className="admin-conflicts__card-header"
                                            onClick={() => setExpandedSeries(prev => ({ ...prev, [series.series_id]: !isExpanded }))}
                                        >
                                            <div className="admin-conflicts__card-title-group">
                                                <span className="admin-conflicts__series-name">{series.series_name}</span>
                                                <span className="admin-conflicts__vol-badge">
                                                    Conflit sur Volume {series.conflicting_volume}
                                                </span>
                                                <span className="admin-conflicts__count-badge">
                                                    {series.books.length} tomes
                                                </span>
                                            </div>

                                            <div className="admin-conflicts__toggle-icon">
                                                <FontAwesomeIcon icon={isExpanded ? faChevronUp : faChevronDown} />
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="admin-conflicts__card-body">
                                                <p className="admin-conflicts__hint">
                                                    Sélectionnez les tomes à détacher vers une nouvelle série (ex: réédition poche, intégrale, coffret collector) :
                                                </p>

                                                <div className="admin-conflicts__books-grid">
                                                    {series.books.map((b) => {
                                                        const isChecked = selectedBookIds.includes(b.id);
                                                        return (
                                                            <div
                                                                key={b.id}
                                                                className={`admin-conflicts__book-item ${isChecked ? "is-selected" : ""}`}
                                                                onClick={() => toggleBookSelection(series.series_id, b.id)}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    className="admin-checkbox"
                                                                    checked={isChecked}
                                                                    onChange={() => toggleBookSelection(series.series_id, b.id)}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                />
                                                                {b.cover_url ? (
                                                                    <img src={b.cover_url} alt={b.title} className="admin-conflicts__book-cover" />
                                                                ) : (
                                                                    <div className="admin-conflicts__book-cover-placeholder">
                                                                        <FontAwesomeIcon icon={faBookOpen} />
                                                                    </div>
                                                                )}
                                                                <div className="admin-conflicts__book-info">
                                                                    <div className="admin-conflicts__book-title" title={b.title}>
                                                                        {b.title}
                                                                    </div>
                                                                    <div className="admin-conflicts__book-meta">
                                                                        <span className="admin-conflicts__book-vol">Vol. {b.volume || 1}</span>
                                                                        {b.price ? <span>{b.price} €</span> : null}
                                                                        {b.page_count ? <span>{b.page_count} p.</span> : null}
                                                                        {b.release_date ? <span>{b.release_date}</span> : null}
                                                                    </div>
                                                                    {b.collection_name && (
                                                                        <div className="admin-conflicts__book-col">
                                                                            <FontAwesomeIcon icon={faTag} /> {b.collection_name}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                <div className="admin-conflicts__split-bar">
                                                    <div className="admin-conflicts__split-input-group">
                                                        <label htmlFor={`new-series-${series.series_id}`}>
                                                            Nom de la nouvelle série :
                                                        </label>
                                                        <input
                                                            id={`new-series-${series.series_id}`}
                                                            type="text"
                                                            className="admin-conflicts__split-input"
                                                            value={newName}
                                                            onChange={(e) => setNewSeriesNames(prev => ({ ...prev, [series.series_id]: e.target.value }))}
                                                            placeholder="Ex: Tomie (Poche)"
                                                        />
                                                    </div>

                                                    <button
                                                        type="button"
                                                        className="admin-conflicts__btn-split"
                                                        onClick={() => handleSplitSeries(series)}
                                                        disabled={isSplitting || selectedBookIds.length === 0 || !newName.trim()}
                                                    >
                                                        <FontAwesomeIcon icon={isSplitting ? faRotate : faCodeBranch} spin={isSplitting} />
                                                        <span>
                                                            {isSplitting ? "Scission en cours..." : `Scinder la série (${selectedBookIds.length} tome${selectedBookIds.length > 1 ? "s" : ""})`}
                                                        </span>
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
