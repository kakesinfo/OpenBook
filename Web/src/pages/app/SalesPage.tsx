import { WrapperHeader } from "../../components/Wrapper/Wrapper.tsx";
import { useEffect, useState, useMemo } from "react";
import useSession from "../../hooks/UseSession.tsx";
import Pagination from "../../components/Pagination/Pagination.tsx";
import BookSummaryDTO from "../../dto/BookSummary.dto.ts";
import { Dialog } from "@mui/material";
import { Link } from "react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faBook,
    faLayerGroup,
    faMagnifyingGlass,
    faTag,
    faCheck,
    faBorderAll,
    faList,
    faClone,
    faTrashCan,
    faRotateLeft,
    faCoins,
    faCalendarDays,
    faXmark,
    faStore,
    faNoteSticky
} from "@fortawesome/free-solid-svg-icons";
import { useSnackbar } from "notistack";
import CategoryMultiSelect, {
    CategoryOption,
    DEFAULT_APP_CATEGORIES,
    bookMatchesCategories
} from "../../components/CategoryMultiSelect/CategoryMultiSelect.tsx";
import BookCard from "../../components/BookCard/BookCard.tsx";
import "./SalesPage.scss";

type SalesStatusFilter = "all" | "FOR_SALE" | "SOLD";
type DisplayMode = "grid" | "list";

interface StatusTab {
    id: SalesStatusFilter;
    label: string;
    icon?: typeof faTag;
}

interface HoveredCoverState {
    url: string;
    title: string;
    x: number;
    y: number;
}

const STATUS_TABS: StatusTab[] = [
    { id: "all", label: "Tous", icon: faLayerGroup },
    { id: "FOR_SALE", label: "À vendre", icon: faTag },
    { id: "SOLD", label: "Vendu", icon: faCheck }
];

