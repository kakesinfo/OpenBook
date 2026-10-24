import { WrapperHeader } from "../../components/Wrapper/Wrapper.tsx";
import { useEffect, useState, useMemo } from "react";
import useSession from "../../hooks/UseSession.tsx";
import BookList from "../../components/BookList/BookList.tsx";
import BookSummaryDTO from "../../dto/BookSummary.dto.ts";
import { Link } from "react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faBook,
    faCompass,
    faLayerGroup,
    faBolt,
    faFire,
    faMagnifyingGlass,
    faBookBookmark,
    faTag,
    faCheck,
    faBookOpen,
    faBan,
    faBorderAll,
    faList,
    faChevronRight,
    faClone
} from "@fortawesome/free-solid-svg-icons";
import "./CollectionPage.scss";

type CategoryFilter = "all" | "bd" | "comics" | "manga";
type TomeStatusFilter = "all" | "toread" | "forsale" | "read" | "unread" | "abandoned";
type DisplayMode = "grid" | "list";

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

interface HoveredCoverState {
    url: string;
    title: string;
    x: number;
    y: number;
}

const CATEGORY_TABS: CategoryTab[] = [
    { id: "all", label: "Toutes catégories", icon: faLayerGroup },
    { id: "bd", label: "BD", icon: faBook },
    { id: "comics", label: "Comics", icon: faBolt },
    { id: "manga", label: "Manga", icon: faFire }
];

