import { WrapperHeader } from "../../components/Wrapper/Wrapper.tsx";
import { useEffect, useState, useMemo } from "react";
import useSession from "../../hooks/UseSession.tsx";
import BookList from "../../components/BookList/BookList.tsx";
import BookSummaryDTO from "../../dto/BookSummary.dto.ts";
import UserSeriesSummaryDTO from "../../dto/UserSeriesSummary.dto.ts";
import { Link } from "react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faBook,
    faCompass,
    faLayerGroup,
    faBolt,
    faFire,
    faMagnifyingGlass,
    faXmark,
    faList,
    faBorderAll,
    faBookBookmark,
    faTag,
    faCheck,
    faBookOpen,
    faBan
} from "@fortawesome/free-solid-svg-icons";
import { Dialog } from "@mui/material";
import "./CollectionPage.scss";

type CategoryFilter = "all" | "bd" | "comics" | "manga";
type TomeStatusFilter = "all" | "toread" | "forsale" | "read" | "unread" | "abandoned";

interface CategoryTab {
    id: CategoryFilter;
    label: string;
    icon?: typeof faBook;
}

interface StatusTab {
    id: TomeStatusFilter;
    label: string;
    icon?: typeof faBook;
}

const CATEGORY_TABS: CategoryTab[] = [
    { id: "all", label: "Toutes", icon: faLayerGroup },
    { id: "bd", label: "BD", icon: faBook },
    { id: "comics", label: "Comics", icon: faBolt },
    { id: "manga", label: "Manga", icon: faFire }
];

const STATUS_TABS: StatusTab[] = [
    { id: "all", label: "Tous", icon: faLayerGroup },
    { id: "toread", label: "Pile à lire", icon: faBookBookmark },
    { id: "forsale", label: "À vendre", icon: faTag },
    { id: "read", label: "Lu", icon: faCheck },
    { id: "unread", label: "Non lu", icon: faBookOpen },
    { id: "abandoned", label: "Abandonné", icon: faBan }
];

function normalizeCategory(category?: string | null, type?: string | null): "bd" | "comics" | "manga" {
    const raw = `${category || ""} ${type || ""}`.toLowerCase();
    if (raw.includes("manga")) return "manga";
    if (raw.includes("comic")) return "comics";
    if (raw.includes("bande") || raw.includes("bd") || raw.includes("roman") || raw.includes("cartonné")) return "bd";
    return "comics";
}

function matchesTomeStatus(book: BookSummaryDTO, filter: TomeStatusFilter): boolean {
    if (filter === "all") return true;

    const rStatus = (book.readingStatus || "").toUpperCase();
    const isForSale = book.status === "FOR_SALE";

    if (filter === "forsale") {
        return isForSale;
    }
    if (filter === "toread") {
        // La Pile à Lire correspond à tous les livres qui ne sont pas encore lus (ni Lu, ni Abandonné)
        return rStatus !== "READ" && rStatus !== "LU" && rStatus !== "ABANDONED" && rStatus !== "ABANDONNE";
    }
    if (filter === "read") {
        return rStatus === "READ" || rStatus === "LU";
    }
    if (filter === "unread") {
        return (
            (rStatus === "UNREAD" || rStatus === "NON_LU" || !rStatus) &&
            rStatus !== "TO_READ" &&
            rStatus !== "READING" &&
            rStatus !== "A_LIRE"
        );
    }
    if (filter === "abandoned") {
        return rStatus === "ABANDONED" || rStatus === "ABANDONNE";
    }
    return true;
}

