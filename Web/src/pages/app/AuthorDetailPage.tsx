import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router";
import useSession from "../../hooks/UseSession.tsx";
import useLanguage from "../../hooks/UseLanguage.tsx";
import { useSnackbar } from "notistack";
import AuthorDTO from "../../dto/Author.dto.ts";
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
    faPenNib,
    faBook,
    faBorderAll,
    faList
} from "@fortawesome/free-solid-svg-icons";
import "./AuthorDetailPage.scss";

export default function AuthorDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const session = useSession();
    const { tr } = useLanguage();
    const { enqueueSnackbar } = useSnackbar();

    const [author, setAuthor] = useState<AuthorDTO | null>(null);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "owned" | "wishlisted">("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(24);

    // Fetch author data
    const fetchAuthor = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const res = await session.customFetch(`/authors/${id}`, { method: "GET" });
            if (res.ok) {
                const data: AuthorDTO = await res.json();
                setAuthor(data);
            } else {
                enqueueSnackbar(tr("Author not found", "Auteur introuvable"), { variant: "error" });
            }
        } catch (err) {
            console.error("Error loading author detail:", err);
            enqueueSnackbar(tr("Error loading author", "Erreur lors du chargement de l'auteur"), { variant: "error" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAuthor();
    }, [id, session]);

    useEffect(() => {
        setCurrentPage(1);
    }, [id, searchQuery, statusFilter]);

    // Toggle follow
    const handleToggleFollow = async () => {
        if (!author) return;
        const newState = !author.isFollowed;

        // Optimistic update
        setAuthor((prev) => (prev ? { ...prev, isFollowed: newState } : null));

        try {
            const res = await session.customFetch(`/user/follows/author/${author.id}/toggle`, {
                method: "POST"
            });
            if (res.ok) {
                const data = await res.json();
                const followed = Boolean(data.following);
                setAuthor((prev) => (prev ? { ...prev, isFollowed: followed } : null));
                enqueueSnackbar(
                    followed
                        ? tr("Author added to your followed list", "Auteur ajouté à vos suivis")
                        : tr("Author removed from your followed list", "Auteur retiré de vos suivis"),
                    { variant: "info" }
                );
            }
        } catch (err) {
            console.error("Error toggling follow:", err);
            setAuthor((prev) => (prev ? { ...prev, isFollowed: !newState } : null));
            enqueueSnackbar(
                tr("Error updating follow status", "Erreur lors de la modification du suivi"),
                { variant: "error" }
            );
        }
    };

    // Filtered books
    const filteredBooks = useMemo(() => {
        if (!author?.books) return [];
        let list = author.books;

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
    }, [author?.books, statusFilter, searchQuery]);

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

    const fullName = author
        ? `${author.firstname || ""} ${author.lastname || ""}`.trim()
        : "";

    if (loading) {
        return (
            <div className="author-detail-page">
                <WrapperHeader>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <button
                            type="button"
                            className="author-detail-page__back-btn"
                            onClick={() => navigate(-1)}
                            aria-label={tr("Back", "Retour")}
                        >
                            <FontAwesomeIcon icon={faArrowLeft} />
                        </button>
                        <h2 style={{ margin: 0 }}>{tr("Loading author...", "Chargement de l'auteur...")}</h2>
                    </div>
                </WrapperHeader>
                <div className="author-detail-page__content">
                    <div className="author-detail-page__empty">
                        <p>{tr("Loading author information...", "Chargement des informations de l'auteur...")}</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!author) {
        return (
            <div className="author-detail-page">
                <WrapperHeader>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <button
                            type="button"
                            className="author-detail-page__back-btn"
                            onClick={() => navigate(-1)}
                            aria-label={tr("Back", "Retour")}
                        >
                            <FontAwesomeIcon icon={faArrowLeft} />
                        </button>
                        <h2 style={{ margin: 0 }}>{tr("Author not found", "Auteur non trouvé")}</h2>
                    </div>
                </WrapperHeader>
                <div className="author-detail-page__content">
                    <div className="author-detail-page__empty">
                        <FontAwesomeIcon icon={faPenNib} className="author-detail-page__empty-icon" />
                        <h3>{tr("This author does not exist or has been deleted", "Cet auteur n'existe pas ou a été supprimé")}</h3>
                        <button
                            type="button"
                            className="author-detail-page__btn author-detail-page__btn--primary"
                            onClick={() => navigate(-1)}
                        >
                            {tr("Back", "Retour")}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const totalBooks = author.books?.length || 0;
    const ownedBooks = (author.books || []).filter((b) => b.status === "OWNED").length;
    const wishlistedBooks = (author.books || []).filter((b) => b.status === "WISHLISTED").length;

    return (
        <div className="author-detail-page">
            <WrapperHeader>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", flexWrap: "wrap", gap: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <button
                            type="button"
                            className="author-detail-page__back-btn"
                            onClick={() => navigate(-1)}
                            aria-label={tr("Back", "Retour")}
                            title={tr("Back", "Retour")}
                        >
                            <FontAwesomeIcon icon={faArrowLeft} />
                        </button>
                    </div>

                    <div>
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

                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                        <button
                            type="button"
                            className={`author-detail-page__follow-btn ${author.isFollowed ? "is-followed" : ""}`}
                            onClick={handleToggleFollow}
                            title={
                                author.isFollowed
                                    ? tr("Following author (click to unfollow)", "Auteur suivi (cliquer pour ne plus suivre)")
                                    : tr("Follow this author", "Suivre cet auteur")
                            }
                        >
                            <FontAwesomeIcon icon={author.isFollowed ? faCheck : faBell} />
                            <span>{author.isFollowed ? tr("Following author", "Auteur suivi") : tr("Follow author", "Suivre l'auteur")}</span>
                        </button>
                    </div>
                </div>
            </WrapperHeader>

            <div className="author-detail-page__content">
                {/* Hero / Information Card */}
                <div className="author-detail-hero">
                    <div className="author-detail-hero__info">
                        <div className="author-detail-hero__badge">
                            <FontAwesomeIcon icon={faPenNib} />
                            <span>{tr("Author", "Auteur / Autrice")}</span>
                        </div>

                        <h1 className="author-detail-hero__name">{fullName}</h1>

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
                            <div className="author-detail-page__view-toggle">
                                <button
                                    type="button"
                                    className={`author-detail-page__view-btn ${viewMode === "grid" ? "is-active" : ""}`}
                                    onClick={() => setViewMode("grid")}
                                    title={tr("Gallery view", "Mode Galerie")}
                                    aria-label={tr("Gallery view", "Mode Galerie")}
                                >
                                    <FontAwesomeIcon icon={faBorderAll} />
                                    <span>{tr("Gallery", "Galerie")}</span>
                                </button>
                                <button
                                    type="button"
                                    className={`author-detail-page__view-btn ${viewMode === "list" ? "is-active" : ""}`}
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
                    <div className="author-detail-page__empty">
                        <FontAwesomeIcon icon={faBook} className="author-detail-page__empty-icon" />
                        <h3>
                            {searchQuery || statusFilter !== "all"
                                ? tr("No books match the selected criteria", "Aucun album ne correspond aux critères sélectionnés")
                                : tr("No books found for this author", "Aucun album trouvé pour cet auteur")}
                        </h3>
                        <p>
                            {searchQuery || statusFilter !== "all"
                                ? tr("Change your filters or reset the search to see all books.", "Modifiez vos filtres ou réinitialisez la recherche pour voir tous les albums.")
                                : tr("This author does not have any books linked in the database yet.", "Cet auteur n'a pas encore d'album associé dans la base de données.")}
                        </p>
                    </div>
                ) : (
                    <>
                        {viewMode === "grid" ? (
                            <BookList books={paginatedBooks} />
                        ) : (
                            <div className="author-detail-list">
                                {paginatedBooks.map((b) => (
                            <div key={b.id} className="author-detail-list-item">
                                <div className="author-detail-list-item__thumb">
                                    {b.coverUrl ? (
                                        <img src={b.coverUrl} alt={b.title} />
                                    ) : (
                                        <FontAwesomeIcon icon={faBook} />
                                    )}
                                </div>

                                <div className="author-detail-list-item__info">
                                    <Link to={`/app/book/${b.id}`} className="author-detail-list-item__title">
                                        {b.title}
                                    </Link>
                                    <div className="author-detail-list-item__meta">
                                        {b.seriesName ? (
                                            <Link to={`/app/series/${b.seriesId}`} className="author-detail-list-item__series-link">
                                                {b.seriesName}{b.volume != null ? ` — ${tr(`Volume ${b.volume}`, `Tome ${b.volume}`)}` : ""}
                                            </Link>
                                        ) : (
                                            <span>{tr("One-shot", "One-shot")}</span>
                                        )}
                                        {b.releaseDate && (
                                            <span className="author-detail-list-item__date">
                                                • {new Date(b.releaseDate).getFullYear()}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="author-detail-list-item__badges">
                                    {b.status === "OWNED" && (
                                        <span className="author-detail-list-item__badge owned">{tr("Owned", "Possédé")}</span>
                                    )}
                                    {b.status === "WISHLISTED" && (
                                        <span className="author-detail-list-item__badge wishlisted">{tr("Wishlist", "Souhait")}</span>
                                    )}
                                    {b.readingStatus && b.readingStatus !== "UNREAD" && (
                                        <span className="author-detail-list-item__badge reading">
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
