import { WrapperHeader } from "../../components/Wrapper/Wrapper.tsx";
import { useEffect, useState, useMemo, useCallback } from "react";
import useSession from "../../hooks/UseSession.tsx";
import Pagination from "../../components/Pagination/Pagination.tsx";
import BookSummaryDTO from "../../dto/BookSummary.dto.ts";
import { Dialog } from "@mui/material";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faBook,
    faLayerGroup,
    faRightLeft,
    faArrowDown,
    faArrowUp,
    faBorderAll,
    faList,
    faStar,
    faGem,
    faCheck,
    faPen,
    faUser,
    faCalendarDays,
    faXmark,
    faNoteSticky,
    faPlus
} from "@fortawesome/free-solid-svg-icons";
import { useSnackbar } from "notistack";
import Select, {
    type CategoryOption,
    DEFAULT_APP_CATEGORIES,
    bookMatchesCategories
} from "../../components/Select/Select.tsx";
import BookCard from "../../components/BookCard/BookCard.tsx";
import useLanguage from "../../hooks/UseLanguage.tsx";
import { detectEditionBadge } from "../../utils/editionBadge.ts";
import "./LoansPage.scss";
import SearchBar from "../../components/SearchBar/SearchBar.tsx";
import PageControls from "../../components/PageControls/PageControls.tsx";
import HeaderFilterTabs from "../../components/HeaderFilterTabs/HeaderFilterTabs.tsx";

type LoanTypeFilter = "all" | "BORROWED" | "LENT";
type DisplayMode = "grid" | "list";

interface LoanTab {
    id: LoanTypeFilter;
    labelEn: string;
    labelFr: string;
    icon?: typeof faRightLeft;
}

interface HoveredCoverState {
    url: string;
    title: string;
    x: number;
    y: number;
}

const LOAN_TABS: LoanTab[] = [
    { id: "all", labelEn: "All", labelFr: "Tous", icon: faLayerGroup },
    { id: "BORROWED", labelEn: "Borrowed", labelFr: "Emprunté", icon: faArrowDown },
    { id: "LENT", labelEn: "Lent", labelFr: "Prêté", icon: faArrowUp }
];