export default function CollectionPage() {
    const session = useSession();
    const [seriesList, setSeriesList] = useState<UserSeriesSummaryDTO[]>([]);
    const [flatBooks, setFlatBooks] = useState<BookSummaryDTO[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>("all");
    const [selectedTomeStatus, setSelectedTomeStatus] = useState<TomeStatusFilter>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [viewMode, setViewMode] = useState<"series" | "books">("series");

    // Modal for clicked series
    const [activeSeries, setActiveSeries] = useState<UserSeriesSummaryDTO | null>(null);

    useEffect(() => {
        setLoading(true);

        // Fetch grouped series
        session.customFetch("/user/collection/series", { method: "GET" })
            .then(async (res) => {
                if (res.ok) {
                    const data: UserSeriesSummaryDTO[] = await res.json();
                    setSeriesList(data);
                    // Flatten books for the "flat books" view toggle
                    const allBooks: BookSummaryDTO[] = [];
                    data.forEach((s) => allBooks.push(...s.books));
                    setFlatBooks(allBooks);
                } else {
                    // Fallback to legacy /user/collection and group on client
                    fallbackFetch();
                }
            })
            .catch(() => {
                fallbackFetch();
            })
            .finally(() => {
                setLoading(false);
            });
    }, [session]);

    const fallbackFetch = () => {
        session.customFetch("/user/collection", { method: "GET" })
            .then(async (res) => {
                if (res.ok) {
                    const books: BookSummaryDTO[] = await res.json();
                    setFlatBooks(books);

                    // Client-side grouping
                    const groupedMap = new Map<string, UserSeriesSummaryDTO>();
                    for (const b of books) {
                        const sName = b.seriesName || b.title;
                        const key = sName.toLowerCase();
                        if (!groupedMap.has(key)) {
                            groupedMap.set(key, {
                                id: b.seriesId || parseInt(String(b.id), 10) || 0,
                                name: sName,
                                category: b.category || b.type || "Comics",
                                coverUrl: b.seriesCoverUrl || b.coverUrl,
                                totalVolumes: b.seriesTotalVolumes || 1,
                                ownedCount: 0,
                                books: []
                            });
                        }
                        const entry = groupedMap.get(key)!;
                        entry.books.push(b);
                        entry.ownedCount = entry.books.length;
                        if (entry.ownedCount > entry.totalVolumes) {
                            entry.totalVolumes = entry.ownedCount;
                        }
                    }
                    setSeriesList(Array.from(groupedMap.values()));
                }
            })
            .catch((err) => {
                console.error("Collection fetch error:", err);
            });
    };

    // Filter counts for Series mode
    const categoryCounts = useMemo(() => {
        const counts: Record<CategoryFilter, number> = { all: 0, bd: 0, comics: 0, manga: 0 };
        counts.all = seriesList.length;
        for (const s of seriesList) {
            const cat = normalizeCategory(s.category);
            counts[cat] = (counts[cat] || 0) + 1;
        }
        return counts;
    }, [seriesList]);

    // Filter counts for Tomes mode
    const statusCounts = useMemo(() => {
        const counts: Record<TomeStatusFilter, number> = {
            all: flatBooks.length,
            toread: 0,
            forsale: 0,
            read: 0,
            unread: 0,
            abandoned: 0
        };
        for (const b of flatBooks) {
            const rStatus = (b.readingStatus || "UNREAD").toUpperCase();
            if (b.status === "FOR_SALE") counts.forsale++;
            // Pile à lire: tout ce qui n'est pas encore lu
            if (rStatus !== "READ" && rStatus !== "LU" && rStatus !== "ABANDONED" && rStatus !== "ABANDONNE") {
                counts.toread++;
            }
            if (rStatus === "READ" || rStatus === "LU") counts.read++;
            if (rStatus === "UNREAD" || rStatus === "NON_LU" || !b.readingStatus) counts.unread++;
            if (rStatus === "ABANDONED" || rStatus === "ABANDONNE") counts.abandoned++;
        }
        return counts;
    }, [flatBooks]);

    // Filtered series
    const filteredSeries = useMemo(() => {
        return seriesList.filter((s) => {
            // Category filter
            if (selectedCategory !== "all") {
                const cat = normalizeCategory(s.category);
                if (cat !== selectedCategory) return false;
            }

            // Search query
            if (searchQuery.trim().length > 0) {
                const q = searchQuery.toLowerCase().trim();
                const matchName = s.name.toLowerCase().includes(q);
                const matchBook = s.books.some((b) => b.title.toLowerCase().includes(q));
                if (!matchName && !matchBook) return false;
            }

            return true;
        });
    }, [seriesList, selectedCategory, searchQuery]);

    // Filtered flat books (for flat view toggle)
    const filteredFlatBooks = useMemo(() => {
        return flatBooks.filter((b) => {
            // Status filter in Tomes mode
            if (selectedTomeStatus !== "all") {
                if (!matchesTomeStatus(b, selectedTomeStatus)) return false;
            }

            // Search query
            if (searchQuery.trim().length > 0) {
                const q = searchQuery.toLowerCase().trim();
                return b.title.toLowerCase().includes(q) || (b.seriesName && b.seriesName.toLowerCase().includes(q));
            }
            return true;
        });
    }, [flatBooks, selectedTomeStatus, searchQuery]);

    const totalOwnedTomes = flatBooks.length;

    return (
        <div className="collection-page">
            <WrapperHeader>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", flexWrap: "wrap", gap: "12px" }}>
                    <div>
                        <h2 style={{ margin: 0 }}>
                            Ma Bibliothèque {totalOwnedTomes > 0 ? `(${totalOwnedTomes} tome${totalOwnedTomes > 1 ? "s" : ""})` : ""}
                        </h2>
                    </div>

                    {seriesList.length > 0 && (
                        <div style={{ fontSize: "0.875rem", color: "var(--text-muted)", fontWeight: 500 }}>
                            {seriesList.length} série{seriesList.length > 1 ? "s" : ""} enregistrée{seriesList.length > 1 ? "s" : ""}
                        </div>
                    )}
                </div>
            </WrapperHeader>

            <div className="collection-page__content">
                {/* Controls Bar: Category Filters / Status Filters, Search, View Mode */}
                {seriesList.length > 0 && (
                    <div className="collection-page__controls">
                        {/* Dynamic Filters depending on viewMode */}
                        {viewMode === "series" ? (
                            <div className="collection-page__filters">
                                {CATEGORY_TABS.map((tab) => {
                                    const isSelected = selectedCategory === tab.id;
                                    const count = categoryCounts[tab.id];

                                    return (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => setSelectedCategory(tab.id)}
                                            className={`collection-page__filter-btn ${isSelected ? "is-active" : ""}`}
                                        >
                                            {tab.icon && <FontAwesomeIcon icon={tab.icon} />}
                                            <span>{tab.label}</span>
                                            <span className="collection-page__filter-count">
                                                {count}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="collection-page__filters">
                                {STATUS_TABS.map((tab) => {
                                    const isSelected = selectedTomeStatus === tab.id;
                                    const count = statusCounts[tab.id];

                                    return (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => setSelectedTomeStatus(tab.id)}
                                            className={`collection-page__filter-btn ${isSelected ? "is-active" : ""}`}
                                        >
                                            {tab.icon && <FontAwesomeIcon icon={tab.icon} />}
                                            <span>{tab.label}</span>
                                            <span className="collection-page__filter-count">
                                                {count}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Search & View Mode Switcher */}
                        <div className="collection-page__right-controls">
                            <div className="collection-page__search">
                                <FontAwesomeIcon icon={faMagnifyingGlass} />
                                <input
                                    type="text"
                                    placeholder={viewMode === "series" ? "Rechercher une série..." : "Rechercher un tome..."}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            <div className="collection-page__view-toggle">
                                <button
                                    type="button"
                                    className={`collection-page__view-btn ${viewMode === "series" ? "is-active" : ""}`}
                                    onClick={() => setViewMode("series")}
                                    title="Affichage groupé par séries"
                                >
                                    <FontAwesomeIcon icon={faBorderAll} />
                                    <span>Séries</span>
                                </button>
                                <button
                                    type="button"
                                    className={`collection-page__view-btn ${viewMode === "books" ? "is-active" : ""}`}
                                    onClick={() => setViewMode("books")}
                                    title="Affichage de tous les tomes individuels"
                                >
                                    <FontAwesomeIcon icon={faList} />
                                    <span>Tomes</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Body Content */}
                {loading ? (
                    <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
                        Chargement de votre bibliothèque...
                    </div>
                ) : seriesList.length === 0 ? (
                    /* Empty Collection State */
                    <div style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "80px 20px",
                        textAlign: "center",
                        color: "var(--text-muted)"
                    }}>
                        <div style={{
                            width: "72px",
                            height: "72px",
                            borderRadius: "50%",
                            backgroundColor: "rgba(16, 185, 129, 0.1)",
                            border: "1px solid rgba(16, 185, 129, 0.2)",
                            color: "var(--accent-primary)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "28px",
                            marginBottom: "20px"
                        }}>
                            <FontAwesomeIcon icon={faBook} />
                        </div>
                        <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>
                            Votre bibliothèque est encore vide
                        </h3>
                        <p style={{ fontSize: "0.9375rem", maxWidth: "380px", marginBottom: "24px", lineHeight: 1.6 }}>
                            Parcourez les nouveautés et ajoutez vos livres favoris à votre bibliothèque pour suivre vos collections.
                        </p>
                        <Link
                            to="/app/home"
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "8px",
                                height: "42px",
                                padding: "0 22px",
                                borderRadius: "var(--radius-full)",
                                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                                color: "#fff",
                                fontWeight: 600,
                                fontSize: "0.875rem",
                                boxShadow: "0 4px 14px 0 rgba(16, 185, 129, 0.35)",
                                textDecoration: "none"
                            }}
                        >
                            <FontAwesomeIcon icon={faCompass} />
                            <span>Découvrir les nouveautés</span>
                        </Link>
                    </div>
                ) : viewMode === "books" ? (
                    /* Flat Books View */
                    filteredFlatBooks.length > 0 ? (
                        <BookList books={filteredFlatBooks} />
                    ) : (
                        <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                            Aucun tome ne correspond à vos filtres.
                        </div>
                    )
                ) : (
                    /* Grouped Series View */
                    filteredSeries.length > 0 ? (
                        <div className="series-grid">
                            {filteredSeries.map((series) => {
                                const total = Math.max(1, series.totalVolumes);
                                const owned = series.ownedCount;
                                const isComplete = owned >= total;
                                const percent = Math.min(100, Math.round((owned / total) * 100));
                                const catType = normalizeCategory(series.category);
                                const catLabel = catType === "manga" ? "Manga" : catType === "bd" ? "BD" : "Comics";

                                return (
                                    <button
                                        type="button"
                                        key={series.id || series.name}
                                        className="series-card"
                                        onClick={() => setActiveSeries(series)}
                                    >
                                        <div className="series-card__cover-wrapper">
                                            {series.coverUrl ? (
                                                <img
                                                    className="series-card__cover"
                                                    src={series.coverUrl}
                                                    alt={`Couverture de ${series.name}`}
                                                    loading="lazy"
                                                    decoding="async"
                                                />
                                            ) : (
                                                <div className="series-card__cover-fallback">
                                                    <FontAwesomeIcon icon={faBook} />
                                                    <span>{series.name}</span>
                                                </div>
                                            )}

                                            {/* Badge top-right: owned / total */}
                                            <span className={`series-card__badge ${isComplete ? "is-complete" : ""}`}>
                                                {isComplete ? "Complète" : `${owned} / ${total}`}
                                            </span>

                                            {/* Badge top-left: category tag */}
                                            <span className="series-card__category-badge">
                                                {catLabel}
                                            </span>

                                            {/* Progress bar at the bottom of the image (2-3px) */}
                                            <div
                                                className="series-card__progress-track"
                                                title={`${owned} sur ${total} tomes possédés (${percent}%)`}
                                            >
                                                <div
                                                    className={`series-card__progress-fill ${isComplete ? "is-complete" : ""}`}
                                                    style={{ width: `${percent}%` }}
                                                />
                                            </div>
                                        </div>

                                        <div className="series-card__info">
                                            <h3 className="series-card__title" title={series.name}>
                                                {series.name}
                                            </h3>
                                            <p className={`series-card__subtitle ${isComplete ? "is-complete" : ""}`}>
                                                {total > 1
                                                    ? `${owned} sur ${total} tomes`
                                                    : (owned > 0 ? "Tome unique possédé" : "Tome unique")}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                            Aucune série ne correspond à vos filtres.
                        </div>
                    )
                )}
            </div>

            {/* Dialog to inspect tomes inside a selected Series */}
            <Dialog
                open={Boolean(activeSeries)}
                onClose={() => setActiveSeries(null)}
                PaperProps={{
                    style: {
                        backgroundColor: "var(--bg-surface, #1e1e24)",
                        border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))",
                        borderRadius: "16px",
                        boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6)",
                        width: "100%",
                        maxWidth: "680px",
                        margin: "16px",
                        padding: "20px"
                    }
                }}
            >
                {activeSeries && (
                    <div className="series-dialog">
                        <div className="series-dialog__header">
                            <div className="series-dialog__header-left">
                                {activeSeries.coverUrl && (
                                    <img
                                        src={activeSeries.coverUrl}
                                        alt={activeSeries.name}
                                        className="series-dialog__header-thumb"
                                        loading="lazy"
                                        decoding="async"
                                    />
                                )}
                                <div className="series-dialog__header-info">
                                    <h3>{activeSeries.name}</h3>
                                    <div className="series-dialog__meta-row">
                                        <span style={{
                                            padding: "2px 8px",
                                            borderRadius: "12px",
                                            background: "rgba(16, 185, 129, 0.15)",
                                            color: "var(--accent-primary)",
                                            fontWeight: 700
                                        }}>
                                            {activeSeries.ownedCount} / {Math.max(activeSeries.ownedCount, activeSeries.totalVolumes)} tomes possédés
                                        </span>
                                        <span>&bull;</span>
                                        <span>Catégorie : {activeSeries.category || "Comics"}</span>
                                    </div>
                                </div>
                            </div>

                            <button
                                type="button"
                                className="series-dialog__close-btn"
                                onClick={() => setActiveSeries(null)}
                                aria-label="Fermer"
                            >
                                <FontAwesomeIcon icon={faXmark} />
                            </button>
                        </div>

                        {/* Books List in the Series */}
                        <div>
                            <div style={{
                                fontSize: "0.85rem",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                                color: "var(--text-muted)",
                                marginBottom: "12px"
                            }}>
                                Tomes dans votre bibliothèque ({activeSeries.books.length})
                            </div>

                            <div className="series-dialog__books-grid">
                                {activeSeries.books.map((book) => (
                                    <Link
                                        key={book.id}
                                        to={`/app/book/${book.id}`}
                                        className="series-dialog__book-item"
                                        onClick={() => setActiveSeries(null)}
                                        title={`Ouvrir ${book.title}`}
                                    >
                                        {book.coverUrl ? (
                                            <img
                                                src={book.coverUrl}
                                                alt={book.title}
                                                className="series-dialog__book-cover"
                                                loading="lazy"
                                                decoding="async"
                                            />
                                        ) : (
                                            <div style={{
                                                width: "100%",
                                                aspectRatio: 0.67,
                                                borderRadius: "4px",
                                                background: "rgba(255, 255, 255, 0.05)",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                marginBottom: "8px"
                                            }}>
                                                <FontAwesomeIcon icon={faBook} style={{ color: "var(--text-muted)" }} />
                                            </div>
                                        )}
                                        <span className="series-dialog__book-vol">
                                            {book.volume > 0 ? `Tome ${book.volume}` : "Tome unique"}
                                        </span>
                                        <span className="series-dialog__book-title">
                                            {book.title}
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </Dialog>
        </div>
    );
}