export default function SalesPage() {
    const session = useSession();
    const { enqueueSnackbar } = useSnackbar();

    const [books, setBooks] = useState<BookSummaryDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

    const [selectedStatus, setSelectedStatus] = useState<SalesStatusFilter>("all");
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

    // Display mode: "grid" (Galerie) vs "list" (Liste compacte)
    const [displayMode, setDisplayMode] = useState<DisplayMode>(() => {
        try {
            const saved = localStorage.getItem("sales_display_mode");
            if (saved === "grid" || saved === "list") return saved;
        } catch (_) {}
        return "grid";
    });

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [gridPageSize, setGridPageSize] = useState(24);
    const [listPageSize, setListPageSize] = useState(50);

    // Sale modal state (Date and Price when marking a book as SOLD)
    const [saleModalOpen, setSaleModalOpen] = useState(false);
    const [saleTargetBook, setSaleTargetBook] = useState<BookSummaryDTO | null>(null);
    const [saleDate, setSaleDate] = useState<string>("");
    const [salePrice, setSalePrice] = useState<string>("");
    const [saleLocation, setSaleLocation] = useState<string>("");
    const [saleMemo, setSaleMemo] = useState<string>("");
    const [submittingSale, setSubmittingSale] = useState(false);

    const handleOpenSaleModal = (e: React.MouseEvent, book: BookSummaryDTO) => {
        e.preventDefault();
        e.stopPropagation();
        setSaleTargetBook(book);
        setSaleDate("");
        setSalePrice(book.price ? String(book.price) : "");
        setSaleLocation("");
        setSaleMemo("");
        setSaleModalOpen(true);
    };

    const handleConfirmSale = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!saleTargetBook || submittingSale) return;

        setSubmittingSale(true);
        try {
            const parsedPrice = salePrice ? parseFloat(salePrice) : null;
            const res = await session.customFetch(`/user/sales/${encodeURIComponent(saleTargetBook.id)}/status/SOLD`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    date: saleDate.trim() || null,
                    price: parsedPrice,
                    location: saleLocation.trim() || null,
                    memo: saleMemo.trim() || null
                })
            });

            if (res.ok) {
                setBooks((prev) =>
                    prev.map((b) => (b.id === saleTargetBook.id ? { ...b, status: "SOLD", price: parsedPrice ? Math.round(parsedPrice) : b.price } : b))
                );
                enqueueSnackbar("Album marqué comme vendu avec succès !", { variant: "success" });
                setSaleModalOpen(false);
            } else {
                enqueueSnackbar("Erreur lors de la validation de la vente", { variant: "error" });
            }
        } catch (err: any) {
            enqueueSnackbar(`Erreur: ${err.message}`, { variant: "error" });
        } finally {
            setSubmittingSale(false);
        }
    };

    // Hovered cover state for list mode
    const [hoveredCover, setHoveredCover] = useState<HoveredCoverState | null>(null);

    const handleMouseEnterTitle = (e: React.MouseEvent, coverUrl?: string | null, title?: string) => {
        if (!coverUrl) return;
        setHoveredCover({
            url: coverUrl,
            title: title || "",
            x: e.clientX,
            y: e.clientY
        });
    };

    const handleMouseMoveTitle = (e: React.MouseEvent) => {
        if (!hoveredCover) return;
        setHoveredCover((prev) => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
    };

    const handleMouseLeaveTitle = () => {
        setHoveredCover(null);
    };

    const handleSetDisplayMode = (mode: DisplayMode) => {
        setDisplayMode(mode);
        setCurrentPage(1);
        try {
            localStorage.setItem("sales_display_mode", mode);
        } catch (_) {}
    };

    const fetchSales = () => {
        setLoading(true);
        session.customFetch("/user/sales", { method: "GET" })
            .then(async (res) => {
                if (res.ok) {
                    const data: BookSummaryDTO[] = await res.json();
                    setBooks(data);
                } else {
                    setBooks([]);
                }
            })
            .catch((err) => {
                console.error("Sales fetch error:", err);
                setBooks([]);
            })
            .finally(() => {
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchSales();
    }, [session]);

    // Status toggle: FOR_SALE <-> SOLD
    const handleUpdateStatus = async (e: React.MouseEvent, bookId: string, targetStatus: "FOR_SALE" | "SOLD") => {
        e.preventDefault();
        e.stopPropagation();
        if (actionLoadingId != null) return;

        setActionLoadingId(bookId);
        try {
            const res = await session.customFetch(`/user/sales/${bookId}/status/${targetStatus}`, {
                method: "PUT"
            });
            if (res.ok) {
                setBooks((prev) =>
                    prev.map((b) => (b.id === bookId ? { ...b, status: targetStatus } : b))
                );
                enqueueSnackbar(
                    targetStatus === "SOLD" ? "Album marqué comme vendu !" : "Album remis en vente !",
                    { variant: "success" }
                );
            } else {
                enqueueSnackbar("Erreur lors de la mise à jour du statut", { variant: "error" });
            }
        } catch (err: any) {
            enqueueSnackbar(`Erreur: ${err.message}`, { variant: "error" });
        } finally {
            setActionLoadingId(null);
        }
    };

    // Remove from sales
    const handleRemoveFromSales = async (e: React.MouseEvent, bookId: string, bookTitle: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (actionLoadingId != null) return;

        const confirm = window.confirm(`Retirer « ${bookTitle} » de vos ventes ?`);
        if (!confirm) return;

        setActionLoadingId(bookId);
        try {
            const res = await session.customFetch(`/user/sales/${bookId}`, {
                method: "DELETE"
            });
            if (res.ok) {
                setBooks((prev) => prev.filter((b) => b.id !== bookId));
                enqueueSnackbar("Album retiré des ventes et remis dans vos albums", { variant: "success" });
            } else {
                enqueueSnackbar("Erreur lors du retrait de l'album", { variant: "error" });
            }
        } catch (err: any) {
            enqueueSnackbar(`Erreur: ${err.message}`, { variant: "error" });
        } finally {
            setActionLoadingId(null);
        }
    };

    // Reset page to 1 whenever filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedStatus, selectedCategories, searchQuery]);

    // Status counts
    const statusCounts = useMemo(() => {
        const counts: Record<SalesStatusFilter, number> = {
            all: books.length,
            FOR_SALE: 0,
            SOLD: 0
        };
        for (const b of books) {
            const status = (b.status || "").toUpperCase();
            if (status === "FOR_SALE") counts.FOR_SALE++;
            if (status === "SOLD") counts.SOLD++;
        }
        return counts;
    }, [books]);

    // Filtered books
    const filteredBooks = useMemo(() => {
        return books.filter((b) => {
            // Status filter
            if (selectedStatus !== "all") {
                const bStatus = (b.status || "").toUpperCase();
                if (bStatus !== selectedStatus) return false;
            }

            // Category filter
            if (selectedCategories.length > 0) {
                if (!bookMatchesCategories(b, selectedCategories)) return false;
            }

            // Search query filter
            if (searchQuery.trim().length > 0) {
                const q = searchQuery.toLowerCase().trim();
                const titleMatch = (b.title || "").toLowerCase().includes(q);
                const seriesMatch = (b.seriesName || "").toLowerCase().includes(q);
                const authorMatch = (b.author || "").toLowerCase().includes(q);
                if (!titleMatch && !seriesMatch && !authorMatch) return false;
            }

            return true;
        });
    }, [books, selectedStatus, selectedCategories, searchQuery]);

    const totalFiltered = filteredBooks.length;

    // Pagination calculations
    const pageSize = displayMode === "grid" ? gridPageSize : listPageSize;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
    const activePage = Math.min(currentPage, totalPages);

    const startIndex = totalFiltered === 0 ? 0 : (activePage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalFiltered);

    const paginatedBooks = useMemo(() => {
        return filteredBooks.slice(startIndex, endIndex);
    }, [filteredBooks, startIndex, endIndex]);

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handlePageSizeChange = (size: number) => {
        if (displayMode === "grid") {
            setGridPageSize(size);
        } else {
            setListPageSize(size);
        }
        setCurrentPage(1);
    };

    // Helper for cursor hover preview
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
        <div className="sales-page">
            <WrapperHeader>
                <div className="sales-page__header-center">
                    <div className="sales-page__filters">
                        {STATUS_TABS.map((tab) => {
                            const isSelected = selectedStatus === tab.id;
                            const count = statusCounts[tab.id];

                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setSelectedStatus(tab.id)}
                                    className={`sales-page__filter-btn ${isSelected ? "is-active" : ""}`}
                                >
                                    {tab.icon && <FontAwesomeIcon icon={tab.icon} />}
                                    <span>{tab.label}</span>
                                    <span className="sales-page__filter-count">
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </WrapperHeader>

            <div className="sales-page__content">
                {/* Controls Bar: Status Tabs, Category Filter, Search, View Mode Toggle */}
                {books.length > 0 && (
                    <div className="sales-page__controls">
                        {/* Left: Category Dropdown */}
                        <div className="sales-page__left-controls">
                            <CategoryMultiSelect
                                options={availableCategories}
                                selected={selectedCategories}
                                onChange={(cats) => {
                                    setSelectedCategories(cats);
                                    if (currentPage !== 1) setCurrentPage(1);
                                }}
                                allLabel="Toutes les catégories"
                            />
                        </div>

                        {/* Center: Search input */}
                        <div className="sales-page__center-controls">
                            <div className="sales-page__search">
                                <FontAwesomeIcon icon={faMagnifyingGlass} />
                                <input
                                    type="text"
                                    placeholder="Rechercher une vente..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        className="sales-page__search-clear"
                                        onClick={() => setSearchQuery("")}
                                        aria-label="Effacer la recherche"
                                    >
                                        <FontAwesomeIcon icon={faXmark} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Right: View Mode (Galerie vs Liste) */}
                        <div className="sales-page__right-controls">
                            <div className="sales-page__view-toggle">
                                <button
                                    type="button"
                                    className={`sales-page__view-btn ${displayMode === "grid" ? "is-active" : ""}`}
                                    onClick={() => handleSetDisplayMode("grid")}
                                    title="Mode Galerie"
                                >
                                    <FontAwesomeIcon icon={faBorderAll} />
                                    <span>Galerie</span>
                                </button>
                                <button
                                    type="button"
                                    className={`sales-page__view-btn ${displayMode === "list" ? "is-active" : ""}`}
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
                        Chargement de vos ventes...
                    </div>
                ) : books.length === 0 ? (
                    /* Empty Sales State */
                    <div style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "72px 24px",
                        textAlign: "center",
                        gap: "16px"
                    }}>
                        <div style={{
                            width: "72px",
                            height: "72px",
                            borderRadius: "50%",
                            background: "rgba(245, 158, 11, 0.1)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#f59e0b",
                            fontSize: "2rem"
                        }}>
                            <FontAwesomeIcon icon={faTag} />
                        </div>
                        <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>
                            Aucun album en vente pour le moment
                        </h3>
                        <p style={{ margin: 0, color: "var(--text-muted)", maxWidth: "420px", fontSize: "0.875rem" }}>
                            Pour mettre un livre en vente, rendez-vous sur sa fiche album et cliquez sur « Mettre à vendre ».
                        </p>
                        <Link
                            to="/app/collection"
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "8px",
                                height: "40px",
                                padding: "0 22px",
                                borderRadius: "var(--radius-full)",
                                background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                                color: "#fff",
                                fontWeight: 600,
                                fontSize: "0.875rem",
                                boxShadow: "0 4px 14px 0 rgba(245, 158, 11, 0.35)",
                                textDecoration: "none"
                            }}
                        >
                            <FontAwesomeIcon icon={faBook} />
                            <span>Voir ma bibliothèque</span>
                        </Link>
                    </div>
                ) : totalFiltered === 0 ? (
                    <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
                        Aucun album ne correspond à vos filtres de vente.
                    </div>
                ) : (
                    <>
                        {displayMode === "grid" ? (
                            /* Galerie Mode for Sales */
                            <div className="sales-grid">
                                {paginatedBooks.map((book) => {
                                    const isSold = book.status === "SOLD";
                                    const isActionLoading = actionLoadingId === book.id;

                                    return (
                                        <BookCard
                                            key={book.id}
                                            book={book}
                                            className={`sales-card ${isSold ? "is-sold" : ""}`}
                                            badgeText={book.volume > 0 ? `T.${book.volume}` : undefined}
                                            actions={
                                                <>
                                                    {isSold ? (
                                                        <button
                                                            type="button"
                                                            disabled={isActionLoading}
                                                            onClick={(e) => handleUpdateStatus(e, book.id, "FOR_SALE")}
                                                            className="book-card__action-btn book-card__action-btn--relist"
                                                            title="Remettre en vente"
                                                            aria-label="Remettre en vente"
                                                        >
                                                            <FontAwesomeIcon icon={faRotateLeft} />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            disabled={isActionLoading}
                                                            onClick={(e) => handleOpenSaleModal(e, book)}
                                                            className="book-card__action-btn book-card__action-btn--sold"
                                                            title="Marquer comme vendu"
                                                            aria-label="Marquer comme vendu"
                                                        >
                                                            <FontAwesomeIcon icon={faCheck} />
                                                        </button>
                                                    )}

                                                    <button
                                                        type="button"
                                                        disabled={isActionLoading}
                                                        onClick={(e) => handleRemoveFromSales(e, book.id, book.title)}
                                                        className="book-card__action-btn book-card__action-btn--delete"
                                                        title="Retirer de mes ventes (remettre dans mes albums)"
                                                        aria-label="Retirer de mes ventes"
                                                    >
                                                        <FontAwesomeIcon icon={faTrashCan} />
                                                    </button>
                                                </>
                                            }
                                        />
                                    );
                                })}
                            </div>
                        ) : (
                            /* Compact Table/List Mode for Sales */
                            <div className="sales-list">
                                <div className="sales-list__header">
                                    <span className="sales-list__th sales-list__th--title">Titre</span>
                                    <span className="sales-list__th sales-list__th--series">Série / Tome</span>
                                    <span className="sales-list__th sales-list__th--author">Auteur</span>
                                    <span className="sales-list__th sales-list__th--category">Catégorie</span>
                                    <span className="sales-list__th sales-list__th--price">Prix</span>
                                    <span className="sales-list__th sales-list__th--listing">Annonce</span>
                                    <span className="sales-list__th sales-list__th--status">Statut</span>
                                    <span className="sales-list__th sales-list__th--action">Actions</span>
                                </div>

                                {paginatedBooks.map((book) => {
                                    const cat = book.category || book.type;
                                    const isSold = book.status === "SOLD";
                                    const isActionLoading = actionLoadingId === book.id;

                                    return (
                                        <div className={`sales-row ${isSold ? "is-sold" : ""}`} key={book.id}>
                                            {/* Title column with hover tracking for cursor preview */}
                                            <Link
                                                to={`/app/book/${book.id}`}
                                                className="sales-row__col sales-row__col--title"
                                                onMouseEnter={(e) => handleMouseEnterTitle(e, book.coverUrl, book.title)}
                                                onMouseMove={handleMouseMoveTitle}
                                                onMouseLeave={handleMouseLeaveTitle}
                                            >
                                                <FontAwesomeIcon icon={faBook} className="sales-row__book-icon" />
                                                <span className="sales-row__title" title={book.title}>
                                                    {book.title}
                                                </span>
                                                {book.parentBookId && (
                                                    <span className="sales-row__variant-badge" title="Couverture variante">
                                                        <FontAwesomeIcon icon={faClone} />
                                                        <span>Variante</span>
                                                    </span>
                                                )}
                                            </Link>

                                            {/* Series / Volume column */}
                                            <div className="sales-row__col sales-row__col--series">
                                                {book.seriesName && (
                                                    <span className="sales-row__series-name" title={book.seriesName}>
                                                        {book.seriesName}
                                                    </span>
                                                )}
                                                {book.volume > 0 && (
                                                    <span className="sales-row__volume-badge">
                                                        T.{book.volume}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Author column */}
                                            <div className="sales-row__col sales-row__col--author">
                                                {book.author && (
                                                    <span className="sales-row__author" title={book.author}>
                                                        {book.author}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Category column */}
                                            <div className="sales-row__col sales-row__col--category">
                                                {cat && (
                                                    <span className="sales-row__tag">
                                                        {cat}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Price column */}
                                            <div className="sales-row__col sales-row__col--price">
                                                {book.price != null && book.price > 0 ? (
                                                    <span className="sales-row__price">
                                                        {book.price} €
                                                    </span>
                                                ) : (
                                                    <span className="sales-row__price sales-row__price--none">-</span>
                                                )}
                                            </div>

                                            {/* Listing column */}
                                            <div className="sales-row__col sales-row__col--listing">
                                                {book.listingUrl ? (
                                                    <a
                                                        href={book.listingUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="sales-row__listing-link"
                                                        title={book.listingUrl}
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        {book.listingUrl}
                                                    </a>
                                                ) : (
                                                    <span className="sales-row__price sales-row__price--none">-</span>
                                                )}
                                            </div>

                                            {/* Status column */}
                                            <div className="sales-row__col sales-row__col--status">
                                                <span className={`sales-badge ${isSold ? "sales-badge--sold" : "sales-badge--forsale"}`}>
                                                    <FontAwesomeIcon icon={isSold ? faCheck : faTag} />
                                                    <span>{isSold ? "Vendu" : "À vendre"}</span>
                                                </span>
                                            </div>

                                            {/* Quick Actions */}
                                            <div className="sales-row__col sales-row__col--action">
                                                {isSold ? (
                                                    <button
                                                        type="button"
                                                        disabled={isActionLoading}
                                                        onClick={(e) => handleUpdateStatus(e, book.id, "FOR_SALE")}
                                                        className="sales-row__action-btn sales-row__action-btn--relist"
                                                        title="Remettre en vente"
                                                    >
                                                        <FontAwesomeIcon icon={faRotateLeft} />
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        disabled={isActionLoading}
                                                        onClick={(e) => handleOpenSaleModal(e, book)}
                                                        className="sales-row__action-btn sales-row__action-btn--sold"
                                                        title="Marquer comme vendu"
                                                    >
                                                        <FontAwesomeIcon icon={faCheck} />
                                                    </button>
                                                )}

                                                <button
                                                    type="button"
                                                    disabled={isActionLoading}
                                                    onClick={(e) => handleRemoveFromSales(e, book.id, book.title)}
                                                    className="sales-row__action-btn sales-row__action-btn--delete"
                                                    title="Retirer de mes ventes (remettre dans mes albums)"
                                                >
                                                    <FontAwesomeIcon icon={faTrashCan} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Floating Cursor Preview when hovering row titles in list mode */}
                        {displayMode === "list" && hoveredCover && (
                            <div
                                className="sales-cursor-preview"
                                style={getCursorPreviewStyle(hoveredCover.x, hoveredCover.y)}
                            >
                                <img src={hoveredCover.url} alt={hoveredCover.title} />
                                <span className="sales-cursor-preview__title">{hoveredCover.title}</span>
                            </div>
                        )}

                        {/* Pagination Bar */}
                        {totalFiltered > 0 && (
                            <Pagination
                                currentPage={activePage}
                                totalPages={totalPages}
                                totalItems={totalFiltered}
                                startIndex={startIndex}
                                endIndex={endIndex}
                                pageSize={pageSize}
                                onPageChange={handlePageChange}
                                onPageSizeChange={handlePageSizeChange}
                                pageSizeOptions={displayMode === "grid" ? [6, 12, 24, 48] : [10, 25, 50, 100]}
                            />
                        )}
                    </>
                )}
            </div>
            {/* Sale Modal to enter date and price */}
            <Dialog
                open={saleModalOpen}
                onClose={() => setSaleModalOpen(false)}
                PaperProps={{
                    style: {
                        backgroundColor: "var(--bg-surface, #1e1e24)",
                        border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))",
                        borderRadius: "16px",
                        maxWidth: "460px",
                        width: "100%",
                        padding: "24px",
                        color: "var(--text-primary)"
                    }
                }}
            >
                <div className="tx-dialog">
                    <div className="tx-dialog__header">
                        <div className="tx-dialog__header-title">
                            <FontAwesomeIcon icon={faCoins} style={{ color: "#f59e0b" }} />
                            <h3>Marquer comme vendu</h3>
                        </div>
                        <button
                            type="button"
                            className="tx-dialog__header-close"
                            onClick={() => setSaleModalOpen(false)}
                            aria-label="Fermer"
                        >
                            <FontAwesomeIcon icon={faXmark} />
                        </button>
                    </div>

                    {saleTargetBook && (
                        <p style={{ margin: "0 0 4px", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                            Renseignez les informations de vente pour <strong>« {saleTargetBook.title} »</strong> :
                        </p>
                    )}

                    <form className="tx-dialog__form" onSubmit={handleConfirmSale}>
                        <div className="tx-dialog__grid">
                            <div className="tx-dialog__field">
                                <label>
                                    <FontAwesomeIcon icon={faCalendarDays} />
                                    <span>Date de vente</span>
                                    <span style={{ fontSize: "0.75rem", fontWeight: 400, color: "var(--text-muted)" }}>(optionnel)</span>
                                </label>
                                <input
                                    type="date"
                                    value={saleDate}
                                    onChange={(e) => setSaleDate(e.target.value)}
                                />
                            </div>

                            <div className="tx-dialog__field">
                                <label>
                                    <FontAwesomeIcon icon={faCoins} />
                                    <span>Prix de vente (€)</span>
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="ex: 12.00"
                                    value={salePrice}
                                    onChange={(e) => setSalePrice(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="tx-dialog__field">
                            <label>
                                <FontAwesomeIcon icon={faStore} />
                                <span>Lieu / Canal de vente (optionnel)</span>
                            </label>
                            <input
                                type="text"
                                placeholder="ex: Vinted, Brocante, Ami, etc."
                                value={saleLocation}
                                onChange={(e) => setSaleLocation(e.target.value)}
                            />
                        </div>

                        <div className="tx-dialog__field">
                            <label>
                                <FontAwesomeIcon icon={faNoteSticky} />
                                <span>Mémo / Remarques (optionnel)</span>
                            </label>
                            <textarea
                                placeholder="ex: Remise en main propre, lot de 3 tomes..."
                                value={saleMemo}
                                onChange={(e) => setSaleMemo(e.target.value)}
                            />
                        </div>

                        <div className="tx-dialog__actions">
                            <button
                                type="button"
                                className="tx-dialog__btn-cancel"
                                onClick={() => setSaleModalOpen(false)}
                            >
                                Annuler
                            </button>
                            <button
                                type="submit"
                                disabled={submittingSale}
                                className="tx-dialog__btn-submit tx-dialog__btn-submit--sold"
                            >
                                <FontAwesomeIcon icon={faCheck} />
                                <span>{submittingSale ? "Validation..." : "Valider la vente"}</span>
                            </button>
                        </div>
                    </form>
                </div>
            </Dialog>
        </div>
    );
}
