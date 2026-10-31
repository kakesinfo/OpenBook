import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router";
import useSession from "../../hooks/UseSession.tsx";
import { useSnackbar } from "notistack";
import SeriesDTO, { getSeriesStatusLabel } from "../../dto/Series.dto.ts";
import BookSummaryDTO from "../../dto/BookSummary.dto.ts";
import { WrapperHeader } from "../../components/Wrapper/Wrapper.tsx";
import Pagination from "../../components/Pagination/Pagination.tsx";
import { Dialog } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
	faLayerGroup,
	faPlus,
	faMagnifyingGlass,
	faXmark,
	faBell,
	faBook,
	faTrash,
	faPen,
	faChevronRight,
	faCheck
} from "@fortawesome/free-solid-svg-icons";
import { useDebounce } from "../../hooks/UseDebounce.tsx";
import CategoryMultiSelect, { CategoryOption as MultiSelectOption, DEFAULT_APP_CATEGORIES } from "../../components/CategoryMultiSelect/CategoryMultiSelect.tsx";
import "./SeriesPage.scss";

interface CategoryOption {
    id: number;
    name: string;
}

interface HoveredCoverState {
    url: string;
    title: string;
    x: number;
    y: number;
}

const DEFAULT_CATEGORIES: CategoryOption[] = [
    { id: 3, name: "Comics" },
    { id: 2, name: "Bande dessinée" },
    { id: 4, name: "Manga" },
    { id: 5, name: "Roman Graphique" },
    { id: 1, name: "Roman" },
    { id: 6, name: "Beau-livre" },
];

