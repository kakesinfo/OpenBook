import { WrapperHeader } from "../../components/Wrapper/Wrapper.tsx";
import { useEffect, useState } from "react";
import useSession from "../../hooks/UseSession.tsx";
import BookList from "../../components/BookList/BookList.tsx";
import Pagination from "../../components/Pagination/Pagination.tsx";
import BookSummaryDTO from "../../dto/BookSummary.dto.ts";
import CollectionPageDTO from "../../dto/CollectionPage.dto.ts";
import { Link, useSearchParams } from "react-router";
import { useDebounce } from "../../hooks/UseDebounce.tsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faBook,
    faCompass,
    faLayerGroup,
    faMagnifyingGlass,
    faBookBookmark,
    faCheck,
    faBookOpen,
    faBan,
    faPause,
    faBorderAll,
    faList,
    faChevronRight,
    faStar,
    faGem,
    faXmark
} from "@fortawesome/free-solid-svg-icons";
import Select, {
    type CategoryOption,
    DEFAULT_APP_CATEGORIES,
    bookMatchesCategories
} from "../../components/Select/Select.tsx";
import useLanguage from "../../hooks/UseLanguage.tsx";
import { detectEditionBadge } from "../../utils/editionBadge.ts";
import "./CollectionPage.scss";
import SearchBar from "../../components/SearchBar/SearchBar.tsx";
import PageControls from "../../components/PageControls/PageControls.tsx";

type TomeStatusFilter = "all" | "toread" | "read" | "abandoned";
type DisplayMode = "grid" | "list";

interface StatusTab {
    id: TomeStatusFilter;
    labelEn: string;
    labelFr: string;
    icon?: typeof faBook;
}

interface HoveredCoverState {
    url: string;
    title: string;
    x: number;
    y: number;
}

const STATUS_TABS: StatusTab[] = [
    { id: "all", labelEn: "All", labelFr: "Tous", icon: faLayerGroup },
    { id: "toread", labelEn: "To read", labelFr: "Pile à lire", icon: faBookBookmark },
    { id: "read", labelEn: "Read", labelFr: "Lu", icon: faCheck },
    { id: "abandoned", labelEn: "Abandoned", labelFr: "Abandonné", icon: faBan }
];

function matchesTomeStatus(book: BookSummaryDTO, filter: TomeStatusFilter): boolean {
    if (filter === "all") return true;

    const rStatus = (book.readingStatus || "").toUpperCase();

    if (filter === "toread") {
        return rStatus !== "READ" && rStatus !== "LU" && rStatus !== "ABANDONED" && rStatus !== "ABANDONNE";
    }
    if (filter === "read") {
        return rStatus === "READ" || rStatus === "LU";
    }
    if (filter === "abandoned") {
        return rStatus === "ABANDONED" || rStatus === "ABANDONNE";
    }
    return true;
}

function getReadingStatusBadge(book: BookSummaryDTO, tr: (en: string, fr: string) => string) {
    const rStatus = (book.readingStatus || "").toUpperCase();
    if (rStatus === "READ" || rStatus === "LU") {
        return (
            <span className="collection-status-badge collection-status-badge--read">
                <FontAwesomeIcon icon={faCheck} />
                <span>{tr("Read", "Lu")}</span>
            </span>
        );
    }

    if (rStatus === "READING" || rStatus === "EN_COURS") {
        return (
            <span className="collection-status-badge collection-status-badge--reading">
                <FontAwesomeIcon icon={faBookOpen} />
                <span>{tr("Reading", "En cours")}</span>
            </span>
        );
    }
    if (rStatus === "PAUSED" || rStatus === "EN_PAUSE" || rStatus === "PAUSE") {
        return (
            <span className="collection-status-badge collection-status-badge--paused">
                <FontAwesomeIcon icon={faPause} />
                <span>{tr("Paused", "En pause")}</span>
            </span>
        );
    }
    if (rStatus === "ABANDONED" || rStatus === "ABANDONNE") {
        return (
            <span className="collection-status-badge collection-status-badge--abandoned">
                <FontAwesomeIcon icon={faBan} />
                <span>{tr("Abandoned", "Abandonné")}</span>
            </span>
        );
    }
    return (
        <span className="collection-status-badge collection-status-badge--unread">
            <span>{tr("Unread", "Non lu")}</span>
        </span>
    );
}

