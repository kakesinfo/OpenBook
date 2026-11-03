import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router";
import useSession from "../../hooks/UseSession.tsx";
import useLanguage from "../../hooks/UseLanguage.tsx";
import { useSnackbar } from "notistack";
import SeriesDTO, { getSeriesStatusLabel } from "../../dto/Series.dto.ts";
import BookSummaryDTO from "../../dto/BookSummary.dto.ts";
import { WrapperHeader } from "../../components/Wrapper/Wrapper.tsx";
import BookList from "../../components/BookList/BookList.tsx";
import { Dialog } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faArrowLeft,
    faBell,
    faCheck,
    faLayerGroup,
    faBook,
    faPen,
    faTrash,
    faPlus,
    faXmark,
    faBorderAll,
    faList,
    faMagnifyingGlass
} from "@fortawesome/free-solid-svg-icons";
import { useDebounce } from "../../hooks/UseDebounce.tsx";
import "./SeriesDetailPage.scss";

interface CategoryOption {
    id: number;
    name: string;
}

const DEFAULT_CATEGORIES: CategoryOption[] = [
    { id: 3, name: "Comics" },
    { id: 2, name: "Bande dessinée" },
    { id: 4, name: "Manga" },
    { id: 5, name: "Roman Graphique" },
    { id: 1, name: "Roman" },
    { id: 6, name: "Beau-livre" },
];