function formatShortDate(dateStr?: string | null, locale?: string): string {
    if (!dateStr) return "—";
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) return dateStr;
    return parsed.toLocaleDateString(locale || "fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function isDateOverdue(dateStr?: string | null): boolean {
    if (!dateStr) return false;
    const due = new Date(dateStr);
    if (isNaN(due.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today;
}

export default function LoansPage() {
    const session = useSession();
    const { tr, locale, translateCategory } = useLanguage();
    const { enqueueSnackbar } = useSnackbar();
    const navigate = useNavigate();
    const location = useLocation();
    const { tab } = useParams<{ tab?: string }>();
    const basePath = location.pathname.startsWith("/app/emprunts") ? "/app/emprunts" : "/app/loans";

    const [books, setBooks] = useState<BookSummaryDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

    const tabFromUrl = tab?.toLowerCase();
    const selectedType: LoanTypeFilter =
        tabFromUrl === "borrowed" || tabFromUrl === "emprunte"
            ? "BORROWED"
            : tabFromUrl === "lent" || tabFromUrl === "prete"
                ? "LENT"
                : "all";

    const handleTypeChange = (type: LoanTypeFilter) => {
        if (type === "all") {
            navigate(basePath);
        } else if (type === "BORROWED") {
            navigate(`${basePath}/borrowed`);
        } else {
            navigate(`${basePath}/lent`);
        }
    };

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

    const [displayMode, setDisplayMode] = useState<DisplayMode>(() => {
        try {
            const saved = localStorage.getItem("loans_display_mode");
            if (saved === "grid" || saved === "list") return saved;
        } catch { /* ignore storage errors */ }
        return "grid";
    });

    const [currentPage, setCurrentPage] = useState(1);
    const [gridPageSize, setGridPageSize] = useState(24);
    const [listPageSize, setListPageSize] = useState(50);

    // Edit loan modal state
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editTargetBook, setEditTargetBook] = useState<BookSummaryDTO | null>(null);
    const [editType, setEditType] = useState<"BORROWED" | "LENT">("LENT");
    const [editPerson, setEditPerson] = useState("");
    const [editLoanDate, setEditLoanDate] = useState("");
    const [editDueDate, setEditDueDate] = useState("");
    const [editMemo, setEditMemo] = useState("");
    const [submittingEdit, setSubmittingEdit] = useState(false);

    const handleOpenEditModal = (e: React.MouseEvent, book: BookSummaryDTO) => {
        e.preventDefault();
        e.stopPropagation();
        setEditTargetBook(book);
        const type = (book.loanType || book.status || "LENT").toUpperCase() === "BORROWED" ? "BORROWED" : "LENT";
        setEditType(type);
        setEditPerson(book.loanPerson || "");
        setEditLoanDate(book.loanDate || "");
        setEditDueDate(book.loanDueDate || "");
        setEditMemo(book.loanMemo || "");
        setEditModalOpen(true);
    };

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editTargetBook || submittingEdit) return;

        setSubmittingEdit(true);
        try {
            const res = await session.customFetch(`/user/loans/${encodeURIComponent(editTargetBook.id)}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: editType,
                    personName: editPerson.trim() || null,
                    loanDate: editLoanDate.trim() || null,
                    dueDate: editDueDate.trim() || null,
                    memo: editMemo.trim() || null
                })
            });

            if (res.ok) {
                const updated: BookSummaryDTO = await res.json();
                setBooks((prev) =>
                    prev.map((b) =>
                        b.id === editTargetBook.id
                            ? {
                                ...b,
                                status: updated.loanType || editType,
                                loanType: updated.loanType || editType,
                                loanPerson: updated.loanPerson ?? (editPerson.trim() || null),
                                loanDate: updated.loanDate ?? (editLoanDate.trim() || null),
                                loanDueDate: updated.loanDueDate ?? (editDueDate.trim() || null),
                                loanMemo: updated.loanMemo ?? (editMemo.trim() || null)
                            }
                            : b
                    )
                );
                enqueueSnackbar(tr("Loan updated successfully!", "Emprunt mis à jour avec succès !"), { variant: "success" });
                setEditModalOpen(false);
            } else {
                let errMsg = tr("Error updating loan", "Erreur lors de la mise à jour de l'emprunt");
                try {
                    const errData = await res.json();
                    errMsg = errData.message || errData.error || errMsg;
                } catch {
                    const text = await res.text().catch(() => "");
                    if (text) errMsg = text;
                }
                enqueueSnackbar(errMsg, { variant: "error" });
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            enqueueSnackbar(`${tr("Error", "Erreur")}: ${message}`, { variant: "error" });
        } finally {
            setSubmittingEdit(false);
        }
    };

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
        setHoveredCover((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null));
    };

    const handleMouseLeaveTitle = () => {
        setHoveredCover(null);
    };

    const handleSetDisplayMode = (mode: DisplayMode) => {
        setDisplayMode(mode);
        setCurrentPage(1);
        try {
            localStorage.setItem("loans_display_mode", mode);
        } catch { /* ignore storage errors */ }
    };

    const fetchLoans = useCallback(() => {
        setLoading(true);
        session.customFetch("/user/loans", { method: "GET" })
            .then(async (res) => {
                if (res.ok) {
                    const data: BookSummaryDTO[] = await res.json();
                    setBooks(data);
                } else {
                    setBooks([]);
                }
            })
            .catch((err) => {
                console.error("Loans fetch error:", err);
                setBooks([]);
            })
            .finally(() => {
                setLoading(false);
            });
    }, [session]);

    useEffect(() => {
        queueMicrotask(() => fetchLoans());
        const handleLoansUpdated = () => fetchLoans();
        window.addEventListener("loans-updated", handleLoansUpdated);
        return () => window.removeEventListener("loans-updated", handleLoansUpdated);
    }, [fetchLoans]);

    const handleReturnBook = async (e: React.MouseEvent, book: BookSummaryDTO) => {
        e.preventDefault();
        e.stopPropagation();
        if (actionLoadingId != null) return;

        const isLent = (book.loanType || book.status || "").toUpperCase() === "LENT";
        const confirmMsg = isLent
            ? tr(`Mark "${book.title}" as returned?`, `Marquer « ${book.title} » comme rendu ?`)
            : tr(`Mark "${book.title}" as returned to its owner?`, `Marquer « ${book.title} » comme restitué ?`);

        if (!window.confirm(confirmMsg)) return;

        setActionLoadingId(book.id);
        try {
            const res = await session.customFetch(`/user/loans/${encodeURIComponent(book.id)}`, {
                method: "DELETE"
            });
            if (res.ok) {
                setBooks((prev) => prev.filter((b) => b.id !== book.id));
                enqueueSnackbar(
                    tr("Book marked as returned!", "Livre marqué comme rendu !"),
                    { variant: "success" }
                );
            } else {
                enqueueSnackbar(tr("Error removing loan", "Erreur lors du retrait de l'emprunt"), { variant: "error" });
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            enqueueSnackbar(`${tr("Error", "Erreur")}: ${message}`, { variant: "error" });
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleOpenSearchModal = () => {
        window.dispatchEvent(new CustomEvent("open-loan-modal"));
    };

    // Reset page to 1 whenever filters change
    const filtersKey = `${selectedType}|${selectedCategories.join(",")}|${searchQuery}`;
    const [prevFiltersKey, setPrevFiltersKey] = useState(filtersKey);
    if (prevFiltersKey !== filtersKey) {
        setPrevFiltersKey(filtersKey);
        setCurrentPage(1);
    }

    const typeCounts = useMemo(() => {
        const counts: Record<LoanTypeFilter, number> = {
            all: books.length,
            BORROWED: 0,
            LENT: 0
        };
        for (const b of books) {
            const loanType = (b.loanType || b.status || "").toUpperCase();
            if (loanType === "BORROWED") counts.BORROWED++;
            if (loanType === "LENT") counts.LENT++;
        }
        return counts;
    }, [books]);

    const filteredBooks = useMemo(() => {
        return books.filter((b) => {
            if (selectedType !== "all") {
                const loanType = (b.loanType || b.status || "").toUpperCase();
                if (loanType !== selectedType) return false;
            }

            if (selectedCategories.length > 0) {
                if (!bookMatchesCategories(b, selectedCategories)) return false;
            }

            if (searchQuery.trim().length > 0) {
                const q = searchQuery.toLowerCase().trim();
                const titleMatch = (b.title || "").toLowerCase().includes(q);
                const seriesMatch = (b.seriesName || "").toLowerCase().includes(q);
                const authorMatch = (b.author || "").toLowerCase().includes(q);
                const personMatch = (b.loanPerson || "").toLowerCase().includes(q);
                if (!titleMatch && !seriesMatch && !authorMatch && !personMatch) return false;
            }

            return true;
        });
    }, [books, selectedType, selectedCategories, searchQuery]);

    const totalFiltered = filteredBooks.length;
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
        <div className="loans-page">
            <WrapperHeader>
                <HeaderFilterTabs
                    tabs={LOAN_TABS.map((t) => ({
                        id: t.id,
                        label: tr(t.labelEn, t.labelFr),
                        icon: t.icon,
                        count: typeCounts[t.id]
                    }))}
                    selectedId={selectedType}
                    onChange={handleTypeChange}
                />
            </WrapperHeader>

            <div className="loans-page__content">
                {books.length > 0 && (
                    <PageControls
                        left={
                            <Select
                                multiple
                                translateOptions
                                options={availableCategories}
                                selected={selectedCategories}
                                onChange={(cats) => {
                                    setSelectedCategories(cats);
                                    if (currentPage !== 1) setCurrentPage(1);
                                }}
                                allLabel={tr("All categories", "Toutes les catégories")}
                            />
                        }
                        center={
                            <SearchBar
                                value={searchQuery}
                                onChange={setSearchQuery}
                                placeholder={tr("Search a loan or person...", "Rechercher un emprunt ou une personne...")}
                                clearLabel={tr("Clear search", "Effacer la recherche")}
                            />
                        }
                        right={
                            <div className="loans-page__view-toggle">
                                <button
                                    type="button"
                                    className={`loans-page__view-btn ${displayMode === "grid" ? "is-active" : ""}`}
                                    onClick={() => handleSetDisplayMode("grid")}
                                    title={tr("Gallery view", "Mode Galerie")}
                                >
                                    <FontAwesomeIcon icon={faBorderAll} />
                                    <span>{tr("Gallery", "Galerie")}</span>
                                </button>
                                <button
                                    type="button"
                                    className={`loans-page__view-btn ${displayMode === "list" ? "is-active" : ""}`}
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

                {loading ? (
                    <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
                        {tr("Loading your loans...", "Chargement de vos emprunts...")}
                    </div>
                ) : books.length === 0 ? (
                    <div className="loans-page__empty">
                        <div className="loans-page__empty-icon">
                            <FontAwesomeIcon icon={faRightLeft} />
                        </div>
                        <h3>{tr("No borrowed or lent books right now", "Aucun livre prêté ou emprunté pour le moment")}</h3>
                        <p>
                            {tr(
                                "Track the books you lend to friends or borrow from others. Click below or use the + button to search for a book.",
                                "Suivez les livres que vous prêtez à vos proches ou que vous empruntez. Cliquez ci-dessous ou utilisez le bouton + pour chercher un livre."
                            )}
                        </p>
                        <button
                            type="button"
                            className="loans-page__empty-cta"
                            onClick={handleOpenSearchModal}
                        >
                            <FontAwesomeIcon icon={faPlus} />
                            <span>{tr("Search for a book to lend / borrow", "Chercher un livre à prêter / emprunter")}</span>
                        </button>
                    </div>
                ) : totalFiltered === 0 ? (
                    <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
                        {tr("No books match your loan filters.", "Aucun album ne correspond à vos filtres d'emprunt.")}
                    </div>
                ) : (
                    <>
                        {displayMode === "grid" ? (
                            <div className="booklist">
                                {paginatedBooks.map((book) => {
                                    const loanType = (book.loanType || book.status || "LENT").toUpperCase();
                                    const isLent = loanType === "LENT";
                                    const isActionLoading = actionLoadingId === book.id;

                                    return (
                                        <BookCard
                                            key={book.id}
                                            book={book}
                                            className={`loan-card ${isLent ? "is-lent" : "is-borrowed"}`}
                                            badgeText={book.volume > 0 ? tr(`Vol.${book.volume}`, `T.${book.volume}`) : undefined}
                                            statusBadge={
                                                <span className={`loan-card-badge loan-card-badge--${isLent ? "lent" : "borrowed"}`}>
                                                    <FontAwesomeIcon icon={isLent ? faArrowUp : faArrowDown} />
                                                    <span>
                                                        {isLent ? tr("Lent", "Prêté") : tr("Borrowed", "Emprunté")}
                                                        {book.loanPerson ? ` • ${book.loanPerson}` : ""}
                                                    </span>
                                                </span>
                                            }
                                            actions={
                                                <>
                                                    <button
                                                        type="button"
                                                        disabled={isActionLoading}
                                                        onClick={(e) => handleOpenEditModal(e, book)}
                                                        className="book-card__action-btn book-card__action-btn--edit"
                                                        title={tr("Edit loan details", "Modifier les détails")}
                                                        aria-label={tr("Edit loan details", "Modifier les détails")}
                                                    >
                                                        <FontAwesomeIcon icon={faPen} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={isActionLoading}
                                                        onClick={(e) => handleReturnBook(e, book)}
                                                        className="book-card__action-btn book-card__action-btn--sold"
                                                        title={tr("Mark as returned", "Marquer comme rendu")}
                                                        aria-label={tr("Mark as returned", "Marquer comme rendu")}
                                                    >
                                                        <FontAwesomeIcon icon={faCheck} />
                                                    </button>
                                                </>
                                            }
                                        />
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="loans-list">
                                <div className="loans-list__header">
                                    <span className="loans-list__th loans-list__th--title">{tr("Title", "Titre")}</span>
                                    <span className="loans-list__th loans-list__th--series">{tr("Series / Vol.", "Série / Tome")}</span>
                                    <span className="loans-list__th loans-list__th--person">{tr("Person", "Personne")}</span>
                                    <span className="loans-list__th loans-list__th--category">{tr("Category", "Catégorie")}</span>
                                    <span className="loans-list__th loans-list__th--date">{tr("Date", "Date")}</span>
                                    <span className="loans-list__th loans-list__th--due">{tr("Expected return", "Retour prévu")}</span>
                                    <span className="loans-list__th loans-list__th--status">{tr("Status", "Statut")}</span>
                                    <span className="loans-list__th loans-list__th--action">{tr("Actions", "Actions")}</span>
                                </div>

                                {paginatedBooks.map((book) => {
                                    const loanType = (book.loanType || book.status || "LENT").toUpperCase();
                                    const isLent = loanType === "LENT";
                                    const isActionLoading = actionLoadingId === book.id;
                                    const editionBadge = detectEditionBadge(book);
                                    const overdue = isDateOverdue(book.loanDueDate);

                                    return (
                                        <div
                                            key={book.id}
                                            className={`loans-row ${isLent ? "is-lent" : "is-borrowed"}`}
                                        >
                                            <div className="loans-row__col loans-row__col--title">
                                                <Link
                                                    to={`/app/book/${book.id}`}
                                                    className="loans-row__title-link"
                                                    onMouseEnter={(e) => handleMouseEnterTitle(e, book.coverUrl, book.title)}
                                                    onMouseMove={handleMouseMoveTitle}
                                                    onMouseLeave={handleMouseLeaveTitle}
                                                >
                                                    <span className="loans-row__title-text">{book.title}</span>
                                                    {editionBadge && (
                                                        <span className={`loans-edition-badge loans-edition-badge--${editionBadge.type}`} title={editionBadge.label}>
                                                            <FontAwesomeIcon icon={editionBadge.type === "limited" ? faGem : faStar} />
                                                            <span>{editionBadge.label}</span>
                                                        </span>
                                                    )}
                                                </Link>
                                            </div>

                                            <div className="loans-row__col loans-row__col--series">
                                                {book.seriesName ? (
                                                    <span className="loans-row__series">
                                                        {book.seriesName}
                                                        {book.volume > 0 && (
                                                            <span className="loans-row__vol"> {tr(`Vol.${book.volume}`, `T.${book.volume}`)}</span>
                                                        )}
                                                    </span>
                                                ) : book.volume > 0 ? (
                                                    <span className="loans-row__vol">{tr(`Vol. ${book.volume}`, `Tome ${book.volume}`)}</span>
                                                ) : (
                                                    <span className="loans-row__muted">—</span>
                                                )}
                                            </div>

                                            <div className="loans-row__col loans-row__col--person">
                                                {book.loanPerson ? (
                                                    <span className="loans-row__person">
                                                        <FontAwesomeIcon icon={faUser} />
                                                        <span>{book.loanPerson}</span>
                                                    </span>
                                                ) : (
                                                    <span className="loans-row__muted">—</span>
                                                )}
                                            </div>

                                            <div className="loans-row__col loans-row__col--category">
                                                {book.category ? (
                                                    <span className="loans-row__category">{translateCategory(book.category)}</span>
                                                ) : (
                                                    <span className="loans-row__muted">—</span>
                                                )}
                                            </div>

                                            <div className="loans-row__col loans-row__col--date">
                                                <span className="loans-row__date">{formatShortDate(book.loanDate, locale)}</span>
                                            </div>

                                            <div className="loans-row__col loans-row__col--due">
                                                <span className={`loans-row__date ${overdue ? "loans-row__date--overdue" : ""}`}>
                                                    {formatShortDate(book.loanDueDate, locale)}
                                                </span>
                                            </div>

                                            <div className="loans-row__col loans-row__col--status">
                                                <span className={`loans-status-badge loans-status-badge--${isLent ? "lent" : "borrowed"}`}>
                                                    <FontAwesomeIcon icon={isLent ? faArrowUp : faArrowDown} />
                                                    <span>{isLent ? tr("Lent", "Prêté") : tr("Borrowed", "Emprunté")}</span>
                                                </span>
                                            </div>

                                            <div className="loans-row__col loans-row__col--action">
                                                <button
                                                    type="button"
                                                    disabled={isActionLoading}
                                                    onClick={(e) => handleOpenEditModal(e, book)}
                                                    className="loans-row__action-btn loans-row__action-btn--edit"
                                                    title={tr("Edit loan details", "Modifier les détails")}
                                                >
                                                    <FontAwesomeIcon icon={faPen} />
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={isActionLoading}
                                                    onClick={(e) => handleReturnBook(e, book)}
                                                    className="loans-row__action-btn loans-row__action-btn--return"
                                                    title={tr("Mark as returned", "Marquer comme rendu")}
                                                >
                                                    <FontAwesomeIcon icon={faCheck} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {displayMode === "list" && hoveredCover && (
                            <div
                                className="loans-cursor-preview"
                                style={getCursorPreviewStyle(hoveredCover.x, hoveredCover.y)}
                            >
                                <img src={hoveredCover.url} alt={hoveredCover.title} />
                                <span className="loans-cursor-preview__title">{hoveredCover.title}</span>
                            </div>
                        )}

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

            {/* Edit Loan Modal */}
            <Dialog
                open={editModalOpen}
                onClose={() => setEditModalOpen(false)}
                slotProps={{ paper: {
                    style: {
                        backgroundColor: "var(--bg-surface, #1e1e24)",
                        border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))",
                        borderRadius: "16px",
                        maxWidth: "460px",
                        width: "100%",
                        padding: "24px",
                        color: "var(--text-primary)"
                    }
                }}}
            >
                <div className="loan-dialog">
                    <div className="loan-dialog__header">
                        <div className="loan-dialog__header-title">
                            <FontAwesomeIcon icon={faRightLeft} style={{ color: "var(--accent-primary)" }} />
                            <h3>{tr("Edit loan", "Modifier l'emprunt")}</h3>
                        </div>
                        <button
                            type="button"
                            className="loan-dialog__header-close"
                            onClick={() => setEditModalOpen(false)}
                            aria-label={tr("Close", "Fermer")}
                        >
                            <FontAwesomeIcon icon={faXmark} />
                        </button>
                    </div>

                    {editTargetBook && (
                        <p className="loan-dialog__subtitle">
                            {tr("Update loan details for", "Modifiez les informations pour")} <strong>« {editTargetBook.title} »</strong> :
                        </p>
                    )}

                    <form className="loan-dialog__form" onSubmit={handleSaveEdit}>
                        <div className="fab-loan-type-toggle">
                            <button
                                type="button"
                                className={`fab-loan-type-btn fab-loan-type-btn--borrowed ${editType === "BORROWED" ? "is-active" : ""}`}
                                onClick={() => setEditType("BORROWED")}
                            >
                                <FontAwesomeIcon icon={faArrowDown} />
                                <span>{tr("Borrowed", "Emprunté")}</span>
                            </button>
                            <button
                                type="button"
                                className={`fab-loan-type-btn fab-loan-type-btn--lent ${editType === "LENT" ? "is-active" : ""}`}
                                onClick={() => setEditType("LENT")}
                            >
                                <FontAwesomeIcon icon={faArrowUp} />
                                <span>{tr("Lent", "Prêté")}</span>
                            </button>
                        </div>

                        <div className="loan-dialog__field">
                            <label>
                                <FontAwesomeIcon icon={faUser} />
                                <span>{editType === "LENT" ? tr("Lent to", "Prêté à") : tr("Borrowed from", "Emprunté à")}</span>
                            </label>
                            <input
                                type="text"
                                placeholder={editType === "LENT" ? tr("e.g. Thomas, Marie...", "ex: Thomas, Marie...") : tr("e.g. Library, Thomas...", "ex: Médiathèque, Thomas...")}
                                value={editPerson}
                                onChange={(e) => setEditPerson(e.target.value)}
                            />
                        </div>

                        <div className="loan-dialog__grid">
                            <div className="loan-dialog__field">
                                <label>
                                    <FontAwesomeIcon icon={faCalendarDays} />
                                    <span>{editType === "LENT" ? tr("Lend date", "Date du prêt") : tr("Borrow date", "Date d'emprunt")}</span>
                                </label>
                                <input
                                    type="date"
                                    value={editLoanDate}
                                    onChange={(e) => setEditLoanDate(e.target.value)}
                                />
                            </div>

                            <div className="loan-dialog__field">
                                <label>
                                    <FontAwesomeIcon icon={faCalendarDays} />
                                    <span>{tr("Expected return", "Retour prévu")}</span>
                                </label>
                                <input
                                    type="date"
                                    value={editDueDate}
                                    onChange={(e) => setEditDueDate(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="loan-dialog__field">
                            <label>
                                <FontAwesomeIcon icon={faNoteSticky} />
                                <span>{tr("Memo / Notes (optional)", "Mémo / Remarques (optionnel)")}</span>
                            </label>
                            <textarea
                                placeholder={tr("e.g. Return before summer...", "ex: À rendre avant cet été...")}
                                value={editMemo}
                                onChange={(e) => setEditMemo(e.target.value)}
                            />
                        </div>

                        <div className="loan-dialog__actions">
                            <button
                                type="button"
                                className="loan-dialog__btn-cancel"
                                onClick={() => setEditModalOpen(false)}
                            >
                                {tr("Cancel", "Annuler")}
                            </button>
                            <button
                                type="submit"
                                disabled={submittingEdit}
                                className="loan-dialog__btn-submit"
                            >
                                <FontAwesomeIcon icon={faCheck} />
                                <span>{submittingEdit ? tr("Saving...", "Enregistrement...") : tr("Save", "Enregistrer")}</span>
                            </button>
                        </div>
                    </form>
                </div>
            </Dialog>
        </div>
    );
}
