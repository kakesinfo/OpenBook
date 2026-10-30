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
    faTag,
    faClone,
    faStar,
    faPlus
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
    is_variant_hint?: boolean;
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
    const [actionModes, setActionModes] = useState<Record<number, "variant" | "split">>({});

    // Split state: user explicitly selects books and series name
    const [splitSelections, setSplitSelections] = useState<Record<number, number[]>>({});
    const [newSeriesNames, setNewSeriesNames] = useState<Record<number, string>>({});
    const [splitProcessing, setSplitProcessing] = useState<number | null>(null);

    // Variant linkage state: user explicitly selects canonical and variant books
    const [canonicalBooks, setCanonicalBooks] = useState<Record<number, number>>({});
    const [variantSelections, setVariantSelections] = useState<Record<number, number[]>>({});
    const [linkProcessing, setLinkProcessing] = useState<number | null>(null);

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

                const defaultExpanded: Record<number, boolean> = {};
                const defaultModes: Record<number, "variant" | "split"> = {};
                const defaultCanonicals: Record<number, number> = {};

                list.forEach((s) => {
                    defaultExpanded[s.series_id] = true;
                    // Neutral or hinted mode
                    defaultModes[s.series_id] = s.books.some(b => b.is_variant_hint) ? "variant" : "split";

                    // Set first book as canonical reference for variant mode
                    const canonical = s.books.find(b => !b.is_variant_hint) || s.books[0];
                    if (canonical) {
                        defaultCanonicals[s.series_id] = canonical.id;
                    }
                });

                // Do NOT pre-check selections: let the user choose explicitly!
                setSplitSelections({});
                setVariantSelections({});
                setNewSeriesNames({});
                setExpandedSeries(defaultExpanded);
                setActionModes(defaultModes);
                setCanonicalBooks(defaultCanonicals);
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

    // Split handlers
    const toggleSplitSelection = (seriesId: number, bookId: number) => {
        setSplitSelections(prev => {
            const current = prev[seriesId] || [];
            const next = current.includes(bookId)
                ? current.filter(id => id !== bookId)
                : [...current, bookId];
            return { ...prev, [seriesId]: next };
        });
    };

    const selectAllForSplit = (series: SeriesConflict) => {
        setSplitSelections(prev => ({
            ...prev,
            [series.series_id]: series.books.map(b => b.id)
        }));
    };

    const clearSplitSelections = (seriesId: number) => {
        setSplitSelections(prev => ({ ...prev, [seriesId]: [] }));
    };

    // Variant handlers
    const setCanonicalBook = (seriesId: number, bookId: number) => {
        setCanonicalBooks(prev => ({ ...prev, [seriesId]: bookId }));
        // Ensure this book is not in variant selections
        setVariantSelections(prev => {
            const current = prev[seriesId] || [];
            return { ...prev, [seriesId]: current.filter(id => id !== bookId) };
        });
    };

    const toggleVariantSelection = (seriesId: number, bookId: number) => {
        setVariantSelections(prev => {
            const current = prev[seriesId] || [];
            const next = current.includes(bookId)
                ? current.filter(id => id !== bookId)
                : [...current, bookId];
            return { ...prev, [seriesId]: next };
        });
    };

    const selectAllOthersAsVariants = (series: SeriesConflict) => {
        const canonicalId = canonicalBooks[series.series_id] || series.books[0]?.id;
        const others = series.books.filter(b => b.id !== canonicalId).map(b => b.id);
        setVariantSelections(prev => ({ ...prev, [series.series_id]: others }));
    };

    const clearVariantSelections = (seriesId: number) => {
        setVariantSelections(prev => ({ ...prev, [seriesId]: [] }));
    };

    const handleSplitSeries = async (series: SeriesConflict) => {
        const booksToMove = splitSelections[series.series_id] || [];
        const newName = (newSeriesNames[series.series_id] || "").trim();

        if (booksToMove.length === 0) {
            alert("Veuillez sélectionner au moins un album à déplacer dans la nouvelle série.");
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
                    message: `${booksToMove.length} album(s) déplacés avec succès vers la nouvelle série « ${newName} ».`,
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

    const handleLinkVariant = async (series: SeriesConflict) => {
        const parentId = canonicalBooks[series.series_id];
        const allVariants = variantSelections[series.series_id] || [];
        const variantIds = allVariants.filter(id => id !== parentId);

        if (!parentId) {
            alert("Veuillez désigner l'album principal.");
            return;
        }
        if (variantIds.length === 0) {
            alert("Veuillez cocher au moins un album à lier en tant que couverture variante.");
            return;
        }

        setLinkProcessing(series.series_id);
        try {
            const resp = await session.customFetch("/admin/scrapers/maintenance/link-variant", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    parent_book_id: parentId,
                    variant_book_ids: variantIds
                })
            });

            if (resp.ok) {
                setResult({
                    type: "success",
                    message: `${variantIds.length} album(s) lié(s) comme couverture variante avec succès.`,
                    timestamp: nowFormatted()
                });
                await fetchConflicts();
            } else {
                const errData = await resp.json().catch(() => ({}));
                setResult({
                    type: "error",
                    message: errData.detail || "Erreur lors de la liaison des variantes.",
                    timestamp: nowFormatted()
                });
            }
        } catch (e: any) {
            setResult({
                type: "error",
                message: e?.message || "Erreur réseau lors de la liaison.",
                timestamp: nowFormatted()
            });
        } finally {
            setLinkProcessing(null);
        }
    };

    return (
        <div className="admin-conflicts">
            <WrapperHeader>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", flexWrap: "wrap", gap: "12px" }}>
                    <div className="admin-conflicts__header-title">
                        <h2>Gestion des Conflits & Variantes</h2>
                    </div>

                    <div style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "6px 14px",
                        borderRadius: "20px",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        background: serverConnected ? "var(--accent-primary-light)" : "rgba(239, 68, 68, 0.12)",
                        color: serverConnected ? "var(--accent-primary)" : "#ef4444",
                        border: `1px solid ${serverConnected ? "var(--border-focus)" : "rgba(239, 68, 68, 0.3)"}`
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
                                <h3>Résolution des conflits de tomes</h3>
                                <span className={`admin-conflicts__badge ${conflicts.length > 0 ? "admin-conflicts__badge--warning" : "admin-conflicts__badge--clean"}`}>
                                    {loading ? "Analyse..." : `${conflicts.length} série(s) en conflit`}
                                </span>
                            </div>
                            <p className="admin-conflicts__panel-subtitle">
                                Pour chaque série présentant des doublons de volume, choisissez vous-même l'action appropriée : rattacher des couvertures alternatives au tome principal ou scinder les albums vers une nouvelle série indépendante.
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
                            <span>Analyse des séries et détection des conflits de tomes...</span>
                        </div>
                    ) : conflicts.length === 0 ? (
                        <div className="admin-conflicts__empty-state">
                            <FontAwesomeIcon icon={faCircleCheck} className="admin-conflicts__empty-icon" />
                            <h4>Toutes vos séries sont parfaitement cohérentes</h4>
                            <p>Aucun doublon de volume non lié n'a été détecté dans votre catalogue.</p>
                        </div>
                    ) : (
                        <div className="admin-conflicts__list">
                            {conflicts.map((series) => {
                                const isExpanded = Boolean(expandedSeries[series.series_id]);
                                const mode = actionModes[series.series_id] || "variant";

                                // Split variables
                                const selectedSplitIds = splitSelections[series.series_id] || [];
                                const newName = newSeriesNames[series.series_id] || "";
                                const isSplitting = splitProcessing === series.series_id;

                                // Variant variables
                                const canonicalId = canonicalBooks[series.series_id] || series.books[0]?.id;
                                const selectedVariantIds = (variantSelections[series.series_id] || []).filter(id => id !== canonicalId);
                                const isLinking = linkProcessing === series.series_id;
                                const canonicalBook = series.books.find(b => b.id === canonicalId) || series.books[0];

                                return (
                                    <div key={series.series_id} className="admin-conflicts__card">
                                        <div
                                            className="admin-conflicts__card-header"
                                            onClick={() => setExpandedSeries(prev => ({ ...prev, [series.series_id]: !isExpanded }))}
                                        >
                                            <div className="admin-conflicts__card-title-group">
                                                <span className="admin-conflicts__series-name">{series.series_name}</span>
                                                <span className="admin-conflicts__vol-badge">
                                                    Conflit Volume {series.conflicting_volume}
                                                </span>
                                                <span className="admin-conflicts__count-badge">
                                                    {series.books.length} tomes au total
                                                </span>
                                            </div>

                                            <div className="admin-conflicts__toggle-icon">
                                                <FontAwesomeIcon icon={isExpanded ? faChevronUp : faChevronDown} />
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="admin-conflicts__card-body">
                                                {/* Action Choice Pills */}
                                                <div className="admin-conflicts__choice-section">
                                                    <span className="admin-conflicts__choice-title">
                                                        Que souhaitez-vous faire pour cette série ?
                                                    </span>

                                                    <div className="admin-conflicts__mode-pills">
                                                        <button
                                                            type="button"
                                                            className={`admin-conflicts__mode-pill ${mode === "variant" ? "admin-conflicts__mode-pill--active-variant" : ""}`}
                                                            onClick={() => setActionModes(prev => ({ ...prev, [series.series_id]: "variant" }))}
                                                        >
                                                            <div className="admin-conflicts__mode-pill-icon">
                                                                <FontAwesomeIcon icon={faClone} />
                                                            </div>
                                                            <div className="admin-conflicts__mode-pill-content">
                                                                <div className="admin-conflicts__mode-pill-heading">
                                                                    <strong>Lier des couvertures variantes</strong>
                                                                    {series.books.some(b => b.is_variant_hint) && (
                                                                        <span className="admin-conflicts__pill-hint-tag">Suggéré</span>
                                                                    )}
                                                                </div>
                                                                <p>Associer des éditions variantes, collectors ou N&B à un album principal de référence.</p>
                                                            </div>
                                                        </button>

                                                        <button
                                                            type="button"
                                                            className={`admin-conflicts__mode-pill ${mode === "split" ? "admin-conflicts__mode-pill--active-split" : ""}`}
                                                            onClick={() => setActionModes(prev => ({ ...prev, [series.series_id]: "split" }))}
                                                        >
                                                            <div className="admin-conflicts__mode-pill-icon">
                                                                <FontAwesomeIcon icon={faCodeBranch} />
                                                            </div>
                                                            <div className="admin-conflicts__mode-pill-content">
                                                                <div className="admin-conflicts__mode-pill-heading">
                                                                    <strong>Scinder en nouvelle série</strong>
                                                                </div>
                                                                <p>Déplacer des albums (ex: édition poche, réédition intégrale) vers une série distincte.</p>
                                                            </div>
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Mode 1: Lier comme couvertures variantes */}
                                                {mode === "variant" && (
                                                    <div className="admin-conflicts__mode-view">
                                                        <div className="admin-conflicts__instructions-bar">
                                                            <p className="admin-conflicts__hint">
                                                                1. Choisissez l'<strong>album principal</strong> (bouton radio) — 2. Cochez les <strong>couvertures variantes</strong> à lui rattacher :
                                                            </p>
                                                            <div className="admin-conflicts__quick-actions">
                                                                <button
                                                                    type="button"
                                                                    className="admin-conflicts__btn-text"
                                                                    onClick={() => selectAllOthersAsVariants(series)}
                                                                >
                                                                    Cocher toutes les autres
                                                                </button>
                                                                <span className="admin-conflicts__quick-sep">•</span>
                                                                <button
                                                                    type="button"
                                                                    className="admin-conflicts__btn-text"
                                                                    onClick={() => clearVariantSelections(series.series_id)}
                                                                >
                                                                    Tout décocher
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div className="admin-conflicts__books-grid">
                                                            {series.books.map((b) => {
                                                                const isCanonical = b.id === canonicalId;
                                                                const isVariantChecked = selectedVariantIds.includes(b.id);
                                                                const isConflictVol = b.volume === series.conflicting_volume;

                                                                return (
                                                                    <div
                                                                        key={b.id}
                                                                        className={`admin-conflicts__book-item ${isCanonical ? "is-canonical" : isVariantChecked ? "is-variant-checked" : ""}`}
                                                                        onClick={() => {
                                                                            if (!isCanonical) {
                                                                                toggleVariantSelection(series.series_id, b.id);
                                                                            }
                                                                        }}
                                                                    >
                                                                        <div className="admin-conflicts__book-controls" onClick={(e) => e.stopPropagation()}>
                                                                            <label className="admin-conflicts__choice-radio" title="Définir comme édition de référence (Album principal)">
                                                                                <input
                                                                                    type="radio"
                                                                                    name={`canonical_${series.series_id}`}
                                                                                    checked={isCanonical}
                                                                                    onChange={() => setCanonicalBook(series.series_id, b.id)}
                                                                                />
                                                                                <span>Principal</span>
                                                                            </label>

                                                                            {!isCanonical && (
                                                                                <label className="admin-conflicts__choice-check" title="Cocher pour lier comme couverture variante de l'album principal">
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={isVariantChecked}
                                                                                        onChange={() => toggleVariantSelection(series.series_id, b.id)}
                                                                                    />
                                                                                    <span>Variante</span>
                                                                                </label>
                                                                            )}
                                                                        </div>

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

                                                                            <div className="admin-conflicts__badges-row">
                                                                                {isCanonical && (
                                                                                    <span className="admin-conflicts__role-badge admin-conflicts__role-badge--canonical">
                                                                                        <FontAwesomeIcon icon={faStar} /> Album Principal
                                                                                    </span>
                                                                                )}
                                                                                {!isCanonical && isVariantChecked && (
                                                                                    <span className="admin-conflicts__role-badge admin-conflicts__role-badge--variant">
                                                                                        <FontAwesomeIcon icon={faClone} /> Variante
                                                                                    </span>
                                                                                )}
                                                                                {isConflictVol && (
                                                                                    <span className="admin-conflicts__role-badge admin-conflicts__role-badge--conflict">
                                                                                        Vol. {b.volume} en doublon
                                                                                    </span>
                                                                                )}
                                                                                {b.is_variant_hint && (
                                                                                    <span className="admin-conflicts__role-badge admin-conflicts__role-badge--hint">
                                                                                        Mot-clé détecté
                                                                                    </span>
                                                                                )}
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

                                                        <div className="admin-conflicts__action-bar admin-conflicts__action-bar--variant">
                                                            <div className="admin-conflicts__action-summary">
                                                                <span>
                                                                    Album standard : <strong>{canonicalBook?.title}</strong>
                                                                </span>
                                                                <span className="admin-conflicts__dot-sep">•</span>
                                                                <span>
                                                                    <strong>{selectedVariantIds.length}</strong> variante(s) sélectionnée(s) à lui rattacher
                                                                </span>
                                                            </div>

                                                            <button
                                                                type="button"
                                                                className="admin-conflicts__btn-variant"
                                                                onClick={() => handleLinkVariant(series)}
                                                                disabled={isLinking || selectedVariantIds.length === 0}
                                                            >
                                                                <FontAwesomeIcon icon={isLinking ? faRotate : faClone} spin={isLinking} />
                                                                <span>
                                                                    {isLinking ? "Liaison en cours..." : `Lier comme couverture variante (${selectedVariantIds.length})`}
                                                                </span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Mode 2: Scinder en nouvelle série */}
                                                {mode === "split" && (
                                                    <div className="admin-conflicts__mode-view">
                                                        <div className="admin-conflicts__instructions-bar">
                                                            <p className="admin-conflicts__hint">
                                                                Cochez les albums que vous souhaitez <strong>déplacer dans une nouvelle série</strong> :
                                                            </p>
                                                            <div className="admin-conflicts__quick-actions">
                                                                <button
                                                                    type="button"
                                                                    className="admin-conflicts__btn-text"
                                                                    onClick={() => selectAllForSplit(series)}
                                                                >
                                                                    Tout cocher
                                                                </button>
                                                                <span className="admin-conflicts__quick-sep">•</span>
                                                                <button
                                                                    type="button"
                                                                    className="admin-conflicts__btn-text"
                                                                    onClick={() => clearSplitSelections(series.series_id)}
                                                                >
                                                                    Tout décocher
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div className="admin-conflicts__books-grid">
                                                            {series.books.map((b) => {
                                                                const isChecked = selectedSplitIds.includes(b.id);
                                                                const isConflictVol = b.volume === series.conflicting_volume;

                                                                return (
                                                                    <div
                                                                        key={b.id}
                                                                        className={`admin-conflicts__book-item ${isChecked ? "is-split-checked" : ""}`}
                                                                        onClick={() => toggleSplitSelection(series.series_id, b.id)}
                                                                    >
                                                                        <div className="admin-conflicts__book-controls" onClick={(e) => e.stopPropagation()}>
                                                                            <label className="admin-conflicts__choice-check" title="Cocher pour déplacer dans la nouvelle série">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={isChecked}
                                                                                    onChange={() => toggleSplitSelection(series.series_id, b.id)}
                                                                                />
                                                                                <span>Déplacer</span>
                                                                            </label>
                                                                        </div>

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

                                                                            <div className="admin-conflicts__badges-row">
                                                                                {isChecked && (
                                                                                    <span className="admin-conflicts__role-badge admin-conflicts__role-badge--split">
                                                                                        <FontAwesomeIcon icon={faCodeBranch} /> À déplacer
                                                                                    </span>
                                                                                )}
                                                                                {isConflictVol && (
                                                                                    <span className="admin-conflicts__role-badge admin-conflicts__role-badge--conflict">
                                                                                        Vol. {b.volume} en doublon
                                                                                    </span>
                                                                                )}
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

                                                        <div className="admin-conflicts__split-config">
                                                            <div className="admin-conflicts__split-input-wrapper">
                                                                <label htmlFor={`new-series-${series.series_id}`}>
                                                                    Nom de la nouvelle série :
                                                                </label>
                                                                <input
                                                                    id={`new-series-${series.series_id}`}
                                                                    type="text"
                                                                    className="admin-conflicts__split-input"
                                                                    value={newName}
                                                                    onChange={(e) => setNewSeriesNames(prev => ({ ...prev, [series.series_id]: e.target.value }))}
                                                                    placeholder={`Ex: ${series.series_name} (Poche)`}
                                                                />
                                                            </div>

                                                            {/* Suggestions pills */}
                                                            <div className="admin-conflicts__suggestions">
                                                                <span className="admin-conflicts__suggestions-label">Suggestions :</span>
                                                                <button
                                                                    type="button"
                                                                    className="admin-conflicts__suggestion-pill"
                                                                    onClick={() => setNewSeriesNames(prev => ({ ...prev, [series.series_id]: `${series.series_name} (Poche)` }))}
                                                                >
                                                                    <FontAwesomeIcon icon={faPlus} /> {series.series_name} (Poche)
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="admin-conflicts__suggestion-pill"
                                                                    onClick={() => setNewSeriesNames(prev => ({ ...prev, [series.series_id]: `${series.series_name} (Autre édition)` }))}
                                                                >
                                                                    <FontAwesomeIcon icon={faPlus} /> {series.series_name} (Autre édition)
                                                                </button>
                                                                {series.books.filter(b => selectedSplitIds.includes(b.id)).map(b => (
                                                                    <button
                                                                        key={b.id}
                                                                        type="button"
                                                                        className="admin-conflicts__suggestion-pill"
                                                                        onClick={() => setNewSeriesNames(prev => ({ ...prev, [series.series_id]: b.title }))}
                                                                        title={`Utiliser : ${b.title}`}
                                                                    >
                                                                        <FontAwesomeIcon icon={faPlus} /> {b.title.slice(0, 30)}{b.title.length > 30 ? "..." : ""}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        <div className="admin-conflicts__action-bar admin-conflicts__action-bar--split">
                                                            <div className="admin-conflicts__action-summary">
                                                                <span>
                                                                    <strong>{selectedSplitIds.length}</strong> album(s) sélectionné(s)
                                                                </span>
                                                                {newName.trim() && (
                                                                    <>
                                                                        <span className="admin-conflicts__dot-sep">•</span>
                                                                        <span>
                                                                            Vers « <strong>{newName.trim()}</strong> »
                                                                        </span>
                                                                    </>
                                                                )}
                                                            </div>

                                                            <button
                                                                type="button"
                                                                className="admin-conflicts__btn-split"
                                                                onClick={() => handleSplitSeries(series)}
                                                                disabled={isSplitting || selectedSplitIds.length === 0 || !newName.trim()}
                                                            >
                                                                <FontAwesomeIcon icon={isSplitting ? faRotate : faCodeBranch} spin={isSplitting} />
                                                                <span>
                                                                    {isSplitting ? "Scission en cours..." : `Scinder la série (${selectedSplitIds.length} album${selectedSplitIds.length > 1 ? "s" : ""})`}
                                                                </span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
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