export default function SeriesDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const session = useSession();
    const { tr, translateCategory } = useLanguage();
    const { enqueueSnackbar } = useSnackbar();

    const [series, setSeries] = useState<SeriesDTO | null>(null);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const [searchQuery, setSearchQuery] = useState("");

    // Edit Series Dialog
    const [categories, setCategories] = useState<CategoryOption[]>(DEFAULT_CATEGORIES);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editName, setEditName] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [editCategoryId, setEditCategoryId] = useState<number>(3);
    const [editStatus, setEditStatus] = useState("ON_GOING");
    const [editing, setEditing] = useState(false);

    // Add Book to Series Dialog
    const [addBookDialogOpen, setAddBookDialogOpen] = useState(false);
    const [bookSearchQuery, setBookSearchQuery] = useState("");
    const [bookSearchResults, setBookSearchResults] = useState<BookSummaryDTO[]>([]);
    const [searchingBooks, setSearchingBooks] = useState(false);
    const [selectedBookForAdd, setSelectedBookForAdd] = useState<BookSummaryDTO | null>(null);
    const [addVolume, setAddVolume] = useState<number>(1);
    const [addingBook, setAddingBook] = useState(false);

    // Fetch Series data
    const fetchSeries = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const res = await session.customFetch(`/series/${id}`, { method: "GET" });
            if (res.ok) {
                const data: SeriesDTO = await res.json();
                setSeries(data);
            } else {
                enqueueSnackbar(tr("Series not found", "Série introuvable"), { variant: "error" });
            }
        } catch (err) {
            console.error("Error loading series detail:", err);
            enqueueSnackbar(tr("Error loading series", "Erreur lors du chargement de la série"), { variant: "error" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSeries();
    }, [id, session]);

    // Fetch categories for edit dialog
    useEffect(() => {
        session.customFetch("/series/categories", { method: "GET" })
            .then(async (res) => {
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data) && data.length > 0) {
                        setCategories(data);
                    }
                }
            })
            .catch(() => {});
    }, [session]);

    // Toggle follow
    const handleToggleFollow = async () => {
        if (!series) return;
        const newState = !series.isFollowed;

        // Optimistic update
        setSeries((prev) => (prev ? { ...prev, isFollowed: newState } : null));

        try {
            const res = await session.customFetch(`/user/follows/series/${series.id}/toggle`, {
                method: "POST"
            });
            if (res.ok) {
                const data = await res.json();
                const followed = Boolean(data.following);
                setSeries((prev) => (prev ? { ...prev, isFollowed: followed } : null));
                enqueueSnackbar(
                    followed
                        ? tr("Series added to your followed list", "Série ajoutée à vos suivis")
                        : tr("Series removed from your followed list", "Série retirée de vos suivis"),
                    { variant: "info" }
                );
            }
        } catch (err) {
            console.error("Error toggling follow:", err);
            setSeries((prev) => (prev ? { ...prev, isFollowed: !newState } : null));
            enqueueSnackbar(tr("Error updating follow status", "Erreur lors de la modification du suivi"), { variant: "error" });
        }
    };

    // Debounced book search for Add Book Dialog
    useDebounce(bookSearchQuery, 300, (value) => {
        const trimmed = value?.trim();
        if (!trimmed) {
            setBookSearchResults([]);
            setSearchingBooks(false);
            return;
        }
        setSearchingBooks(true);
        session.customFetch(`/books/search?query=${encodeURIComponent(trimmed)}`, { method: "GET" })
            .then(async (res) => {
                if (res.ok) {
                    const results: BookSummaryDTO[] = await res.json();
                    setBookSearchResults(results);
                }
            })
            .catch((err) => console.error("Search books error:", err))
            .finally(() => setSearchingBooks(false));
    });

    // Handle Open Edit
    const handleOpenEdit = () => {
        if (!series) return;
        setEditName(series.name);
        setEditDescription(series.description || "");
        setEditCategoryId(series.categoryId || 3);
        setEditStatus(series.status || "ON_GOING");
        setEditDialogOpen(true);
    };

    // Handle Save Edit
    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!series || !editName.trim()) return;

        setEditing(true);
        try {
            const res = await session.customFetch(`/series/${series.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: editName.trim(),
                    description: editDescription.trim(),
                    categoryId: editCategoryId,
                    status: editStatus
                })
            });

            if (res.ok) {
                const updated: SeriesDTO = await res.json();
                enqueueSnackbar(tr("Series information updated", "Informations de la série mises à jour"), { variant: "success" });
                setSeries(updated);
                setEditDialogOpen(false);
            } else {
                const errData = await res.text();
                enqueueSnackbar(`${tr("Error", "Erreur")}: ${errData}`, { variant: "error" });
            }
        } catch (err: any) {
            enqueueSnackbar(`${tr("Error", "Erreur")}: ${err.message}`, { variant: "error" });
        } finally {
            setEditing(false);
        }
    };

    // Handle Delete Series
    const handleDeleteSeries = async () => {
        if (!series) return;
        const confirm = window.confirm(
            tr(
                `Are you sure you want to delete the series "${series.name}"? Associated books will not be deleted, but will no longer belong to this series.`,
                `Êtes-vous sûr de vouloir supprimer la série « ${series.name} » ? Les albums associés ne seront pas supprimés, mais ne feront plus partie de cette série.`
            )
        );
        if (!confirm) return;

        try {
            const res = await session.customFetch(`/series/${series.id}`, { method: "DELETE" });
            if (res.ok) {
                enqueueSnackbar(tr("Series deleted successfully", "Série supprimée avec succès"), { variant: "success" });
                navigate("/app/series");
            } else {
                enqueueSnackbar(tr("Error deleting series", "Erreur lors de la suppression de la série"), { variant: "error" });
            }
        } catch (err) {
            console.error("Delete error:", err);
            enqueueSnackbar(tr("Connection error", "Erreur de connexion"), { variant: "error" });
        }
    };

    // Open Add Book Dialog
    const handleOpenAddBook = () => {
        if (!series) return;
        setBookSearchQuery("");
        setBookSearchResults([]);
        setSelectedBookForAdd(null);
        const maxVol = (series.books || []).reduce(
            (max, b) => (b.volume && b.volume > max ? b.volume : max),
            0
        );
        setAddVolume(maxVol + 1);
        setAddBookDialogOpen(true);
    };

    // Add Book to Series
    const handleAddBookToSeries = async () => {
        if (!series || !selectedBookForAdd) return;

        setAddingBook(true);
        try {
            const res = await session.customFetch(`/series/${series.id}/books`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    bookId: selectedBookForAdd.id,
                    volume: addVolume
                })
            });

            if (res.ok) {
                const updatedSeries: SeriesDTO = await res.json();
                setSeries(updatedSeries);
                enqueueSnackbar(
                    tr(
                        `Book "${selectedBookForAdd.title}" added as volume ${addVolume}`,
                        `Album « ${selectedBookForAdd.title} » ajouté au tome ${addVolume}`
                    ),
                    {
                        variant: "success"
                    }
                );
                setAddBookDialogOpen(false);
            } else {
                enqueueSnackbar(tr("Error adding book", "Erreur lors de l'ajout de l'album"), { variant: "error" });
            }
        } catch (err: any) {
            enqueueSnackbar(`${tr("Error", "Erreur")}: ${err.message}`, { variant: "error" });
        } finally {
            setAddingBook(false);
        }
    };

    // Remove Book from Series
    const handleRemoveBookFromSeries = async (bookId: number | string, bookTitle: string) => {
        if (!series) return;
        const confirm = window.confirm(
            tr(
                `Remove "${bookTitle}" from series "${series.name}"?`,
                `Retirer « ${bookTitle} » de la série « ${series.name} » ?`
            )
        );
        if (!confirm) return;

        try {
            const res = await session.customFetch(`/series/${series.id}/books/${bookId}`, {
                method: "DELETE"
            });
            if (res.ok) {
                const updatedSeries: SeriesDTO = await res.json();
                setSeries(updatedSeries);
                enqueueSnackbar(tr("Book removed from series", "Album retiré de la série"), { variant: "info" });
            } else {
                enqueueSnackbar(tr("Error removing book", "Erreur lors du retrait de l'album"), { variant: "error" });
            }
        } catch (err) {
            console.error("Remove book error:", err);
            enqueueSnackbar(tr("Connection error", "Erreur de connexion"), { variant: "error" });
        }
    };

    // Update Book Volume Number
    const handleUpdateVolume = async (bookId: number | string, currentVol?: number) => {
        if (!series) return;
        const newVolStr = window.prompt(tr("Edit volume number:", "Modifier le numéro de tome :"), String(currentVol || 1));
        if (newVolStr === null) return;
        const newVol = parseInt(newVolStr.trim(), 10);
        if (isNaN(newVol)) {
            enqueueSnackbar(tr("Invalid volume number", "Numéro de tome invalide"), { variant: "warning" });
            return;
        }

        try {
            const res = await session.customFetch(`/series/${series.id}/books/${bookId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ volume: newVol })
            });
            if (res.ok) {
                const updated: SeriesDTO = await res.json();
                setSeries(updated);
                enqueueSnackbar(tr(`Volume updated: Volume ${newVol}`, `Tome mis à jour : Volume ${newVol}`), { variant: "success" });
            }
        } catch (err) {
            console.error("Update volume error:", err);
        }
    };

    // Filtered books
    const filteredBooks = useMemo(() => {
        if (!series?.books) return [];
        if (!searchQuery.trim()) return series.books;
        const q = searchQuery.toLowerCase().trim();
        return series.books.filter((b) =>
            b.title.toLowerCase().includes(q) ||
            (b.author && b.author.toLowerCase().includes(q)) ||
            (b.volume && String(b.volume).includes(q))
        );
    }, [series?.books, searchQuery]);

    if (loading) {
        return (
            <div className="series-detail-page">
                <WrapperHeader>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <button
                            type="button"
                            className="series-detail-page__back-btn"
                            onClick={() => navigate(-1)}
                            aria-label={tr("Back", "Retour")}
                        >
                            <FontAwesomeIcon icon={faArrowLeft} />
                        </button>
                        <h2 style={{ margin: 0 }}>{tr("Loading series...", "Chargement de la série...")}</h2>
                    </div>
                </WrapperHeader>
                <div className="series-detail-page__content">
                    <div className="series-detail-page__empty">
                        <p>{tr("Loading series information...", "Chargement des informations de la série...")}</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!series) {
        return (
            <div className="series-detail-page">
                <WrapperHeader>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <button
                            type="button"
                            className="series-detail-page__back-btn"
                            onClick={() => navigate(-1)}
                            aria-label={tr("Back", "Retour")}
                        >
                            <FontAwesomeIcon icon={faArrowLeft} />
                        </button>
                        <h2 style={{ margin: 0 }}>{tr("Series not found", "Série non trouvée")}</h2>
                    </div>
                </WrapperHeader>
                <div className="series-detail-page__content">
                    <div className="series-detail-page__empty">
                        <FontAwesomeIcon icon={faLayerGroup} className="series-detail-page__empty-icon" />
                        <h3>{tr("This series does not exist or has been deleted", "Cette série n'existe pas ou a été supprimée")}</h3>
                        <Link to="/app/series" className="series-detail-page__btn series-detail-page__btn--primary">
                            {tr("Back to series", "Retour aux séries")}
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const ownedCount = series.ownedCount || 0;
    const totalCount = series.books?.length || 0;
    const progressPercent = totalCount > 0 ? Math.round((ownedCount / totalCount) * 100) : 0;

    return (
        <div className="series-detail-page">
            <WrapperHeader>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", flexWrap: "wrap", gap: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <button
                            type="button"
                            className="series-detail-page__back-btn"
                            onClick={() => navigate(-1)}
                            aria-label={tr("Back", "Retour")}
                            title={tr("Back", "Retour")}
                        >
                            <FontAwesomeIcon icon={faArrowLeft} />
                        </button>
                        <h2 style={{ margin: 0 }}>{series.name}</h2>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                        <button
                            type="button"
                            className={`series-detail-page__follow-btn ${series.isFollowed ? "is-followed" : ""}`}
                            onClick={handleToggleFollow}
                            title={
                                series.isFollowed
                                    ? tr("Following series (click to unfollow)", "Série suivie (cliquer pour ne plus suivre)")
                                    : tr("Follow this series", "Suivre cette série")
                            }
                        >
                            <FontAwesomeIcon icon={series.isFollowed ? faCheck : faBell} />
                            <span>{series.isFollowed ? tr("Following series", "Série suivie") : tr("Follow series", "Suivre la série")}</span>
                        </button>

                        <button
                            type="button"
                            className="series-detail-page__action-btn"
                            onClick={handleOpenEdit}
                            title={tr("Edit series", "Modifier la série")}
                        >
                            <FontAwesomeIcon icon={faPen} />
                            <span>{tr("Edit", "Modifier")}</span>
                        </button>

                        <button
                            type="button"
                            className="series-detail-page__action-btn series-detail-page__action-btn--primary"
                            onClick={handleOpenAddBook}
                            title={tr("Link a book to this series", "Lier un album à cette série")}
                        >
                            <FontAwesomeIcon icon={faPlus} />
                            <span>{tr("Link a book", "Lier un album")}</span>
                        </button>
                    </div>
                </div>
            </WrapperHeader>

            <div className="series-detail-page__content">
                {/* Hero / Information Card */}
                <div className="series-detail-hero">
                    <div className="series-detail-hero__cover">
                        {series.coverUrl ? (
                            <img src={series.coverUrl} alt={tr(`Cover of ${series.name}`, `Couverture de ${series.name}`)} />
                        ) : (
                            <div className="series-detail-hero__cover-fallback">
                                <FontAwesomeIcon icon={faLayerGroup} />
                            </div>
                        )}
                    </div>

                    <div className="series-detail-hero__info">
                        <div className="series-detail-hero__tags">
                            {series.category && (
                                <span className="series-detail-hero__tag series-detail-hero__tag--category">
                                    {translateCategory(series.category)}
                                </span>
                            )}
                            {series.status && (
                                <span className={`series-detail-hero__tag series-detail-hero__tag--status ${series.status === "FINISHED" ? "status-finished" : ""}`}>
                                    {getSeriesStatusLabel(series.status)}
                                </span>
                            )}
                            <span className="series-detail-hero__tag series-detail-hero__tag--neutral">
                                {totalCount} {totalCount > 1 ? tr("books in series", "albums dans la série") : tr("book in series", "album dans la série")}
                            </span>
                        </div>

                        <h1 className="series-detail-hero__title">{series.name}</h1>

                        {series.description && (
                            <p className="series-detail-hero__desc">{series.description}</p>
                        )}

                        {/* Progress Bar & Stats */}
                        <div className="series-detail-hero__stats">
                            <div className="series-detail-hero__progress-header">
                                <span className="series-detail-hero__progress-label">
                                    <FontAwesomeIcon icon={faBook} /> {tr("Collection progress", "Progression dans votre collection")}
                                </span>
                                <span className="series-detail-hero__progress-val">
                                    <strong>{ownedCount}</strong> / {totalCount} {ownedCount > 1 ? tr("owned", "possédés") : tr("owned", "possédé")} ({progressPercent}%)
                                </span>
                            </div>
                            <div className="series-detail-hero__progress-bar">
                                <div
                                    className="series-detail-hero__progress-fill"
                                    style={{ width: `${Math.min(100, progressPercent)}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Albums section header and controls */}
                <div className="series-detail-albums-header">
                    <div className="series-detail-albums-header__left">
                        <h3>{tr("Books", "Albums")} ({filteredBooks.length})</h3>
                    </div>

                    <div className="series-detail-albums-header__right">
                        <div className="series-detail-albums-header__search">
                            <FontAwesomeIcon icon={faMagnifyingGlass} />
                            <input
                                type="text"
                                placeholder={tr("Filter books...", "Filtrer les albums...")}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button type="button" onClick={() => setSearchQuery("")}>
                                    <FontAwesomeIcon icon={faXmark} />
                                </button>
                            )}
                        </div>

                        <div className="series-detail-albums-header__view-mode">
                            <button
                                type="button"
                                className={`series-detail-albums-header__mode-btn ${viewMode === "grid" ? "is-active" : ""}`}
                                onClick={() => setViewMode("grid")}
                                title={tr("Grid view", "Affichage grille")}
                                aria-label={tr("Grid view", "Affichage grille")}
                            >
                                <FontAwesomeIcon icon={faBorderAll} />
                            </button>
                            <button
                                type="button"
                                className={`series-detail-albums-header__mode-btn ${viewMode === "list" ? "is-active" : ""}`}
                                onClick={() => setViewMode("list")}
                                title={tr("List view", "Affichage liste")}
                                aria-label={tr("List view", "Affichage liste")}
                            >
                                <FontAwesomeIcon icon={faList} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Albums content */}
                {filteredBooks.length === 0 ? (
                    <div className="series-detail-page__empty">
                        <FontAwesomeIcon icon={faBook} className="series-detail-page__empty-icon" />
                        <h3>
                            {searchQuery
                                ? tr("No books match your search", "Aucun album ne correspond à votre recherche")
                                : tr("No books are linked to this series yet", "Aucun album n'est encore associé à cette série")}
                        </h3>
                        <p>
                            {searchQuery
                                ? tr("Try other keywords to find the book.", "Essayez d'autres mots-clés pour retrouver l'album.")
                                : tr("Link your first book to this series to start the collection!", "Associez votre premier album à cette série pour commencer la collection !")}
                        </p>
                        {!searchQuery && (
                            <button
                                type="button"
                                className="series-detail-page__btn series-detail-page__btn--primary"
                                onClick={handleOpenAddBook}
                            >
                                <FontAwesomeIcon icon={faPlus} />
                                <span>{tr("Link a book", "Associer un album")}</span>
                            </button>
                        )}
                    </div>
                ) : viewMode === "grid" ? (
                    <BookList books={filteredBooks} />
                ) : (
                    <div className="series-detail-list">
                        {filteredBooks.map((b) => (
                            <div key={b.id} className="series-detail-list-item">
                                <button
                                    type="button"
                                    className="series-detail-list-item__vol"
                                    onClick={() => handleUpdateVolume(b.id, b.volume)}
                                    title={tr("Edit volume", "Modifier le tome")}
                                >
                                    {tr("Vol.", "T.")}{b.volume != null ? b.volume : "?"}
                                    <FontAwesomeIcon icon={faPen} style={{ fontSize: "0.65rem", opacity: 0.5 }} />
                                </button>

                                <div className="series-detail-list-item__thumb">
                                    {b.coverUrl ? (
                                        <img src={b.coverUrl} alt={b.title} />
                                    ) : (
                                        <FontAwesomeIcon icon={faBook} />
                                    )}
                                </div>

                                <div className="series-detail-list-item__info">
                                    <Link to={`/app/book/${b.id}`} className="series-detail-list-item__title">
                                        {b.title}
                                    </Link>
                                    <span className="series-detail-list-item__author">
                                        {b.author || tr("Author not specified", "Auteur non renseigné")}
                                    </span>
                                </div>

                                <div className="series-detail-list-item__badges">
                                    {b.status === "OWNED" && (
                                        <span className="series-detail-list-item__badge owned">{tr("Owned", "Possédé")}</span>
                                    )}
                                    {b.status === "WISHLISTED" && (
                                        <span className="series-detail-list-item__badge wishlisted">{tr("Wishlist", "Souhait")}</span>
                                    )}
                                    {b.readingStatus && b.readingStatus !== "UNREAD" && (
                                        <span className="series-detail-list-item__badge reading">
                                            {b.readingStatus === "READ"
                                                ? tr("Read", "Lu")
                                                : b.readingStatus === "READING"
                                                ? tr("Reading", "En cours")
                                                : b.readingStatus}
                                        </span>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    className="series-detail-list-item__remove"
                                    title={tr("Remove this book from the series", "Retirer cet album de la série")}
                                    onClick={() => handleRemoveBookFromSeries(b.id, b.title)}
                                >
                                    <FontAwesomeIcon icon={faXmark} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Edit Series Dialog */}
            <Dialog
                open={editDialogOpen}
                onClose={() => setEditDialogOpen(false)}
                PaperProps={{
                    style: {
                        backgroundColor: "var(--bg-surface)",
                        color: "var(--text-primary)",
                        borderRadius: "16px",
                        maxWidth: "520px",
                        width: "100%",
                        padding: "24px",
                        border: "1px solid var(--border-subtle)"
                    }
                }}
            >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <FontAwesomeIcon icon={faPen} style={{ color: "var(--accent-primary)", fontSize: "1.25rem" }} />
                        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>{tr("Edit series", "Modifier la série")}</h2>
                    </div>
                    <button
                        type="button"
                        onClick={() => setEditDialogOpen(false)}
                        style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "1.1rem" }}
                    >
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>

                <form onSubmit={handleSaveEdit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div>
                        <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                            {tr("Series name *", "Nom de la série *")}
                        </label>
                        <input
                            type="text"
                            required
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            style={{
                                width: "100%",
                                padding: "10px 14px",
                                background: "rgba(255, 255, 255, 0.05)",
                                border: "1px solid var(--border-subtle)",
                                borderRadius: "8px",
                                color: "var(--text-primary)",
                                outline: "none"
                            }}
                        />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                        <div>
                            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                                {tr("Category", "Catégorie")}
                            </label>
                            <select
                                value={editCategoryId}
                                onChange={(e) => setEditCategoryId(Number(e.target.value))}
                                style={{
                                    width: "100%",
                                    padding: "10px 14px",
                                    background: "rgba(255, 255, 255, 0.05)",
                                    border: "1px solid var(--border-subtle)",
                                    borderRadius: "8px",
                                    color: "var(--text-primary)",
                                    outline: "none"
                                }}
                            >
                                {categories.map((c) => (
                                    <option key={c.id} value={c.id} style={{ background: "var(--bg-surface)", color: "var(--text-primary)" }}>
                                        {translateCategory(c.name)}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                                {tr("Publication status", "Statut de parution")}
                            </label>
                            <select
                                value={editStatus}
                                onChange={(e) => setEditStatus(e.target.value)}
                                style={{
                                    width: "100%",
                                    padding: "10px 14px",
                                    background: "rgba(255, 255, 255, 0.05)",
                                    border: "1px solid var(--border-subtle)",
                                    borderRadius: "8px",
                                    color: "var(--text-primary)",
                                    outline: "none"
                                }}
                            >
                                <option value="ON_GOING" style={{ background: "var(--bg-surface)", color: "var(--text-primary)" }}>{tr("Ongoing", "En cours")}</option>
                                <option value="FINISHED" style={{ background: "var(--bg-surface)", color: "var(--text-primary)" }}>{tr("Completed", "Terminée")}</option>
                                <option value="ANNOUNCED" style={{ background: "var(--bg-surface)", color: "var(--text-primary)" }}>{tr("Announced", "Annoncée")}</option>
                                <option value="CANCELLED" style={{ background: "var(--bg-surface)", color: "var(--text-primary)" }}>{tr("Cancelled", "Annulée")}</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                            {tr("Description", "Description")}
                        </label>
                        <textarea
                            rows={3}
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            style={{
                                width: "100%",
                                padding: "10px 14px",
                                background: "rgba(255, 255, 255, 0.05)",
                                border: "1px solid var(--border-subtle)",
                                borderRadius: "8px",
                                color: "var(--text-primary)",
                                outline: "none",
                                resize: "vertical"
                            }}
                        />
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
                        <button
                            type="button"
                            onClick={handleDeleteSeries}
                            style={{
                                padding: "8px 14px",
                                background: "transparent",
                                border: "1px solid rgba(239, 68, 68, 0.3)",
                                color: "#ef4444",
                                borderRadius: "8px",
                                cursor: "pointer",
                                fontWeight: 600,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px"
                            }}
                        >
                            <FontAwesomeIcon icon={faTrash} />
                            <span>{tr("Delete series", "Supprimer la série")}</span>
                        </button>

                        <div style={{ display: "flex", gap: "10px" }}>
                            <button
                                type="button"
                                onClick={() => setEditDialogOpen(false)}
                                style={{
                                    padding: "8px 16px",
                                    background: "transparent",
                                    border: "1px solid var(--border-subtle)",
                                    color: "var(--text-muted)",
                                    borderRadius: "8px",
                                    cursor: "pointer",
                                    fontWeight: 600
                                }}
                            >
                                {tr("Cancel", "Annuler")}
                            </button>
                            <button
                                type="submit"
                                disabled={editing}
                                className="series-detail-page__btn series-detail-page__btn--primary"
                            >
                                {editing ? tr("Saving...", "Enregistrement...") : tr("Save", "Enregistrer")}
                            </button>
                        </div>
                    </div>
                </form>
            </Dialog>

            {/* Add Book to Series Dialog */}
            <Dialog
                open={addBookDialogOpen}
                onClose={() => setAddBookDialogOpen(false)}
                PaperProps={{
                    style: {
                        backgroundColor: "var(--bg-surface)",
                        color: "var(--text-primary)",
                        borderRadius: "16px",
                        maxWidth: "540px",
                        width: "100%",
                        padding: "24px",
                        border: "1px solid var(--border-subtle)"
                    }
                }}
            >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <FontAwesomeIcon icon={faPlus} style={{ color: "var(--accent-primary)", fontSize: "1.25rem" }} />
                        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
                            {tr(`Link a book to "${series.name}"`, `Lier un album à « ${series.name} »`)}
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={() => setAddBookDialogOpen(false)}
                        style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "1.1rem" }}
                    >
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div>
                        <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                            {tr("Search for an existing book", "Rechercher un album existant")}
                        </label>
                        <input
                            type="text"
                            placeholder={tr("Book title...", "Titre de l'album...")}
                            value={bookSearchQuery}
                            onChange={(e) => setBookSearchQuery(e.target.value)}
                            style={{
                                width: "100%",
                                padding: "10px 14px",
                                background: "rgba(255, 255, 255, 0.05)",
                                border: "1px solid var(--border-subtle)",
                                borderRadius: "8px",
                                color: "var(--text-primary)",
                                outline: "none"
                            }}
                        />
                    </div>

                    {searchingBooks && (
                        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0 }}>
                            {tr("Searching...", "Recherche en cours...")}
                        </p>
                    )}

                    {bookSearchResults.length > 0 && !selectedBookForAdd && (
                        <div style={{ maxHeight: "200px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
                            {bookSearchResults.map((b) => (
                                <button
                                    key={b.id}
                                    type="button"
                                    onClick={() => setSelectedBookForAdd(b)}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "10px",
                                        padding: "8px 12px",
                                        background: "rgba(255, 255, 255, 0.04)",
                                        border: "1px solid var(--border-subtle)",
                                        borderRadius: "8px",
                                        color: "var(--text-primary)",
                                        cursor: "pointer",
                                        textAlign: "left"
                                    }}
                                >
                                    {b.coverUrl ? (
                                        <img src={b.coverUrl} alt={b.title} style={{ width: "28px", height: "38px", objectFit: "cover", borderRadius: "4px" }} />
                                    ) : (
                                        <FontAwesomeIcon icon={faBook} style={{ color: "var(--text-muted)" }} />
                                    )}
                                    <div>
                                        <strong style={{ fontSize: "0.85rem", display: "block" }}>{b.title}</strong>
                                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                            {b.author || tr("Author not specified", "Auteur non renseigné")}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {selectedBookForAdd && (
                        <div style={{
                            padding: "12px",
                            background: "rgba(99, 102, 241, 0.1)",
                            border: "1px solid var(--accent-primary)",
                            borderRadius: "8px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center"
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                {selectedBookForAdd.coverUrl && (
                                    <img src={selectedBookForAdd.coverUrl} alt={selectedBookForAdd.title} style={{ width: "32px", height: "44px", objectFit: "cover", borderRadius: "4px" }} />
                                )}
                                <div>
                                    <strong style={{ fontSize: "0.9rem" }}>{selectedBookForAdd.title}</strong>
                                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>{selectedBookForAdd.author}</span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedBookForAdd(null)}
                                style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
                            >
                                <FontAwesomeIcon icon={faXmark} />
                            </button>
                        </div>
                    )}

                    <div>
                        <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                            {tr("Volume number in the series", "Numéro de tome dans la série")}
                        </label>
                        <input
                            type="number"
                            min="1"
                            value={addVolume}
                            onChange={(e) => setAddVolume(Number(e.target.value))}
                            style={{
                                width: "100%",
                                padding: "10px 14px",
                                background: "rgba(255, 255, 255, 0.05)",
                                border: "1px solid var(--border-subtle)",
                                borderRadius: "8px",
                                color: "var(--text-primary)",
                                outline: "none"
                            }}
                        />
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                        <button
                            type="button"
                            onClick={() => setAddBookDialogOpen(false)}
                            style={{
                                padding: "8px 16px",
                                background: "transparent",
                                border: "1px solid var(--border-subtle)",
                                color: "var(--text-muted)",
                                borderRadius: "8px",
                                cursor: "pointer",
                                fontWeight: 600
                            }}
                        >
                            {tr("Cancel", "Annuler")}
                        </button>
                        <button
                            type="button"
                            disabled={!selectedBookForAdd || addingBook}
                            onClick={handleAddBookToSeries}
                            className="series-detail-page__btn series-detail-page__btn--primary"
                        >
                            {addingBook ? tr("Adding...", "Ajout...") : tr("Link this book", "Lier cet album")}
                        </button>
                    </div>
                </div>
            </Dialog>
        </div>
    );
}
