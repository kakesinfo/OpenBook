import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router";
import useSession from "../../hooks/UseSession.tsx";
import useLanguage from "../../hooks/UseLanguage.tsx";
import { useSnackbar } from "notistack";
import EditorDTO from "../../dto/Editor.dto.ts";
import { WrapperHeader } from "../../components/Wrapper/Wrapper.tsx";
import BookList from "../../components/BookList/BookList.tsx";
import Pagination from "../../components/Pagination/Pagination.tsx";
import PageControls from "../../components/PageControls/PageControls.tsx";
import SearchBar from "../../components/SearchBar/SearchBar.tsx";
import HeaderFilterTabs from "../../components/HeaderFilterTabs/HeaderFilterTabs.tsx";
import HeroProgressStats from "../../components/HeroProgressStats/HeroProgressStats.tsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faArrowLeft,
    faBell,
    faCheck,
    faBuilding,
    faBook,
    faBorderAll,
    faList
} from "@fortawesome/free-solid-svg-icons";
import "./EditorDetailPage.scss";

export default function EditorDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const session = useSession();
    const { tr } = useLanguage();
    const { enqueueSnackbar } = useSnackbar();

    const [editor, setEditor] = useState<EditorDTO | null>(null);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "owned" | "wishlisted">("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(24);

    // Fetch editor data
    const fetchEditor = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        try {
            const res = await session.customFetch(`/editors/${id}`, { method: "GET" });
            if (res.ok) {
                const data: EditorDTO = await res.json();
                setEditor(data);
            } else {
                enqueueSnackbar(tr("Publisher not found", "Éditeur introuvable"), { variant: "error" });
            }
        } catch (err) {
            console.error("Error loading editor detail:", err);
            enqueueSnackbar(tr("Error loading publisher", "Erreur lors du chargement de l'éditeur"), { variant: "error" });
        } finally {
            setLoading(false);
        }
    }, [id, session, tr, enqueueSnackbar]);

    useEffect(() => {
        Promise.resolve().then(() => {
            fetchEditor();
        });
    }, [fetchEditor]);

    // Reset to the first page when the editor, search query or status filter changes
    const filterKey = `${id ?? ""}|${searchQuery}|${statusFilter}`;
    const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
    if (prevFilterKey !== filterKey) {
        setPrevFilterKey(filterKey);
        setCurrentPage(1);
    }

    // Toggle follow
    const handleToggleFollow = async () => {
        if (!editor) return;
        const newState = !editor.isFollowed;

        setEditor((prev) => (prev ? { ...prev, isFollowed: newState } : null));

        try {
            const res = await session.customFetch(`/user/follows/editor/${editor.id}/toggle`, {
                method: "POST"
            });
            if (res.ok) {
                const data = await res.json();
                const followed = Boolean(data.following);
                setEditor((prev) => (prev ? { ...prev, isFollowed: followed } : null));
                enqueueSnackbar(
                    followed
                        ? tr("Publisher added to your followed list", "Éditeur ajouté à vos suivis")
                        : tr("Publisher removed from your followed list", "Éditeur retiré de vos suivis"),
                    { variant: "info" }
                );
            }
        } catch (err) {
            console.error("Error toggling follow:", err);
            setEditor((prev) => (prev ? { ...prev, isFollowed: !newState } : null));
            enqueueSnackbar(
                tr("Error updating follow status", "Erreur lors de la modification du suivi"),
                { variant: "error" }
            );
        }
    };

    // Filtered books
    const filteredBooks = useMemo(() => {
        if (!editor?.books) return [];
        let list = editor.books;

        if (statusFilter === "owned") {
            list = list.filter((b) => b.status === "OWNED");
        } else if (statusFilter === "wishlisted") {
            list = list.filter((b) => b.status === "WISHLISTED");
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = list.filter((b) =>
                b.title.toLowerCase().includes(q) ||
                (b.seriesName && b.seriesName.toLowerCase().includes(q)) ||
                (b.author && b.author.toLowerCase().includes(q)) ||
                (b.category && b.category.toLowerCase().includes(q))
            );
        }

        // Most recent releases first, books without a release date at the end
        return [...list].sort((a, b) => {
            const ta = a.releaseDate ? new Date(a.releaseDate).getTime() : NaN;
            const tb = b.releaseDate ? new Date(b.releaseDate).getTime() : NaN;
            if (isNaN(ta) && isNaN(tb)) return 0;
            if (isNaN(ta)) return 1;
            if (isNaN(tb)) return -1;
            return tb - ta;
        });
    }, [editor?.books, statusFilter, searchQuery]);

    const totalItems = filteredBooks.length;
    const isAll = pageSize === 0 || pageSize >= 9999;
    const totalPages = isAll ? 1 : Math.max(1, Math.ceil(totalItems / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const startIndex = totalItems === 0 ? 0 : (safePage - 1) * (isAll ? totalItems : pageSize);
    const endIndex = isAll ? totalItems : Math.min(startIndex + pageSize, totalItems);
    const paginatedBooks = isAll ? filteredBooks : filteredBooks.slice(startIndex, endIndex);

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        setCurrentPage(1);
    };

    if (loading) {
        return (
            <div className="editor-detail-page">
                <WrapperHeader>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <button
                            type="button"
                            className="editor-detail-page__back-btn"
                            onClick={() => navigate(-1)}
                            aria-label={tr("Back", "Retour")}
                        >
                            <FontAwesomeIcon icon={faArrowLeft} />
                        </button>
                        <h2 style={{ margin: 0 }}>{tr("Loading publisher...", "Chargement de l'éditeur...")}</h2>
                    </div>
                </WrapperHeader>
                <div className="editor-detail-page__content">
                    <div className="editor-detail-page__empty">
                        <p>{tr("Loading publisher information...", "Chargement des informations de l'éditeur...")}</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!editor) {
        return (
            <div className="editor-detail-page">
                <WrapperHeader>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <button
                            type="button"
                            className="editor-detail-page__back-btn"
                            onClick={() => navigate(-1)}
                            aria-label={tr("Back", "Retour")}
                        >
                            <FontAwesomeIcon icon={faArrowLeft} />
                        </button>
                        <h2 style={{ margin: 0 }}>{tr("Publisher not found", "Éditeur non trouvé")}</h2>
                    </div>
                </WrapperHeader>
                <div className="editor-detail-page__content">
                    <div className="editor-detail-page__empty">
                        <FontAwesomeIcon icon={faBuilding} className="editor-detail-page__empty-icon" />
                        <h3>{tr("This publisher does not exist or has been deleted", "Cet éditeur n'existe pas ou a été supprimé")}</h3>
                        <button
                            type="button"
                            className="editor-detail-page__btn editor-detail-page__btn--primary"
                            onClick={() => navigate(-1)}
                        >
                            {tr("Back", "Retour")}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const totalBooks = editor.books?.length || 0;
    const ownedBooks = (editor.books || []).filter((b) => b.status === "OWNED").length;
    const wishlistedBooks = (editor.books || []).filter((b) => b.status === "WISHLISTED").length;

    return (
        <div className="editor-detail-page">
            <WrapperHeader>
                <div className="editor-detail-header-bar">
                    <div className="editor-detail-header-bar__left">
                        <button
                            type="button"
                            className="editor-detail-page__back-btn"
                            onClick={() => navigate(-1)}
                            aria-label={tr("Back", "Retour")}
                            title={tr("Back", "Retour")}
                        >
                            <FontAwesomeIcon icon={faArrowLeft} />
                        </button>
                    </div>

                    <div className="editor-detail-header-bar__center">
                        <HeaderFilterTabs
                            tabs={[
                                { id: "all", label: tr("All", "Tous"), count: totalBooks },
                                { id: "owned", label: tr("Owned", "Possédés"), count: ownedBooks },
                                ...(wishlistedBooks > 0
                                    ? [{ id: "wishlisted" as const, label: tr("Wishlist", "Souhaits"), count: wishlistedBooks }]
                                    : [])
                            ]}
                            selectedId={statusFilter}
                            onChange={setStatusFilter}
                        />
                    </div>

                    <div className="editor-detail-header-bar__right">
                        <button
                            type="button"
                            className={`editor-detail-page__follow-btn ${editor.isFollowed ? "is-followed" : ""}`}
                            onClick={handleToggleFollow}
                            title={
                                editor.isFollowed
                                    ? tr("Following publisher (click to unfollow)", "Éditeur suivi (cliquer pour ne plus suivre)")
                                    : tr("Follow this publisher", "Suivre cet éditeur")
                            }
                        >
                            <FontAwesomeIcon icon={editor.isFollowed ? faCheck : faBell} />
                            <span>{editor.isFollowed ? tr("Following publisher", "Éditeur suivi") : tr("Follow publisher", "Suivre l'éditeur")}</span>
                        </button>
                    </div>
                </div>
            </WrapperHeader>

            <div className="editor-detail-page__content">
                {/* Hero / Information Card */}
                <div className="editor-detail-hero">
                    <div className="editor-detail-hero__info">
                        <div className="editor-detail-hero__badge">
                            <FontAwesomeIcon icon={faBuilding} />
                            <span>{tr("Publisher", "Éditeur")}</span>
                        </div>

                        <h1 className="editor-detail-hero__name">{editor.name}</h1>

                        <HeroProgressStats ownedCount={ownedBooks} totalCount={totalBooks} />
                    </div>

                    <PageControls
                        center={
                            <SearchBar
                                value={searchQuery}
                                onChange={setSearchQuery}
                                placeholder={tr("Filter books...", "Filtrer les albums...")}
                                clearLabel={tr("Clear search", "Effacer la recherche")}
                            />
                        }
                        right={
                            <div className="editor-detail-page__view-toggle">
                                <button
                                    type="button"
                                    className={`editor-detail-page__view-btn ${viewMode === "grid" ? "is-active" : ""}`}
                                    onClick={() => setViewMode("grid")}
                                    title={tr("Gallery view", "Mode Galerie")}
                                    aria-label={tr("Gallery view", "Mode Galerie")}
                                >
                                    <FontAwesomeIcon icon={faBorderAll} />
                                    <span>{tr("Gallery", "Galerie")}</span>
                                </button>
                                <button
                                    type="button"
                                    className={`editor-detail-page__view-btn ${viewMode === "list" ? "is-active" : ""}`}
                                    onClick={() => setViewMode("list")}
                                    title={tr("Compact list view", "Mode Liste compacte")}
                                    aria-label={tr("Compact list view", "Mode Liste compacte")}
                                >
                                    <FontAwesomeIcon icon={faList} />
                                    <span>{tr("List", "Liste")}</span>
                                </button>
                            </div>
                        }
                    />
                </div>

                {/* Albums content */}
                {filteredBooks.length === 0 ? (
                    <div className="editor-detail-page__empty">
                        <FontAwesomeIcon icon={faBook} className="editor-detail-page__empty-icon" />
                        <h3>
                            {searchQuery || statusFilter !== "all"
                                ? tr("No books match the selected criteria", "Aucun album ne correspond aux critères sélectionnés")
                                : tr("No books found for this publisher", "Aucun album trouvé pour cet éditeur")}
                        </h3>
                        <p>
                            {searchQuery || statusFilter !== "all"
                                ? tr("Change your filters or reset the search to see all books.", "Modifiez vos filtres ou réinitialisez la recherche pour voir tous les albums.")
                                : tr("This publisher does not have any books linked in the database yet.", "Cet éditeur n'a pas encore d'album associé dans la base de données.")}
                        </p>
                    </div>
                ) : (
                    <>
                        {viewMode === "grid" ? (
                            <BookList books={paginatedBooks} />
                        ) : (
                            <div className="editor-detail-list">
                                {paginatedBooks.map((b) => (
                                    <div key={b.id} className="editor-detail-list-item">
                                        <div className="editor-detail-list-item__thumb">
                                            {b.coverUrl ? (
                                                <img src={b.coverUrl} alt={b.title} />
                                            ) : (
                                                <FontAwesomeIcon icon={faBook} />
                                            )}
                                        </div>

                                        <div className="editor-detail-list-item__info">
                                            <Link to={`/app/book/${b.id}`} className="editor-detail-list-item__title">
                                                {b.title}
                                            </Link>
                                            <div className="editor-detail-list-item__meta">
                                                {b.seriesName ? (
                                                    <Link to={`/app/series/${b.seriesId}`} className="editor-detail-list-item__series-link">
                                                        {b.seriesName}{b.volume != null ? ` — ${tr(`Volume ${b.volume}`, `Tome ${b.volume}`)}` : ""}
                                                    </Link>
                                                ) : (
                                                    <span>{tr("One-shot", "One-shot")}</span>
                                                )}
                                                {b.releaseDate && (
                                                    <span className="editor-detail-list-item__date">
                                                        • {new Date(b.releaseDate).getFullYear()}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="editor-detail-list-item__badges">
                                            {b.status === "OWNED" && (
                                                <span className="editor-detail-list-item__badge owned">{tr("Owned", "Possédé")}</span>
                                            )}
                                            {b.status === "WISHLISTED" && (
                                                <span className="editor-detail-list-item__badge wishlisted">{tr("Wishlist", "Souhait")}</span>
                                            )}
                                            {b.readingStatus && b.readingStatus !== "UNREAD" && (
                                                <span className="editor-detail-list-item__badge reading">
                                                    {b.readingStatus === "READ"
                                                        ? tr("Read", "Lu")
                                                        : b.readingStatus === "READING"
                                                        ? tr("Reading", "En cours")
                                                        : b.readingStatus}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <Pagination
                            currentPage={safePage}
                            totalPages={totalPages}
                            onPageChange={handlePageChange}
                            totalItems={totalItems}
                            startIndex={startIndex}
                            endIndex={endIndex}
                            pageSize={pageSize}
                            onPageSizeChange={handlePageSizeChange}
                            pageSizeOptions={viewMode === "grid" ? [24, 48, 96, 0] : [25, 50, 100, 0]}
                            itemLabel={tr("books", "albums")}
                        />
                    </>
                )}
            </div>
        </div>
    );
}