const STATUS_TABS: StatusTab[] = [
    { id: "all", label: "Tous", icon: faLayerGroup },
    { id: "toread", label: "Pile à lire", icon: faBookBookmark },
    { id: "read", label: "Lu", icon: faCheck },
    { id: "unread", label: "Non lu", icon: faBookOpen },
    { id: "forsale", label: "À vendre", icon: faTag },
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

function getReadingStatusBadge(book: BookSummaryDTO) {
    if (book.status === "FOR_SALE") {
        return (
            <span className="collection-status-badge collection-status-badge--forsale">
                <FontAwesomeIcon icon={faTag} />
                <span>À vendre</span>
            </span>
        );
    }
    const rStatus = (book.readingStatus || "").toUpperCase();
    if (rStatus === "READ" || rStatus === "LU") {
        return (
            <span className="collection-status-badge collection-status-badge--read">
                <FontAwesomeIcon icon={faCheck} />
                <span>Lu</span>
            </span>
        );
    }
    if (rStatus === "TO_READ" || rStatus === "A_LIRE" || rStatus === "PILE_A_LIRE") {
        return (
            <span className="collection-status-badge collection-status-badge--toread">
                <FontAwesomeIcon icon={faBookBookmark} />
                <span>À lire</span>
            </span>
        );
    }
    if (rStatus === "READING" || rStatus === "EN_COURS") {
        return (
            <span className="collection-status-badge collection-status-badge--reading">
                <FontAwesomeIcon icon={faBookOpen} />
                <span>En cours</span>
            </span>
        );
    }
    if (rStatus === "ABANDONED" || rStatus === "ABANDONNE") {
        return (
            <span className="collection-status-badge collection-status-badge--abandoned">
                <FontAwesomeIcon icon={faBan} />
                <span>Abandonné</span>
            </span>
        );
    }
    return (
        <span className="collection-status-badge collection-status-badge--unread">
            <span>Non lu</span>
        </span>
    );
}

export default function CollectionPage() {
    const session = useSession();
    const [books, setBooks] = useState<BookSummaryDTO[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedStatus, setSelectedStatus] = useState<TomeStatusFilter>("all");
    const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [displayMode, setDisplayMode] = useState<DisplayMode>(() => {
        try {
            return (localStorage.getItem("collection_display_mode") as DisplayMode) || "grid";
        } catch {
            return "grid";
        }
    });

    // Floating cover preview on cursor hover
    const [hoveredCover, setHoveredCover] = useState<HoveredCoverState | null>(null);

    const handleMouseEnterTitle = (e: React.MouseEvent, coverUrl?: string, title?: string) => {
        if (!coverUrl) return;
        setHoveredCover({
            url: coverUrl,
            title: title || "",
            x: e.clientX,
            y: e.clientY
        });
    };

    const handleMouseMoveTitle = (e: React.MouseEvent) => {
        if (hoveredCover) {
            setHoveredCover(prev => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null));
        }
    };

    const handleMouseLeaveTitle = () => {
        setHoveredCover(null);
    };

    const handleSetDisplayMode = (mode: DisplayMode) => {
        setDisplayMode(mode);
        setHoveredCover(null);
        try {
            localStorage.setItem("collection_display_mode", mode);
        } catch (_) {}
    };

    useEffect(() => {
        setLoading(true);

        session.customFetch("/user/collection", { method: "GET" })
            .then(async (res) => {
                if (res.ok) {
                    const data: BookSummaryDTO[] = await res.json();
                    setBooks(data);
                } else {
                    setBooks([]);
                }
            })
            .catch((err) => {
                console.error("Collection fetch error:", err);
                setBooks([]);
            })
            .finally(() => {
                setLoading(false);
            });
    }, [session]);

    // Status counts over all owned books
    const statusCounts = useMemo(() => {
        const counts: Record<TomeStatusFilter, number> = {
            all: books.length,
            toread: 0,
            forsale: 0,
            read: 0,
            unread: 0,
            abandoned: 0
        };
        for (const b of books) {
            const rStatus = (b.readingStatus || "UNREAD").toUpperCase();
            if (b.status === "FOR_SALE") counts.forsale++;
            if (rStatus !== "READ" && rStatus !== "LU" && rStatus !== "ABANDONED" && rStatus !== "ABANDONNE") {
                counts.toread++;
            }
            if (rStatus === "READ" || rStatus === "LU") counts.read++;
            if (rStatus === "UNREAD" || rStatus === "NON_LU" || !b.readingStatus) counts.unread++;
            if (rStatus === "ABANDONED" || rStatus === "ABANDONNE") counts.abandoned++;
        }
        return counts;
    }, [books]);

    // Filtered books
    const filteredBooks = useMemo(() => {
        return books.filter((b) => {
            // Status filter
            if (!matchesTomeStatus(b, selectedStatus)) return false;

            // Category filter
            if (selectedCategory !== "all") {
                const cat = normalizeCategory(b.category, b.type);
                if (cat !== selectedCategory) return false;
            }

            // Search query
            if (searchQuery.trim().length > 0) {
                const q = searchQuery.toLowerCase().trim();
                const matchTitle = (b.title || "").toLowerCase().includes(q);
                const matchSeries = (b.seriesName || "").toLowerCase().includes(q);
                if (!matchTitle && !matchSeries) return false;
            }

            return true;
        });
    }, [books, selectedStatus, selectedCategory, searchQuery]);

    const totalOwned = books.length;

    // Helper to position cursor preview nicely next to the cursor
    const getCursorPreviewStyle = (x: number, y: number) => {
        const cardW = 96;
        const cardH = 140;
        const offset = 16;

        let left = x + offset;
        if (left + cardW > window.innerWidth - 10) {
            left = x - cardW - offset;
        }

        let top = y - cardH / 2;
        if (top < 10) top = 10;
        if (top + cardH > window.innerHeight - 10) {
            top = window.innerHeight - cardH - 10;
        }

        return {
            left: `${left}px`,
            top: `${top}px`
        };
    };

    return (
        <div className="collection-page">
            <WrapperHeader>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", flexWrap: "wrap", gap: "12px" }}>
                    <div>
                        <h2 style={{ margin: 0 }}>
                            Ma Bibliothèque {totalOwned > 0 ? `(${totalOwned} album${totalOwned > 1 ? "s" : ""})` : ""}
                        </h2>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <Link
                            to="/app/series"
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "6px 14px",
                                borderRadius: "20px",
                                background: "rgba(16, 185, 129, 0.12)",
                                border: "1px solid rgba(16, 185, 129, 0.25)",
                                color: "var(--accent-primary)",
                                fontSize: "0.8125rem",
                                fontWeight: 600,
                                textDecoration: "none"
                            }}
                        >
                            <FontAwesomeIcon icon={faLayerGroup} />
                            <span>Gérer mes séries</span>
                        </Link>
                    </div>
                </div>
            </WrapperHeader>

            <div className="collection-page__content">
                {/* Controls Bar: Status Tabs, Category Filter, Search, View Mode Toggle */}
                {books.length > 0 && (
                    <div className="collection-page__controls">
                        {/* Status Filters */}
                        <div className="collection-page__filters">
                            {STATUS_TABS.map((tab) => {
                                const isSelected = selectedStatus === tab.id;
                                const count = statusCounts[tab.id];

                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setSelectedStatus(tab.id)}
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

                        {/* Search, Categories & Display Mode Switcher */}
                        <div className="collection-page__right-controls">
                            <div className="collection-page__categories">
                                {CATEGORY_TABS.map((tab) => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setSelectedCategory(tab.id)}
                                        className={`collection-page__cat-btn ${selectedCategory === tab.id ? "is-active" : ""}`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            <div className="collection-page__search">
                                <FontAwesomeIcon icon={faMagnifyingGlass} />
                                <input
                                    type="text"
                                    placeholder="Rechercher un album..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            {/* View Mode: Galerie vs Liste */}
                            <div className="collection-page__view-toggle">
                                <button
                                    type="button"
                                    className={`collection-page__view-btn ${displayMode === "grid" ? "is-active" : ""}`}
                                    onClick={() => handleSetDisplayMode("grid")}
                                    title="Mode Galerie"
                                >
                                    <FontAwesomeIcon icon={faBorderAll} />
                                    <span>Galerie</span>
                                </button>
                                <button
                                    type="button"
                                    className={`collection-page__view-btn ${displayMode === "list" ? "is-active" : ""}`}
                                    onClick={() => handleSetDisplayMode("list")}
                                    title="Mode Liste compacte"
                                >
                                    <FontAwesomeIcon icon={faList} />
                                    <span>Liste</span>
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
                ) : books.length === 0 ? (
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
                            Parcourez les nouveautés et ajoutez vos albums favoris à votre bibliothèque pour suivre vos lectures.
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
                ) : filteredBooks.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
                        Aucun album ne correspond à vos filtres.
                    </div>
                ) : displayMode === "grid" ? (
                    /* Galerie Mode */
                    <BookList books={filteredBooks} />
                ) : (
                    /* Compact Table/List Mode (0 margins between rows, cover follows cursor on title hover) */
                    <div className="collection-list">
                        <div className="collection-list__header">
                            <span className="collection-list__th collection-list__th--title">Titre</span>
                            <span className="collection-list__th collection-list__th--series">Série / Tome</span>
                            <span className="collection-list__th collection-list__th--author">Auteur</span>
                            <span className="collection-list__th collection-list__th--category">Catégorie</span>
                            <span className="collection-list__th collection-list__th--status">Statut</span>
                            <span className="collection-list__th collection-list__th--date">Date</span>
                            <span className="collection-list__th collection-list__th--action"></span>
                        </div>

                        {filteredBooks.map((book) => {
                            const cat = book.category || book.type;
                            return (
                                <Link to={`/app/book/${book.id}`} className="collection-row" key={book.id}>
                                    {/* Title column with hover tracking for cursor preview */}
                                    <div
                                        className="collection-row__col collection-row__col--title"
                                        onMouseEnter={(e) => handleMouseEnterTitle(e, book.coverUrl, book.title)}
                                        onMouseMove={handleMouseMoveTitle}
                                        onMouseLeave={handleMouseLeaveTitle}
                                    >
                                        <FontAwesomeIcon icon={faBook} className="collection-row__book-icon" />
                                        <span className="collection-row__title" title={book.title}>
                                            {book.title}
                                        </span>
                                        {book.parentBookId && (
                                            <span className="collection-row__variant-badge" title="Couverture variante">
                                                <FontAwesomeIcon icon={faClone} />
                                                <span>Variante</span>
                                            </span>
                                        )}
                                    </div>

                                    {/* Series / Volume column */}
                                    <div className="collection-row__col collection-row__col--series">
                                        {book.seriesName && (
                                            <span className="collection-row__series-name" title={book.seriesName}>
                                                {book.seriesName}
                                            </span>
                                        )}
                                        {book.volume > 0 && (
                                            <span className="collection-row__volume-badge">
                                                T.{book.volume}
                                            </span>
                                        )}
                                    </div>

                                    {/* Author column */}
                                    <div className="collection-row__col collection-row__col--author">
                                        {book.author && (
                                            <span className="collection-row__author" title={book.author}>
                                                {book.author}
                                            </span>
                                        )}
                                    </div>

                                    {/* Category column */}
                                    <div className="collection-row__col collection-row__col--category">
                                        {cat && (
                                            <span className="collection-row__tag">
                                                {cat}
                                            </span>
                                        )}
                                    </div>

                                    {/* Status column */}
                                    <div className="collection-row__col collection-row__col--status">
                                        {getReadingStatusBadge(book)}
                                    </div>

                                    {/* Date column */}
                                    <div className="collection-row__col collection-row__col--date">
                                        {book.releaseDate && (
                                            <span className="collection-row__date">
                                                {new Date(book.releaseDate).getFullYear()}
                                            </span>
                                        )}
                                    </div>

                                    {/* Action column */}
                                    <div className="collection-row__col collection-row__col--action">
                                        <FontAwesomeIcon icon={faChevronRight} className="collection-row__chevron" />
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Floating Cover Preview right at mouse cursor on title hover */}
            {hoveredCover && (
                <div
                    className="collection-cursor-preview"
                    style={getCursorPreviewStyle(hoveredCover.x, hoveredCover.y)}
                >
                    <img
                        src={hoveredCover.url}
                        alt={`Couverture de ${hoveredCover.title}`}
                        decoding="async"
                    />
                </div>
            )}
        </div>
    );
}