export default function SeriesPage() {
    const navigate = useNavigate();
    const session = useSession();
    const { enqueueSnackbar } = useSnackbar();

    const [scope, setScope] = useState<"my" | "all">("my");
    const [mySeries, setMySeries] = useState<SeriesDTO[]>([]);
    const [allSeries, setAllSeries] = useState<SeriesDTO[]>([]);
    const [categories, setCategories] = useState<CategoryOption[]>(DEFAULT_CATEGORIES);
    const [loading, setLoading] = useState(true);

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

    const seriesCategoryOptions: MultiSelectOption[] = useMemo(() => {
        return categories.map((cat) => {
            const found = DEFAULT_APP_CATEGORIES.find(
                (d) => d.id.toLowerCase() === cat.name.toLowerCase()
            );
            return {
                id: cat.name,
                label: cat.name,
                icon: found?.icon
            };
        });
    }, [categories]);

    // Pagination states
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [pageSize, setPageSize] = useState<number>(50);

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

    const getCursorPreviewStyle = (x: number, y: number) => {
        const cardW = 96;
        const cardH = 140;
        const offset = 16;

        let left = x + offset;
        if (left + cardW > window.innerWidth - 10) {
            left = x - cardW - offset;
        }

        let top = y;
        const halfH = cardH / 2;
        if (top - halfH < 10) {
            top = halfH + 10;
        } else if (top + halfH > window.innerHeight - 10) {
            top = window.innerHeight - halfH - 10;
        }

        return { left: `${left}px`, top: `${top}px` };
    };

    // Modal states
    const [activeSeries, setActiveSeries] = useState<SeriesDTO | null>(null);

    // Create Series Dialog
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [createName, setCreateName] = useState("");
    const [createDescription, setCreateDescription] = useState("");
    const [createCategoryId, setCreateCategoryId] = useState<number>(3);
    const [createStatus, setCreateStatus] = useState("ON_GOING");
    const [creating, setCreating] = useState(false);

    // Edit Series Dialog
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

    // Load categories
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

    // Fetch user series
    const fetchUserSeries = async () => {
        setLoading(true);
        try {
            const res = await session.customFetch("/user/series", { method: "GET" });
            if (res.ok) {
                const data: SeriesDTO[] = await res.json();
                setMySeries(data.filter((s) => (s.ownedCount || 0) > 0));
            }
        } catch (err) {
            console.error("Error fetching user series:", err);
        } finally {
            setLoading(false);
        }
    };

    // Fetch all series
    const fetchAllSeries = async () => {
        setLoading(true);
        try {
            const res = await session.customFetch("/series", { method: "GET" });
            if (res.ok) {
                const data: SeriesDTO[] = await res.json();
                setAllSeries(data);
            }
        } catch (err) {
            console.error("Error fetching all series:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (scope === "my") {
            fetchUserSeries();
        } else {
            fetchAllSeries();
        }
    }, [scope, session]);

    // Debounced book search in Add Book Dialog
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

    // Open active series details page
    const openSeriesDetails = (seriesId: number) => {
        navigate(`/app/series/${seriesId}`);
    };

    // Toggle follow
    const handleToggleFollow = async (seriesId: number, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();

        // Optimistic update
        const updateFollowState = (list: SeriesDTO[]) =>
            list.map((s) => (s.id === seriesId ? { ...s, isFollowed: !s.isFollowed } : s));

        setMySeries(updateFollowState);
        setAllSeries(updateFollowState);
        if (activeSeries && activeSeries.id === seriesId) {
            setActiveSeries({ ...activeSeries, isFollowed: !activeSeries.isFollowed });
        }

        try {
            const res = await session.customFetch(`/user/follows/series/${seriesId}/toggle`, {
                method: "POST"
            });
            if (res.ok) {
                const data = await res.json();
                const followed = Boolean(data.following);
                const syncState = (list: SeriesDTO[]) =>
                    list.map((s) => (s.id === seriesId ? { ...s, isFollowed: followed } : s));
                setMySeries(syncState);
                setAllSeries(syncState);
                if (activeSeries && activeSeries.id === seriesId) {
                    setActiveSeries((prev) => (prev ? { ...prev, isFollowed: followed } : null));
                }
                enqueueSnackbar(followed ? "Série ajoutée à vos suivis" : "Série retirée de vos suivis", {
                    variant: "info"
                });
            }
        } catch (err) {
            console.error("Error toggling follow:", err);
        }
    };

    // Handle Create Series
    const handleCreateSeries = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!createName.trim()) {
            enqueueSnackbar("Veuillez renseigner le nom de la série", { variant: "warning" });
            return;
        }

        setCreating(true);
        try {
            const res = await session.customFetch("/series", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: createName.trim(),
                    description: createDescription.trim() || undefined,
                    categoryId: createCategoryId,
                    status: createStatus
                })
            });

            if (res.ok) {
                const newSeries: SeriesDTO = await res.json();
                enqueueSnackbar("Série créée avec succès !", { variant: "success" });
                setCreateDialogOpen(false);
                setCreateName("");
                setCreateDescription("");
                // Refresh list
                fetchUserSeries();
                // Open new series modal directly
                setActiveSeries(newSeries);
            } else {
                const errData = await res.text();
                enqueueSnackbar(`Erreur: ${errData}`, { variant: "error" });
            }
        } catch (err: any) {
            enqueueSnackbar(`Erreur: ${err.message}`, { variant: "error" });
        } finally {
            setCreating(false);
        }
    };

    // Handle Open Edit Series
    const handleOpenEdit = () => {
        if (!activeSeries) return;
        setEditName(activeSeries.name);
        setEditDescription(activeSeries.description || "");
        setEditCategoryId(activeSeries.categoryId || 3);
        setEditStatus(activeSeries.status || "ON_GOING");
        setEditDialogOpen(true);
    };

    // Handle Save Edit Series
    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeSeries || !editName.trim()) return;

        setEditing(true);
        try {
            const res = await session.customFetch(`/series/${activeSeries.id}`, {
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
                enqueueSnackbar("Informations de la série mises à jour", { variant: "success" });
                setActiveSeries(updated);
                setEditDialogOpen(false);
                fetchUserSeries();
            } else {
                const errData = await res.text();
                enqueueSnackbar(`Erreur: ${errData}`, { variant: "error" });
            }
        } catch (err: any) {
            enqueueSnackbar(`Erreur: ${err.message}`, { variant: "error" });
        } finally {
            setEditing(false);
        }
    };

    // Handle Delete Series
    const handleDeleteSeries = async () => {
        if (!activeSeries) return;
        const confirm = window.confirm(`Êtes-vous sûr de vouloir supprimer la série « ${activeSeries.name} » ? Les albums associés ne seront pas supprimés, mais ne feront plus partie de cette série.`);
        if (!confirm) return;

        try {
            const res = await session.customFetch(`/series/${activeSeries.id}`, { method: "DELETE" });
            if (res.ok) {
                enqueueSnackbar("Série supprimée avec succès", { variant: "success" });
                setActiveSeries(null);
                fetchUserSeries();
                if (scope === "all") fetchAllSeries();
            } else {
                enqueueSnackbar("Erreur lors de la suppression de la série", { variant: "error" });
            }
        } catch (err) {
            console.error("Delete error:", err);
            enqueueSnackbar("Erreur de connexion", { variant: "error" });
        }
    };

    // Open Add Book Dialog
    const handleOpenAddBook = () => {
        if (!activeSeries) return;
        setBookSearchQuery("");
        setBookSearchResults([]);
        setSelectedBookForAdd(null);
        // Default volume: next volume
        const maxVol = (activeSeries.books || []).reduce(
            (max, b) => (b.volume && b.volume > max ? b.volume : max),
            0
        );
        setAddVolume(maxVol + 1);
        setAddBookDialogOpen(true);
    };

    // Add Book to Series
    const handleAddBookToSeries = async () => {
        if (!activeSeries || !selectedBookForAdd) return;

        setAddingBook(true);
        try {
            const res = await session.customFetch(`/series/${activeSeries.id}/books`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    bookId: selectedBookForAdd.id,
                    volume: addVolume
                })
            });

            if (res.ok) {
                const updatedSeries: SeriesDTO = await res.json();
                setActiveSeries(updatedSeries);
                enqueueSnackbar(`Album « ${selectedBookForAdd.title} » ajouté au tome ${addVolume}`, {
                    variant: "success"
                });
                setAddBookDialogOpen(false);
                fetchUserSeries();
            } else {
                enqueueSnackbar("Erreur lors de l'ajout de l'album", { variant: "error" });
            }
        } catch (err: any) {
            enqueueSnackbar(`Erreur: ${err.message}`, { variant: "error" });
        } finally {
            setAddingBook(false);
        }
    };

    // Remove Book from Series
    const handleRemoveBookFromSeries = async (bookId: number | string, bookTitle: string) => {
        if (!activeSeries) return;
        const confirm = window.confirm(`Retirer « ${bookTitle} » de la série « ${activeSeries.name} » ?`);
        if (!confirm) return;

        try {
            const res = await session.customFetch(`/series/${activeSeries.id}/books/${bookId}`, {
                method: "DELETE"
            });
            if (res.ok) {
                const updatedSeries: SeriesDTO = await res.json();
                setActiveSeries(updatedSeries);
                enqueueSnackbar("Album retiré de la série", { variant: "info" });
                fetchUserSeries();
            } else {
                enqueueSnackbar("Erreur lors du retrait de l'album", { variant: "error" });
            }
        } catch (err) {
            console.error("Remove book error:", err);
            enqueueSnackbar("Erreur de connexion", { variant: "error" });
        }
    };

    // Update Book Volume Number
    const handleUpdateVolume = async (bookId: number | string, currentVol?: number) => {
        if (!activeSeries) return;
        const newVolStr = window.prompt("Modifier le numéro de tome :", String(currentVol || 1));
        if (newVolStr === null) return;
        const newVol = parseInt(newVolStr.trim(), 10);
        if (isNaN(newVol)) {
            enqueueSnackbar("Numéro de tome invalide", { variant: "warning" });
            return;
        }

        try {
            const res = await session.customFetch(`/series/${activeSeries.id}/books/${bookId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ volume: newVol })
            });
            if (res.ok) {
                const updated: SeriesDTO = await res.json();
                setActiveSeries(updated);
                enqueueSnackbar(`Tome mis à jour : Volume ${newVol}`, { variant: "success" });
            }
        } catch (err) {
            console.error("Update volume error:", err);
        }
    };

    // Filter displayed series
    const displayedSeries = useMemo(() => {
        let list = scope === "my" ? mySeries : allSeries;
        if (scope === "my") {
            list = list.filter((s) => (s.ownedCount || 0) > 0);
        }
        return list.filter((s) => {
            if (selectedCategories.length > 0) {
                if (!s.category || !selectedCategories.some((cat) => cat.toLowerCase() === s.category!.toLowerCase())) {
                    return false;
                }
            }
            if (searchQuery.trim().length > 0) {
                const q = searchQuery.toLowerCase().trim();
                const matchName = s.name.toLowerCase().includes(q);
                const matchDesc = s.description ? s.description.toLowerCase().includes(q) : false;
                if (!matchName && !matchDesc) return false;
            }
            return true;
        });
    }, [scope, mySeries, allSeries, selectedCategories, searchQuery]);

    // Reset page to 1 whenever filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [scope, selectedCategories, searchQuery]);

    // Pagination calculations
    const totalFiltered = displayedSeries.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
    const activePage = Math.min(currentPage, totalPages);
    const startIndex = totalFiltered === 0 ? 0 : (activePage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalFiltered);

    const paginatedSeries = useMemo(() => {
        return displayedSeries.slice(startIndex, endIndex);
    }, [displayedSeries, startIndex, endIndex]);

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handlePageSizeChange = (size: number) => {
        setPageSize(size);
        setCurrentPage(1);
    };

    return (
        <div className="series-page">
			<WrapperHeader>
				<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", flexWrap: "wrap", gap: "12px" }}>
					<div>
						<h2 style={{ margin: 0 }}>
							Mes Séries
						</h2>
					</div>
					<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
						<button
							type="button"
							className="series-page__create-btn"
							onClick={() => setCreateDialogOpen(true)}
						>
							<FontAwesomeIcon icon={faPlus} />
							<span>Créer une série</span>
						</button>
					</div>
				</div>
			</WrapperHeader>

            <div className="series-page__content">
                {/* Controls: Scope tabs, Search, Categories */}
                <div className="series-page__controls">
                    {/* Left: Category Dropdown + Scope Tabs */}
                    <div className="series-page__left-controls">
                        <CategoryMultiSelect
                            options={seriesCategoryOptions}
                            selected={selectedCategories}
                            onChange={(cats) => {
                                setSelectedCategories(cats);
                                setCurrentPage(1);
                            }}
                            allLabel="Toutes les catégories"
                        />

                        <div className="series-page__filters">
                            <button
                                type="button"
                                className={`series-page__filter-btn ${scope === "my" ? "is-active" : ""}`}
                                onClick={() => {
                                    setScope("my");
                                    setCurrentPage(1);
                                }}
                            >
                                <FontAwesomeIcon icon={faBook} />
                                <span>Mes Séries</span>
                                <span className="series-page__filter-count">{mySeries.length}</span>
                            </button>
                            <button
                                type="button"
                                className={`series-page__filter-btn ${scope === "all" ? "is-active" : ""}`}
                                onClick={() => {
                                    setScope("all");
                                    setCurrentPage(1);
                                }}
                            >
                                <FontAwesomeIcon icon={faLayerGroup} />
                                <span>Toutes les séries</span>
                                {scope === "all" && allSeries.length > 0 && (
                                    <span className="series-page__filter-count">{allSeries.length}</span>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Center: Search input */}
                    <div className="series-page__center-controls">
                        <div className="series-page__search">
                            <FontAwesomeIcon icon={faMagnifyingGlass} />
                            <input
                                type="text"
                                placeholder="Rechercher une série..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1);
                                }}
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    className="series-page__search-clear"
                                    onClick={() => {
                                        setSearchQuery("");
                                        setCurrentPage(1);
                                    }}
                                    aria-label="Effacer la recherche"
                                >
                                    <FontAwesomeIcon icon={faXmark} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Loading state */}
                {loading && (
                    <div className="series-page__empty">
                        <p>Chargement des séries...</p>
                    </div>
                )}

                {/* Series List Mode (mode liste uniquement, pas de galerie) */}
                {!loading && displayedSeries.length > 0 && (
                    <>
                        <div className="series-list">
                            <div className="series-list__header">
                                <span className="series-list__th series-list__th--title">Série</span>
                                <span className="series-list__th series-list__th--category">Catégorie</span>
                                <span className="series-list__th series-list__th--status">Statut</span>
                                <span className="series-list__th series-list__th--volumes">Tomes possédés</span>
                                <span className="series-list__th series-list__th--follow">Suivi</span>
                                <span className="series-list__th series-list__th--action"></span>
                            </div>

                            {paginatedSeries.map((s) => (
                                <div
                                    key={s.id}
                                    className="series-row"
                                    onClick={() => openSeriesDetails(s.id)}
                                >
                                    {/* Title column with hover tracking for cursor preview */}
                                    <div
                                        className="series-row__col series-row__col--title"
                                        onMouseEnter={(e) => handleMouseEnterTitle(e, s.coverUrl, s.name)}
                                        onMouseMove={handleMouseMoveTitle}
                                        onMouseLeave={handleMouseLeaveTitle}
                                    >
                                        <FontAwesomeIcon icon={faLayerGroup} className="series-row__icon" />
                                        <span className="series-row__title" title={s.name}>
                                            {s.name}
                                        </span>
                                        {s.description && (
                                            <span className="series-row__desc" title={s.description}>
                                                {s.description}
                                            </span>
                                        )}
                                    </div>

                                    {/* Category column */}
                                    <div className="series-row__col series-row__col--category">
                                        {s.category && (
                                            <span className="series-row__tag series-row__tag--category">
                                                {s.category}
                                            </span>
                                        )}
                                    </div>

                                    {/* Status column */}
                                    <div className="series-row__col series-row__col--status">
                                        {s.status && (
                                            <span
                                                className={`series-row__tag series-row__tag--status ${s.status === "FINISHED" ? "status-finished" : ""}`}
                                            >
                                                {getSeriesStatusLabel(s.status)}
                                            </span>
                                        )}
                                    </div>

                                    {/* Owned volumes column */}
                                    <div className="series-row__col series-row__col--volumes">
                                        <span className={`series-row__owned-badge ${(s.ownedCount || 0) > 0 ? "has-owned" : ""}`}>
                                            <FontAwesomeIcon icon={faBook} />
                                            <span>
                                                {s.ownedCount || 0} / {Math.max(s.totalVolumes || 0, s.ownedCount || 0)} tomes
                                            </span>
                                        </span>
                                    </div>

                                    {/* Follow column */}
                                    <div className="series-row__col series-row__col--follow" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            type="button"
                                            className={`series-row__follow-btn ${s.isFollowed ? "is-followed" : ""}`}
                                            title={s.isFollowed ? "Suivi actif (cliquer pour ne plus suivre)" : "Suivre cette série"}
                                            onClick={(e) => handleToggleFollow(s.id, e)}
                                        >
                                            <FontAwesomeIcon icon={s.isFollowed ? faCheck : faBell} />
                                            <span>{s.isFollowed ? "Suivie" : "Suivre"}</span>
                                        </button>
                                    </div>

                                    {/* Action column */}
                                    <div className="series-row__col series-row__col--action">
                                        <FontAwesomeIcon icon={faChevronRight} className="series-row__chevron" />
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Shared Pagination component */}
                        <Pagination
                            currentPage={activePage}
                            totalPages={totalPages}
                            onPageChange={handlePageChange}
                            totalItems={totalFiltered}
                            startIndex={startIndex}
                            endIndex={endIndex}
                            pageSize={pageSize}
                            onPageSizeChange={handlePageSizeChange}
                            pageSizeOptions={[20, 50, 100]}
                            itemLabel="séries"
                        />
                    </>
                )}

                {/* Empty State */}
                {!loading && displayedSeries.length === 0 && (
                    <div className="series-page__empty">
                        <FontAwesomeIcon icon={faLayerGroup} className="series-page__empty-icon" />
                        <h3>{scope === "my" ? "Aucune série dans vos albums" : "Aucune série trouvée"}</h3>
                        <p>
                            {scope === "my"
                                ? "Vous ne possédez actuellement aucun album associé à une série dans vos albums. Vous pouvez créer une série et y associer vos albums !"
                                : "Aucune série ne correspond à votre filtre de recherche. Créez-la en un clic !"}
                        </p>
                        <button
                            type="button"
                            className="series-page__create-btn"
                            onClick={() => setCreateDialogOpen(true)}
                        >
                            <FontAwesomeIcon icon={faPlus} />
                            <span>Créer une nouvelle série</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Floating Cover Preview right at mouse cursor on series title hover */}
            {hoveredCover && (
                <div
                    className="series-cursor-preview"
                    style={getCursorPreviewStyle(hoveredCover.x, hoveredCover.y)}
                >
                    <img
                        src={hoveredCover.url}
                        alt={`Couverture de ${hoveredCover.title}`}
                        decoding="async"
                    />
                </div>
            )}

            {/* Create Series Dialog */}
            <Dialog
                open={createDialogOpen}
                onClose={() => setCreateDialogOpen(false)}
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
                        <FontAwesomeIcon icon={faLayerGroup} style={{ color: "var(--accent-primary)", fontSize: "1.25rem" }} />
                        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Créer une série</h2>
                    </div>
                    <button
                        type="button"
                        onClick={() => setCreateDialogOpen(false)}
                        style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "1.1rem" }}
                    >
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>

                <form onSubmit={handleCreateSeries} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div>
                        <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                            Nom de la série *
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="Ex: Spider-Man, Tintin, One Piece..."
                            value={createName}
                            onChange={(e) => setCreateName(e.target.value)}
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
                                Catégorie
                            </label>
                            <select
                                value={createCategoryId}
                                onChange={(e) => setCreateCategoryId(Number(e.target.value))}
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
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                                Statut de parution
                            </label>
                            <select
                                value={createStatus}
                                onChange={(e) => setCreateStatus(e.target.value)}
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
                                <option value="ON_GOING" style={{ background: "var(--bg-surface)", color: "var(--text-primary)" }}>En cours</option>
                                <option value="FINISHED" style={{ background: "var(--bg-surface)", color: "var(--text-primary)" }}>Terminée</option>
                                <option value="ANNOUNCED" style={{ background: "var(--bg-surface)", color: "var(--text-primary)" }}>Annoncée</option>
                                <option value="CANCELLED" style={{ background: "var(--bg-surface)", color: "var(--text-primary)" }}>Annulée</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                            Description
                        </label>
                        <textarea
                            rows={3}
                            placeholder="Synopsis ou description générale de la série..."
                            value={createDescription}
                            onChange={(e) => setCreateDescription(e.target.value)}
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

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                        <button
                            type="button"
                            onClick={() => setCreateDialogOpen(false)}
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
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={creating}
                            className="series-page__create-btn"
                        >
                            {creating ? "Création..." : "Créer la série"}
                        </button>
                    </div>
                </form>
            </Dialog>

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
                        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Modifier la série</h2>
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
                            Nom de la série *
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
                                Catégorie
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
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                                Statut de parution
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
                                <option value="ON_GOING" style={{ background: "var(--bg-surface)", color: "var(--text-primary)" }}>En cours</option>
                                <option value="FINISHED" style={{ background: "var(--bg-surface)", color: "var(--text-primary)" }}>Terminée</option>
                                <option value="ANNOUNCED" style={{ background: "var(--bg-surface)", color: "var(--text-primary)" }}>Annoncée</option>
                                <option value="CANCELLED" style={{ background: "var(--bg-surface)", color: "var(--text-primary)" }}>Annulée</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                            Description
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

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
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
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={editing}
                            className="series-page__create-btn"
                        >
                            {editing ? "Enregistrement..." : "Enregistrer"}
                        </button>
                    </div>
                </form>
            </Dialog>

            {/* Active Series Management Modal */}
            <Dialog
                open={Boolean(activeSeries)}
                onClose={() => setActiveSeries(null)}
                maxWidth="md"
                fullWidth
                PaperProps={{
                    style: {
                        backgroundColor: "var(--bg-surface)",
                        borderRadius: "16px",
                        border: "1px solid var(--border-subtle)",
                        padding: 0
                    }
                }}
            >
                {activeSeries && (
                    <div className="series-page__modal">
                        {/* Header */}
                        <div className="series-page__modal-header">
                            <div className="series-page__modal-cover">
                                {activeSeries.coverUrl ? (
                                    <img src={activeSeries.coverUrl} alt={activeSeries.name} />
                                ) : (
                                    <div className="series-page__modal-cover-fallback">
                                        <FontAwesomeIcon icon={faLayerGroup} />
                                    </div>
                                )}
                            </div>

                            <div className="series-page__modal-info">
                                <div className="series-page__modal-title-row">
                                    <div>
                                        <div style={{ display: "flex", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
                                            {activeSeries.category && (
                                                <span className="series-page__tag series-page__tag--category">
                                                    {activeSeries.category}
                                                </span>
                                            )}
                                            {activeSeries.status && (
                                                <span
                                                    className={`series-page__tag series-page__tag--status ${activeSeries.status === "FINISHED" ? "status-finished" : ""}`}
                                                >
                                                    {getSeriesStatusLabel(activeSeries.status)}
                                                </span>
                                            )}
                                            <span className="series-page__tag" style={{ background: "rgba(255, 255, 255, 0.08)", color: "var(--text-primary)" }}>
                                                {activeSeries.books?.length || 0} tomes dans la série
                                            </span>
                                        </div>
                                        <h2 className="series-page__modal-title">{activeSeries.name}</h2>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setActiveSeries(null)}
                                        style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "1.2rem", padding: "4px" }}
                                    >
                                        <FontAwesomeIcon icon={faXmark} />
                                    </button>
                                </div>

                                {activeSeries.description && (
                                    <p className="series-page__modal-desc">{activeSeries.description}</p>
                                )}

                                <div className="series-page__modal-actions">
                                    <button
                                        type="button"
                                        className={`series-page__btn ${activeSeries.isFollowed ? "series-page__btn--primary" : ""}`}
                                        onClick={() => handleToggleFollow(activeSeries.id)}
                                    >
                                        <FontAwesomeIcon icon={faBell} />
                                        <span>{activeSeries.isFollowed ? "Série suivie" : "Suivre la série"}</span>
                                    </button>

                                    <button
                                        type="button"
                                        className="series-page__btn"
                                        onClick={handleOpenEdit}
                                    >
                                        <FontAwesomeIcon icon={faPen} />
                                        <span>Modifier</span>
                                    </button>

                                    <button
                                        type="button"
                                        className="series-page__btn series-page__btn--danger"
                                        onClick={handleDeleteSeries}
                                    >
                                        <FontAwesomeIcon icon={faTrash} />
                                        <span>Supprimer la série</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Albums / Books Section */}
                        <div className="series-page__books-section">
                            <div className="series-page__books-header">
                                <h3>Albums associés ({activeSeries.books?.length || 0})</h3>
                                <button
                                    type="button"
                                    className="series-page__btn series-page__btn--primary"
                                    onClick={handleOpenAddBook}
                                >
                                    <FontAwesomeIcon icon={faPlus} />
                                    <span>Lier un album</span>
                                </button>
                            </div>

                            {activeSeries.books && activeSeries.books.length > 0 ? (
                                <div className="series-page__books-list">
                                    {activeSeries.books.map((b) => (
                                        <div key={b.id} className="series-page__book-item">
                                            <button
                                                type="button"
                                                className="series-page__book-vol"
                                                onClick={() => handleUpdateVolume(b.id, b.volume)}
                                                title="Cliquer pour modifier le tome"
                                                style={{ background: "transparent", border: "none", cursor: "pointer" }}
                                            >
                                                T.{b.volume != null ? b.volume : "?"}
                                                <FontAwesomeIcon icon={faPen} style={{ fontSize: "0.65rem", opacity: 0.5 }} />
                                            </button>

                                            <div className="series-page__book-thumb">
                                                {b.coverUrl ? (
                                                    <img src={b.coverUrl} alt={b.title} />
                                                ) : (
                                                    <FontAwesomeIcon icon={faBook} style={{ color: "var(--text-muted)" }} />
                                                )}
                                            </div>

                                            <div className="series-page__book-info">
                                                <Link
                                                    to={`/app/book/${b.id}`}
                                                    className="series-page__book-title"
                                                    title={b.title}
                                                >
                                                    {b.title}
                                                </Link>
                                                <span className="series-page__book-author">
                                                    {b.author || "Auteur non renseigné"}
                                                </span>
                                            </div>

                                            <div className="series-page__book-actions">
                                                {b.status === "OWNED" && (
                                                    <span className="series-page__book-status-tag owned">
                                                        Possédé
                                                    </span>
                                                )}
                                                {b.status === "WISHLISTED" && (
                                                    <span className="series-page__book-status-tag wishlisted">
                                                        Souhait
                                                    </span>
                                                )}
                                                <button
                                                    type="button"
                                                    className="series-page__remove-btn"
                                                    title="Retirer cet album de la série"
                                                    onClick={() => handleRemoveBookFromSeries(b.id, b.title)}
                                                >
                                                    <FontAwesomeIcon icon={faXmark} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ textAlign: "center", padding: "30px 10px", color: "var(--text-muted)" }}>
                                    <p style={{ margin: "0 0 12px 0" }}>Aucun album n'est encore lié à cette série.</p>
                                    <button
                                        type="button"
                                        className="series-page__btn series-page__btn--primary"
                                        onClick={handleOpenAddBook}
                                    >
                                        <FontAwesomeIcon icon={faPlus} />
                                        <span>Ajouter le premier album</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <FontAwesomeIcon icon={faPlus} style={{ color: "var(--accent-primary)" }} />
                        <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>
                            Lier un album à « {activeSeries?.name} »
                        </h3>
                    </div>
                    <button
                        type="button"
                        onClick={() => setAddBookDialogOpen(false)}
                        style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
                    >
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div>
                        <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                            Rechercher un album dans la bibliothèque
                        </label>
                        <div style={{ position: "relative" }}>
                            <input
                                type="text"
                                placeholder="Rechercher par titre, auteur..."
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
                    </div>

                    {searchingBooks && (
                        <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                            Recherche en cours...
                        </p>
                    )}

                    {/* Search results list */}
                    {bookSearchResults.length > 0 && !selectedBookForAdd && (
                        <div style={{ maxHeight: "220px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
                            {bookSearchResults.map((b) => (
                                <div
                                    key={b.id}
                                    onClick={() => setSelectedBookForAdd(b)}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "10px",
                                        padding: "8px 12px",
                                        background: "rgba(255, 255, 255, 0.03)",
                                        borderRadius: "6px",
                                        cursor: "pointer",
                                        border: "1px solid var(--border-subtle)"
                                    }}
                                >
                                    {b.coverUrl && (
                                        <img src={b.coverUrl} alt="" style={{ width: "30px", height: "40px", objectFit: "cover", borderRadius: "3px" }} />
                                    )}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: "0.85rem", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                            {b.title}
                                        </div>
                                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                            {b.author || "Auteur inconnu"} {b.volume ? `• Tome ${b.volume}` : ""}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        style={{
                                            padding: "4px 8px",
                                            background: "var(--accent-primary)",
                                            color: "#fff",
                                            border: "none",
                                            borderRadius: "4px",
                                            fontSize: "0.75rem",
                                            fontWeight: 600,
                                            cursor: "pointer"
                                        }}
                                    >
                                        Choisir
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Selected Book */}
                    {selectedBookForAdd && (
                        <div style={{ padding: "12px", background: "var(--accent-primary-light)", border: "1px solid var(--border-focus)", borderRadius: "8px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                    {selectedBookForAdd.coverUrl && (
                                        <img src={selectedBookForAdd.coverUrl} alt="" style={{ width: "36px", height: "48px", objectFit: "cover", borderRadius: "4px" }} />
                                    )}
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{selectedBookForAdd.title}</div>
                                        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{selectedBookForAdd.author}</div>
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

                            <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "10px" }}>
                                <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Numéro de tome :</label>
                                <input
                                    type="number"
                                    min={1}
                                    value={addVolume}
                                    onChange={(e) => setAddVolume(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                    style={{
                                        width: "70px",
                                        padding: "6px 10px",
                                        background: "rgba(255, 255, 255, 0.1)",
                                        border: "1px solid var(--border-subtle)",
                                        borderRadius: "6px",
                                        color: "var(--text-primary)",
                                        fontWeight: 700,
                                        textAlign: "center"
                                    }}
                                />
                            </div>
                        </div>
                    )}

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
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={!selectedBookForAdd || addingBook}
                            onClick={handleAddBookToSeries}
                            className="series-page__create-btn"
                        >
                            {addingBook ? "Ajout..." : "Confirmer l'ajout"}
                        </button>
                    </div>
                </div>
            </Dialog>
        </div>
    );
}