export default function CollectionPage() {
    const session = useSession();
    const { tr, translateCategory } = useLanguage();
    const [searchParams, setSearchParams] = useSearchParams();

    // Read current page from URL (?page=X)
    const pageFromUrl = searchParams.get("page");
    const currentPage = pageFromUrl ? Math.max(1, parseInt(pageFromUrl, 10) || 1) : 1;

    // Books and pagination state
    const [books, setBooks] = useState<BookSummaryDTO[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [totalElements, setTotalElements] = useState<number>(0);
    const [totalPages, setTotalPages] = useState<number>(1);
    const [totalOwned, setTotalOwned] = useState<number>(0);
    const [refreshKey, setRefreshKey] = useState<number>(0);

    const [statusCounts, setStatusCounts] = useState<Record<TomeStatusFilter, number>>({
        all: 0,
        toread: 0,
        read: 0,
        abandoned: 0
    });

    const [selectedStatus, setSelectedStatus] = useState<TomeStatusFilter>("all");
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [availableCategories, setAvailableCategories] = useState<CategoryOption[]>(DEFAULT_APP_CATEGORIES);

    useEffect(() => {
        session.customFetch("/series/categories", { method: "GET" })
            .then(async (res) => {
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data) && data.length > 0) {
                        setAvailableCategories(
                            data.map((cat: { id?: number; name: string }) => {
                                const found = DEFAULT_APP_CATEGORIES.find(
                                    (d) => d.id.toLowerCase() === cat.name.toLowerCase()
                                );
                                return {
                                    id: cat.name,
                                    label: cat.name,
                                    icon: found?.icon || faBook
                                };
                            })
                        );
                    }
                }
            })
            .catch(() => {});
    }, [session]);
    const [searchQuery, setSearchQuery] = useState("");
    const debouncedSearch = useDebounce(searchQuery, 300);

    const [displayMode, setDisplayMode] = useState<DisplayMode>(() => {
        try {
            return (localStorage.getItem("collection_display_mode") as DisplayMode) || "grid";
        } catch {
            return "grid";
        }
    });

    // Default page sizes (24 for grid, 25 for list)
    const [gridPageSize, setGridPageSize] = useState<number>(() => {
        try {
            const saved = localStorage.getItem("collection_grid_page_size");
            const num = saved !== null ? Number(saved) : 24;
            return num > 0 ? num : 24;
        } catch {
            return 24;
        }
    });
    const [listPageSize, setListPageSize] = useState<number>(() => {
        try {
            const saved = localStorage.getItem("collection_list_page_size");
            const num = saved !== null ? Number(saved) : 25;
            return num > 0 ? num : 25;
        } catch {
            return 25;
        }
    });

    const pageSize = displayMode === "grid" ? gridPageSize : listPageSize;

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

    const handlePageChange = (newPage: number) => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set("page", String(newPage));
            return next;
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleSetDisplayMode = (mode: DisplayMode) => {
        setDisplayMode(mode);
        setHoveredCover(null);
        handlePageChange(1);
        try {
            localStorage.setItem("collection_display_mode", mode);
        } catch (_) {}
    };

    const handleStatusChange = (status: TomeStatusFilter) => {
        setSelectedStatus(status);
        if (currentPage !== 1) {
            handlePageChange(1);
        }
    };

    const handleCategoriesChange = (categories: string[]) => {
        setSelectedCategories(categories);
        if (currentPage !== 1) {
            handlePageChange(1);
        }
    };

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        if (currentPage !== 1) {
            handlePageChange(1);
        }
    };

    const handlePageSizeChange = (size: number) => {
        if (displayMode === "grid") {
            setGridPageSize(size);
            try {
                localStorage.setItem("collection_grid_page_size", String(size));
            } catch (_) {}
        } else {
            setListPageSize(size);
            try {
                localStorage.setItem("collection_list_page_size", String(size));
            } catch (_) {}
        }
        handlePageChange(1);
    };

    // Fetch collection slice from backend whenever page, size, filters or debounced search change
    useEffect(() => {
        let isCancelled = false;
        setLoading(true);

        const params = new URLSearchParams();
        params.set("page", String(currentPage));
        params.set("size", String(pageSize));
        if (selectedStatus !== "all") params.set("status", selectedStatus);
        if (selectedCategories.length > 0) params.set("category", selectedCategories.join(","));
        if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());

        session.customFetch(`/user/collection?${params.toString()}`, { method: "GET" })
            .then(async (res) => {
                if (res.ok) {
                    const data: CollectionPageDTO | BookSummaryDTO[] = await res.json();
                    if (!isCancelled) {
                        if (Array.isArray(data)) {
                            // Fallback if backend returns all books as array
                            const all = data.length;
                            let toread = 0;
                            let read = 0;
                            let abandoned = 0;
                            for (const b of data) {
                                const r = (b.readingStatus || "UNREAD").toUpperCase();
                                if (r === "READ" || r === "LU") read++;
                                else if (r === "ABANDONED" || r === "ABANDONNE") abandoned++;
                                else toread++;
                            }
                            setStatusCounts({ all, toread, read, abandoned });
                            setTotalOwned(all);

                            const filtered = data.filter((b) => {
                                if (!matchesTomeStatus(b, selectedStatus)) return false;
                                if (selectedCategories.length > 0) {
                                    if (!bookMatchesCategories(b, selectedCategories)) return false;
                                }
                                if (debouncedSearch.trim().length > 0) {
                                    const q = debouncedSearch.toLowerCase().trim();
                                    const matchTitle = (b.title || "").toLowerCase().includes(q);
                                    const matchSeries = (b.seriesName || "").toLowerCase().includes(q);
                                    if (!matchTitle && !matchSeries) return false;
                                }
                                return true;
                            });

                            const isAllLocal = pageSize === 0 || pageSize >= 9999;
                            const effectiveSizeLocal = isAllLocal ? Math.max(1, filtered.length) : pageSize;
                            const computedTotalPages = isAllLocal ? 1 : Math.max(1, Math.ceil(filtered.length / effectiveSizeLocal));
                            const activePage = Math.min(currentPage, computedTotalPages);
                            const start = isAllLocal ? 0 : (activePage - 1) * effectiveSizeLocal;
                            const end = isAllLocal ? filtered.length : Math.min(start + effectiveSizeLocal, filtered.length);

                            setTotalElements(filtered.length);
                            setTotalPages(computedTotalPages);
                            setBooks(filtered.slice(start, end));
                        } else if (data && Array.isArray(data.content)) {
                            // Backend paginated CollectionPageDTO
                            setBooks(data.content);
                            setTotalElements(data.totalElements ?? 0);
                            setTotalPages(data.totalPages ?? 1);
                            if (data.totalOwned !== undefined) {
                                setTotalOwned(data.totalOwned);
                            }
                            if (data.statusCounts) {
                                setStatusCounts({
                                    all: data.statusCounts.all ?? data.totalOwned ?? 0,
                                    toread: data.statusCounts.toread ?? 0,
                                    read: data.statusCounts.read ?? 0,
                                    abandoned: data.statusCounts.abandoned ?? 0
                                });
                            }
                        }
                    }
                } else if (!isCancelled) {
                    setBooks([]);
                    setTotalElements(0);
                    setTotalPages(1);
                }
            })
            .catch((err) => {
                console.error("Collection fetch error:", err);
                if (!isCancelled) {
                    setBooks([]);
                    setTotalElements(0);
                    setTotalPages(1);
                }
            })
            .finally(() => {
                if (!isCancelled) {
                    setLoading(false);
                }
            });

        return () => {
            isCancelled = true;
        };
    }, [session, currentPage, pageSize, selectedStatus, selectedCategories, debouncedSearch, refreshKey]);

    // Pagination calculations
    const isAll = pageSize === 0 || pageSize >= 9999;
    const effectivePageSize = isAll ? Math.max(1, totalElements) : pageSize;
    const startIndex = totalElements === 0 ? 0 : (currentPage - 1) * effectivePageSize;
    const endIndex = isAll ? totalElements : Math.min(startIndex + books.length, totalElements);

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

    const hasAnyOwned = totalOwned > 0;
    const isFiltering = searchQuery.trim().length > 0 || selectedStatus !== "all" || selectedCategories.length > 0;

    return (
        <div className="collection-page">
            <WrapperHeader>
                <div className="collection-page__header-center">
                    <div className="collection-page__filters">
                        {STATUS_TABS.map((tab) => {
                            const isSelected = selectedStatus === tab.id;
                            const count = statusCounts[tab.id] ?? 0;

                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => handleStatusChange(tab.id)}
                                    className={`collection-page__filter-btn ${isSelected ? "is-active" : ""}`}
                                >
                                    {tab.icon && <FontAwesomeIcon icon={tab.icon} />}
                                    <span>{tr(tab.labelEn, tab.labelFr)}</span>
                                    <span className="collection-page__filter-count">
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </WrapperHeader>

            <div className="collection-page__content">
                {/* Controls Bar: Status Tabs, Category Filter, Search, View Mode Toggle */}
                {(hasAnyOwned || isFiltering) && (
                    <PageControls
                        left={
                            <Select
                                multiple
                                translateOptions
                                options={availableCategories}
                                selected={selectedCategories}
                                onChange={handleCategoriesChange}
                                allLabel={tr("All categories", "Toutes les catégories")}
                            />
                        }
                        center={
                            <SearchBar
                                value={searchQuery}
                                onChange={handleSearchChange}
                                placeholder={tr("Search a book...", "Rechercher un album...")}
                                clearLabel={tr("Clear search", "Effacer la recherche")}
                            />
                        }
                        right={
                            <div className="collection-page__view-toggle">
                                <button
                                    type="button"
                                    className={`collection-page__view-btn ${displayMode === "grid" ? "is-active" : ""}`}
                                    onClick={() => handleSetDisplayMode("grid")}
                                    title={tr("Gallery view", "Mode Galerie")}
                                >
                                    <FontAwesomeIcon icon={faBorderAll} />
                                    <span>{tr("Gallery", "Galerie")}</span>
                                </button>
                                <button
                                    type="button"
                                    className={`collection-page__view-btn ${displayMode === "list" ? "is-active" : ""}`}
                                    onClick={() => handleSetDisplayMode("list")}
                                    title={tr("Compact list view", "Mode Liste compacte")}
                                >
                                    <FontAwesomeIcon icon={faList} />
                                    <span>{tr("List", "Liste")}</span>
                                </button>
                            </div>
                        }
                    />
                )}

                {/* Body Content */}
                {loading && books.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
                        {tr("Loading your library...", "Chargement de votre bibliothèque...")}
                    </div>
                ) : !hasAnyOwned && !isFiltering ? (
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
                            backgroundColor: "var(--accent-primary-light)",
                            border: "1px solid var(--border-focus)",
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
                            {tr("Your library is still empty", "Votre bibliothèque est encore vide")}
                        </h3>
                        <p style={{ fontSize: "0.9375rem", maxWidth: "380px", marginBottom: "24px", lineHeight: 1.6 }}>
                            {tr(
                                "Browse new releases and add your favorite books to your library to track your reading.",
                                "Parcourez les nouveautés et ajoutez vos albums favoris à votre bibliothèque pour suivre vos lectures."
                            )}
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
                                background: "linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-primary-hover) 100%)",
                                color: "#fff",
                                fontWeight: 600,
                                fontSize: "0.875rem",
                                boxShadow: "0 4px 14px 0 var(--accent-primary-glow)",
                                textDecoration: "none"
                            }}
                        >
                            <FontAwesomeIcon icon={faCompass} />
                            <span>{tr("Discover new releases", "Découvrir les nouveautés")}</span>
                        </Link>
                    </div>
                ) : totalElements === 0 ? (
                    <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
                        {tr("No books match your filters.", "Aucun album ne correspond à vos filtres.")}
                    </div>
                ) : (
                    <div style={{ opacity: loading ? 0.6 : 1, transition: "opacity 0.2s ease" }}>
                        {displayMode === "grid" ? (
                            /* Galerie Mode (Backend Paginated) */
                            <BookList
                                books={books}
                                onBookStatusChange={(_bookId, newStatus) => {
                                    if (newStatus !== "OWNED") {
                                        setRefreshKey(prev => prev + 1);
                                    }
                                }}
                            />
                        ) : (
                            /* Compact Table/List Mode (Backend Paginated) */
                            <div className="collection-list">
                                <div className="collection-list__header">
                                    <span className="collection-list__th collection-list__th--title">{tr("Title", "Titre")}</span>
                                    <span className="collection-list__th collection-list__th--series">{tr("Series / Vol.", "Série / Tome")}</span>
                                    <span className="collection-list__th collection-list__th--author">{tr("Author", "Auteur")}</span>
                                    <span className="collection-list__th collection-list__th--category">{tr("Category", "Catégorie")}</span>
                                    <span className="collection-list__th collection-list__th--status">{tr("Status", "Statut")}</span>
                                    <span className="collection-list__th collection-list__th--date">{tr("Date", "Date")}</span>
                                    <span className="collection-list__th collection-list__th--action"></span>
                                </div>

                                {books.map((book) => {
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
                                                {(() => {
                                                    const badge = detectEditionBadge(book);
                                                    if (!badge) return null;
                                                    return (
                                                        <span className={`collection-row__variant-badge collection-row__variant-badge--${badge.type}`} title={badge.label}>
                                                            <FontAwesomeIcon icon={badge.type === "limited" ? faGem : faStar} />
                                                            <span>{badge.label}</span>
                                                        </span>
                                                    );
                                                })()}
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
                                                        {tr(`Vol.${book.volume}`, `T.${book.volume}`)}
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
                                                        {translateCategory(cat)}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Status column */}
                                            <div className="collection-row__col collection-row__col--status">
                                                {getReadingStatusBadge(book, tr)}
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

                        {/* Shared Pagination component */}
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={handlePageChange}
                            totalItems={totalElements}
                            startIndex={startIndex}
                            endIndex={endIndex}
                            pageSize={pageSize}
                            onPageSizeChange={handlePageSizeChange}
                            pageSizeOptions={displayMode === "grid" ? [24, 48, 96, 0] : [25, 50, 100, 0]}
                            itemLabel={tr("books", "albums")}
                        />
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
                        alt={tr(`Cover of ${hoveredCover.title}`, `Couverture de ${hoveredCover.title}`)}
                        decoding="async"
                    />
                </div>
            )}
        </div>
    );
}
