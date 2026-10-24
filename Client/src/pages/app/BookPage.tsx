import { useParams, Link } from "react-router";
import { ReactNode, useEffect, useState } from "react";
import BookDTO from "../../dto/Book.dto";
import SeriesDTO from "../../dto/Series.dto.ts";
import UserBookTransactionDTO from "../../dto/UserBookTransaction.dto.ts";
import { useSnackbar } from "notistack";
import useSession, { SessionContextType } from "../../hooks/UseSession.tsx";
import { getSeriesStatusLabel } from "../../dto/Series.dto.ts";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faArrowLeft,
    faBook,
    faHeart,
    faPlus,
    faCheck,
    faCalendarDays,
    faBarcode,
    faRulerCombined,
    faWeightHanging,
    faFileLines,
    faTag,
    faPenNib,
    faPalette,
    faPaintbrush,
    faBookBookmark,
    faTags,
    faChevronLeft,
    faChevronRight,
    faBookOpen,
    faBuilding,
    faLayerGroup,
    faBell,
    faBellSlash,
    faXmark,
    faClone,
    faPen,
    faTrash,
    faTrashCan,
    faCoins,
    faCartShopping,
    faStore,
    faNoteSticky,
    IconDefinition
} from "@fortawesome/free-solid-svg-icons";
import { Dialog } from "@mui/material";

import "./BookPage.scss";
import { WrapperHeader } from "../../components/Wrapper/Wrapper.tsx";

type FollowType = "series" | "author" | "editor" | "collection";

interface FollowTarget {
    type: FollowType;
    id: number | string;
    name: string;
    roleOrSubtitle?: string;
}

function getFollowTypeIcon(type: FollowType) {
    switch (type) {
        case "series": return faBook;
        case "author": return faPenNib;
        case "editor": return faBuilding;
        case "collection": return faLayerGroup;
    }
}

function getFollowTypeLabel(type: FollowType) {
    switch (type) {
        case "series": return "Série";
        case "author": return "Auteur";
        case "editor": return "Maison d'édition";
        case "collection": return "Collection";
    }
}

function ChangeBookStatusButton({
    status,
    setStatus,
    newStatus,
    children,
    bookId,
    session,
    icon
}: {
    status: string | null;
    setStatus: (s: string | null) => void;
    newStatus: string;
    children: ReactNode;
    bookId?: string;
    session?: SessionContextType;
    icon?: IconDefinition;
}) {
    const [processing, setProcessing] = useState(false);
    const isCurrent = status === newStatus;

    const handleClick = async () => {
        if (!newStatus || !bookId || !session || processing) return;
        setProcessing(true);
        try {
            if (isCurrent) {
                if (newStatus === "FOR_SALE") {
                    // Retirer de la vente -> retourne dans nos albums (OWNED)
                    const url = `/user/sales/${encodeURIComponent(bookId)}`;
                    const response = await session.customFetch(url, { method: "DELETE" });
                    if (response.ok) setStatus("OWNED");
                } else {
                    // Retirer le livre
                    const url = `/user/removeBook/${encodeURIComponent(bookId)}`;
                    const response = await session.customFetch(url, { method: "DELETE" });
                    if (response.ok) setStatus(null);
                }
            } else {
                // Ajouter / changer le statut
                const url = `/user/addBook/${encodeURIComponent(bookId)}/${encodeURIComponent(newStatus)}`;
                const response = await session.customFetch(url, { method: "POST" });
                if (response.ok) setStatus(newStatus);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <button
            type="button"
            className={`book-action-btn ${isCurrent ? 'book-action-btn--active' : ''}`}
            onClick={handleClick}
            disabled={processing}
        >
            <FontAwesomeIcon icon={isCurrent ? faCheck : (icon || faPlus)} />
            <span>{children}</span>
        </button>
    );
}

export default function BookPage() {
    const { id } = useParams<{ id?: string }>();
    const session = useSession();

    const [book, setBook] = useState<BookDTO | null>(null);
    const [bookStatus, setBookStatus] = useState<string | null>(null);
    const [readingStatus, setReadingStatus] = useState<string>("UNREAD");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Purchase & Sales Transactions History
    const [transactions, setTransactions] = useState<UserBookTransactionDTO[]>([]);
    const [loadingTransactions, setLoadingTransactions] = useState(false);

    // Transaction modals
    const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
    const [saleModalOpen, setSaleModalOpen] = useState(false);
    const [submittingTx, setSubmittingTx] = useState(false);

    // Buy modal form
    const [buyDate, setBuyDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
    const [buyPrice, setBuyPrice] = useState<string>("");
    const [buyLocation, setBuyLocation] = useState<string>("");
    const [buyMemo, setBuyMemo] = useState<string>("");

    // Sale modal form
    const [sellDate, setSellDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
    const [sellPrice, setSellPrice] = useState<string>("");
    const [sellLocation, setSellLocation] = useState<string>("");
    const [sellMemo, setSellMemo] = useState<string>("");

    const fetchTransactions = (bookId: string) => {
        setLoadingTransactions(true);
        session.customFetch(`/user/books/${encodeURIComponent(bookId)}/transactions`, { method: "GET" })
            .then(async (res) => {
                if (res.ok) {
                    const data: UserBookTransactionDTO[] = await res.json();
                    setTransactions(data);
                } else {
                    setTransactions([]);
                }
            })
            .catch(() => setTransactions([]))
            .finally(() => setLoadingTransactions(false));
    };

    const handleOpenPurchaseModal = () => {
        setBuyDate(new Date().toISOString().split("T")[0]);
        setBuyPrice(book?.price ? String(book.price) : "");
        setBuyLocation("");
        setBuyMemo("");
        setPurchaseModalOpen(true);
    };

    const handleSavePurchase = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id || submittingTx) return;

        setSubmittingTx(true);
        try {
            const parsedPrice = buyPrice ? parseFloat(buyPrice) : null;
            const res = await session.customFetch(`/user/books/${encodeURIComponent(id)}/transactions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "BOUGHT",
                    date: buyDate,
                    price: parsedPrice,
                    location: buyLocation.trim() || null,
                    memo: buyMemo.trim() || null
                })
            });

            if (res.ok) {
                enqueueSnackbar("Achat enregistré avec succès !", { variant: "success" });
                setPurchaseModalOpen(false);
                fetchTransactions(id);
                if (bookStatus !== "OWNED" && bookStatus !== "FOR_SALE" && bookStatus !== "SOLD") {
                    setBookStatus("OWNED");
                }
            } else {
                enqueueSnackbar("Erreur lors de l'enregistrement de l'achat", { variant: "error" });
            }
        } catch (err: any) {
            enqueueSnackbar(`Erreur: ${err.message}`, { variant: "error" });
        } finally {
            setSubmittingTx(false);
        }
    };

    const handleOpenSaleModal = () => {
        setSellDate(new Date().toISOString().split("T")[0]);
        setSellPrice(book?.price ? String(book.price) : "");
        setSellLocation("");
        setSellMemo("");
        setSaleModalOpen(true);
    };

    const handleSaveSale = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id || submittingTx) return;

        setSubmittingTx(true);
        try {
            const parsedPrice = sellPrice ? parseFloat(sellPrice) : null;
            const res = await session.customFetch(`/user/books/${encodeURIComponent(id)}/transactions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "SOLD",
                    date: sellDate,
                    price: parsedPrice,
                    location: sellLocation.trim() || null,
                    memo: sellMemo.trim() || null
                })
            });

            if (res.ok) {
                enqueueSnackbar("Vente enregistrée avec succès !", { variant: "success" });
                setSaleModalOpen(false);
                setBookStatus("SOLD");
                fetchTransactions(id);
            } else {
                enqueueSnackbar("Erreur lors de l'enregistrement de la vente", { variant: "error" });
            }
        } catch (err: any) {
            enqueueSnackbar(`Erreur: ${err.message}`, { variant: "error" });
        } finally {
            setSubmittingTx(false);
        }
    };

    const handleDeleteTransaction = async (txId: number) => {
        const confirm = window.confirm("Supprimer cette ligne d'historique ?");
        if (!confirm || !id) return;

        try {
            const res = await session.customFetch(`/user/transactions/${txId}`, { method: "DELETE" });
            if (res.ok) {
                enqueueSnackbar("Ligne supprimée", { variant: "info" });
                fetchTransactions(id);
            } else {
                enqueueSnackbar("Erreur lors de la suppression", { variant: "error" });
            }
        } catch (err: any) {
            enqueueSnackbar(`Erreur: ${err.message}`, { variant: "error" });
        }
    };

    // Follow system states
    const [followStates, setFollowStates] = useState<Record<string, boolean>>({});
    const [followModalTarget, setFollowModalTarget] = useState<FollowTarget | null>(null);
    const [followProcessing, setFollowProcessing] = useState(false);
    const { enqueueSnackbar } = useSnackbar();

    // Series Association Dialog state
    const [seriesModalOpen, setSeriesModalOpen] = useState(false);
    const [seriesListOptions, setSeriesListOptions] = useState<SeriesDTO[]>([]);
    const [selectedSeriesId, setSelectedSeriesId] = useState<number | null>(null);
    const [selectedVolume, setSelectedVolume] = useState<number>(1);
    const [seriesModalMode, setSeriesModalMode] = useState<"select" | "create">("select");
    const [newSeriesName, setNewSeriesName] = useState("");
    const [newSeriesCategory, setNewSeriesCategory] = useState<number>(3);
    const [newSeriesStatus, setNewSeriesStatus] = useState("ON_GOING");
    const [savingSeries, setSavingSeries] = useState(false);

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
        if (!id) return;

        setLoading(true);
        setError(null);
        setBook(null);
        setBookStatus(null);
        setReadingStatus("UNREAD");
        fetchTransactions(id);

        const fetchUrl = `/books/${encodeURIComponent(id)}?withCollection=1&withEditor=1&withAuthors=1&withStatus=1&withSeries=1`;
        session.customFetch(fetchUrl, {
            method: "GET",
        }).then(async (response) => {
            if (response.ok) {
                const data: BookDTO = await response.json();
                setBook(data);
                setBookStatus(data.status);
                setReadingStatus(data.readingStatus || "UNREAD");

                // Fetch batch follow status
                const params = new URLSearchParams();
                if (data.series?.id) params.set("seriesId", String(data.series.id));
                if (data.editor?.id) params.set("editorId", String(data.editor.id));
                if (data.collection?.id) params.set("collectionId", String(data.collection.id));
                if (data.authors && data.authors.length > 0) {
                    const aIds = data.authors.map((a) => a.id).filter(Boolean);
                    if (aIds.length > 0) params.set("authorIds", aIds.join(","));
                }

                session.customFetch(`/user/follows/batch?${params.toString()}`, { method: "GET" })
                    .then(async (followRes) => {
                        if (followRes.ok) {
                            const batch = await followRes.json();
                            const newStates: Record<string, boolean> = {};
                            if (data.series?.id && batch.series !== undefined) {
                                newStates[`series_${data.series.id}`] = Boolean(batch.series);
                            }
                            if (data.editor?.id && batch.editor !== undefined) {
                                newStates[`editor_${data.editor.id}`] = Boolean(batch.editor);
                            }
                            if (data.collection?.id && batch.collection !== undefined) {
                                newStates[`collection_${data.collection.id}`] = Boolean(batch.collection);
                            }
                            if (batch.authors) {
                                Object.entries(batch.authors).forEach(([aId, followed]) => {
                                    newStates[`author_${aId}`] = Boolean(followed);
                                });
                            }
                            setFollowStates(newStates);
                        }
                    })
                    .catch((err) => {
                        console.error("Batch follow status error:", err);
                    });
            } else {
                const errorText = await response.text();
                setError(`Erreur ${response.status}: ${errorText}`);
            }
        }).catch((err) => {
            setError(`Erreur de connexion: ${err.message}`);
        }).finally(() => {
            setLoading(false);
        });
    }, [id, session]);

    const handleOpenSeriesModal = async () => {
        setSelectedSeriesId(book?.series?.id ? Number(book.series.id) : null);
        setSelectedVolume(book?.volume != null ? book.volume : 1);
        setSeriesModalMode("select");
        setNewSeriesName("");
        setNewSeriesCategory(3);
        setNewSeriesStatus("ON_GOING");
        setSeriesModalOpen(true);

        try {
            const res = await session.customFetch("/series", { method: "GET" });
            if (res.ok) {
                const list: SeriesDTO[] = await res.json();
                setSeriesListOptions(list);
            }
        } catch (err) {
            console.error("Error fetching series list:", err);
        }
    };

    const handleSaveSeriesAssociation = async () => {
        if (!id || savingSeries) return;
        setSavingSeries(true);

        try {
            if (seriesModalMode === "create") {
                if (!newSeriesName.trim()) {
                    enqueueSnackbar("Veuillez renseigner le nom de la série", { variant: "warning" });
                    setSavingSeries(false);
                    return;
                }

                // 1. Create series
                const createRes = await session.customFetch("/series", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: newSeriesName.trim(),
                        categoryId: newSeriesCategory,
                        status: newSeriesStatus,
                        bookIds: [Number(id)]
                    })
                });

                if (!createRes.ok) {
                    const errText = await createRes.text();
                    enqueueSnackbar(`Erreur: ${errText}`, { variant: "error" });
                    setSavingSeries(false);
                    return;
                }

                const createdSeries: SeriesDTO = await createRes.json();

                // 2. Set volume if needed
                if (selectedVolume != null) {
                    await session.customFetch(`/books/${encodeURIComponent(id)}/series`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ seriesId: createdSeries.id, volume: selectedVolume })
                    });
                }

                enqueueSnackbar(`Nouvelle série « ${createdSeries.name} » créée et associée`, { variant: "success" });
            } else {
                // Link to existing series
                const updateRes = await session.customFetch(`/books/${encodeURIComponent(id)}/series`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ seriesId: selectedSeriesId, volume: selectedVolume })
                });

                if (!updateRes.ok) {
                    enqueueSnackbar("Erreur lors de l'association à la série", { variant: "error" });
                    setSavingSeries(false);
                    return;
                }

                enqueueSnackbar(selectedSeriesId ? "Série associée avec succès" : "Série dissociée", { variant: "success" });
            }

            // Reload book
            const fetchUrl = `/books/${encodeURIComponent(id)}?withCollection=1&withEditor=1&withAuthors=1&withStatus=1`;
            const refreshRes = await session.customFetch(fetchUrl, { method: "GET" });
            if (refreshRes.ok) {
                const refreshedBook: BookDTO = await refreshRes.json();
                setBook(refreshedBook);
            }
            setSeriesModalOpen(false);
        } catch (err: any) {
            enqueueSnackbar(`Erreur: ${err.message}`, { variant: "error" });
        } finally {
            setSavingSeries(false);
        }
    };

    const handleRemoveFromSeries = async () => {
        if (!id || savingSeries) return;
        const confirm = window.confirm("Retirer cet album de sa série ?");
        if (!confirm) return;

        setSavingSeries(true);
        try {
            const updateRes = await session.customFetch(`/books/${encodeURIComponent(id)}/series`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ seriesId: null })
            });

            if (updateRes.ok) {
                enqueueSnackbar("Album retiré de la série", { variant: "info" });
                const fetchUrl = `/books/${encodeURIComponent(id)}?withCollection=1&withEditor=1&withAuthors=1&withStatus=1`;
                const refreshRes = await session.customFetch(fetchUrl, { method: "GET" });
                if (refreshRes.ok) {
                    const refreshedBook: BookDTO = await refreshRes.json();
                    setBook(refreshedBook);
                }
                setSeriesModalOpen(false);
            }
        } catch (err: any) {
            enqueueSnackbar(`Erreur: ${err.message}`, { variant: "error" });
        } finally {
            setSavingSeries(false);
        }
    };

    const openFollowModal = (type: FollowType, targetId?: number | string | null, name?: string, roleOrSubtitle?: string) => {
        if (!targetId || !name) return;
        setFollowModalTarget({ type, id: targetId, name, roleOrSubtitle });
    };

    const handleToggleFollow = async () => {
        if (!followModalTarget || !followModalTarget.id || followProcessing) return;
        const { type, id: targetId } = followModalTarget;
        const key = `${type}_${targetId}`;
        const currentlyFollowing = Boolean(followStates[key]);
        const newState = !currentlyFollowing;

        setFollowProcessing(true);
        // Optimistic update
        setFollowStates(prev => ({ ...prev, [key]: newState }));

        try {
            const res = await session.customFetch(`/user/follows/${type}/${targetId}/toggle`, {
                method: "POST"
            });
            if (res.ok) {
                const data = await res.json();
                setFollowStates(prev => ({ ...prev, [key]: Boolean(data.following) }));
            } else {
                // Revert
                setFollowStates(prev => ({ ...prev, [key]: currentlyFollowing }));
            }
        } catch (err) {
            console.error("Toggle follow error:", err);
            setFollowStates(prev => ({ ...prev, [key]: currentlyFollowing }));
        } finally {
            setFollowProcessing(false);
        }
    };

    // Author categorization & deduplication helper
    const totalBought = transactions
        .filter((t) => t.type === "BOUGHT" && t.price != null)
        .reduce((sum, t) => sum + Number(t.price || 0), 0);
    const totalSold = transactions
        .filter((t) => t.type === "SOLD" && t.price != null)
        .reduce((sum, t) => sum + Number(t.price || 0), 0);
    const hasBought = transactions.some((t) => t.type === "BOUGHT");
    const hasSold = transactions.some((t) => t.type === "SOLD");

    const allAuthors = book?.authors || [];
    const dessinateurs = allAuthors.filter(
        (a) => a.type && (a.type.toLowerCase() === "illustrator" || a.type.toLowerCase().includes("dessin") || a.type.toLowerCase().includes("pencil") || a.type.toLowerCase().includes("artist"))
    );
    const coloristes = allAuthors.filter(
        (a) => a.type && (a.type.toLowerCase() === "colorist" || a.type.toLowerCase().includes("color") || a.type.toLowerCase().includes("couleur"))
    );
    const scenaristes = allAuthors.filter(
        (a) => !dessinateurs.includes(a) && !coloristes.includes(a)
    );

    const totalVolumes = book?.series?.totalVolumes && book.series.totalVolumes > 0
        ? book.series.totalVolumes
        : null;

    const hasPrevious = Boolean(book?.previousBookId);
    const canHavePrevious = Boolean(book?.series && book?.volume != null && book.volume > 1);
    const showPrevious = hasPrevious || canHavePrevious;

    const hasNext = Boolean(book?.nextBookId);
    const canHaveNext = Boolean(
        book?.series && book?.volume != null && totalVolumes != null && book.volume < totalVolumes
    );
    const showNext = hasNext || canHaveNext;

    const handleReadingStatusChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newStatus = event.target.value;
        if (!id || !session) return;
        try {
            if (!newStatus) {
                const response = await session.customFetch(`/user/readingStatus/${encodeURIComponent(id)}`, {
                    method: "DELETE"
                });
                if (response.ok) {
                    setReadingStatus("UNREAD");
        fetchTransactions(id);
                }
            } else {
                const response = await session.customFetch(`/user/readingStatus/${encodeURIComponent(id)}/${encodeURIComponent(newStatus)}`, {
                    method: "POST"
                });
                if (response.ok) {
                    setReadingStatus(newStatus);
                }
            }
        } catch (err) {
            console.error("Reading status update error:", err);
        }
    };

    return (
        <div className="book-page">
            <WrapperHeader>
                <div className="book-page__header-nav">
                    <Link to="/app/home" className="book-page__back-link">
                        <FontAwesomeIcon icon={faArrowLeft} />
                        <span>Retour</span>
                    </Link>
                </div>
            </WrapperHeader>

            <div className="book-page__content">
                {loading && (
                    <div className="book-page__state">
                        <p>Chargement des détails de l'ouvrage...</p>
                    </div>
                )}

                {error && (
                    <div className="book-page__state book-page__state--error">
                        <p>{error}</p>
                    </div>
                )}

                {book && (
                    <div className="book-page__grid">
                        {/* Left column: Cover & Tome Navigation */}
                        <div className="book-page__cover-col">
                            <div className="book-page__cover-wrapper">
                                {book.coverUrl ? (
                                    <img
                                        src={book.coverUrl}
                                        alt={`Couverture de ${book.title}`}
                                        className="book-page__cover"
                                        decoding="async"
                                    />
                                ) : (
                                    <div className="book-page__cover-fallback">
                                        <FontAwesomeIcon icon={faBook} />
                                        <span>{book.title}</span>
                                    </div>
                                )}
                            </div>

                            {/* Navigation précédent / suivant le tome dans la série */}
                            {(showPrevious || showNext) && (
                                <div className="book-page__volume-nav">
                                    {showPrevious && (
                                        hasPrevious ? (
                                            <Link
                                                to={`/app/book/${book.previousBookId}`}
                                                className="book-page__volume-nav-btn book-page__volume-nav-btn--prev"
                                                title={book.previousBook?.title ? `Tome précédent : ${book.previousBook.title}` : "Tome précédent"}
                                            >
                                                <FontAwesomeIcon icon={faChevronLeft} />
                                                <span>Précédent</span>
                                            </Link>
                                        ) : (
                                            <button
                                                type="button"
                                                disabled
                                                className="book-page__volume-nav-btn book-page__volume-nav-btn--disabled book-page__volume-nav-btn--prev"
                                                title="Tome précédent non disponible dans la bibliothèque"
                                            >
                                                <FontAwesomeIcon icon={faChevronLeft} />
                                                <span>Précédent</span>
                                            </button>
                                        )
                                    )}
                                    {showNext && (
                                        hasNext ? (
                                            <Link
                                                to={`/app/book/${book.nextBookId}`}
                                                className="book-page__volume-nav-btn book-page__volume-nav-btn--next"
                                                title={book.nextBook?.title ? `Tome suivant : ${book.nextBook.title}` : "Tome suivant"}
                                            >
                                                <span>Suivant</span>
                                                <FontAwesomeIcon icon={faChevronRight} />
                                            </Link>
                                        ) : (
                                            <button
                                                type="button"
                                                disabled
                                                className="book-page__volume-nav-btn book-page__volume-nav-btn--disabled book-page__volume-nav-btn--next"
                                                title="Tome suivant non disponible dans la bibliothèque"
                                            >
                                                <span>Suivant</span>
                                                <FontAwesomeIcon icon={faChevronRight} />
                                            </button>
                                        )
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Right column: Info & Actions */}
                        <div className="book-page__details-col">
                            {/* Badges */}
                            <div className="book-page__tags">
                                {book.series?.status && (
                                    <span className="book-page__tag book-page__tag--status">
                                        {getSeriesStatusLabel(book.series.status)}
                                    </span>
                                )}
                                {book.volume != null && (
                                    <span className="book-page__tag book-page__tag--volume">
                                        {book.series?.totalVolumes && book.series.totalVolumes > 1
                                            ? `Tome ${book.volume} sur ${Math.max(book.volume, book.series.totalVolumes)}`
                                            : `Tome ${book.volume}`}
                                    </span>
                                )}
                                {book.series?.category && (
                                    <span className="book-page__tag book-page__tag--category">
                                        {book.series.category}
                                    </span>
                                )}
                                {book.parentBookId && (
                                    <Link to={`/app/book/${book.parentBookId}`} className="book-page__tag book-page__tag--variant">
                                        <FontAwesomeIcon icon={faClone} />
                                        <span>Couverture variante</span>
                                    </Link>
                                )}
                            </div>

                            {/* Titles */}
                            <div className="book-page__headings">
                                {/* Série */}
                                {book.series?.name ? (
                                    <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "4px" }}>
                                        <h2 className="book-page__series-title" style={{ margin: 0 }}>
                                            <button
                                                type="button"
                                                className="book-page__entity-title-btn"
                                                onClick={() => openFollowModal("series", book.series?.id, book.series.name)}
                                                title={`Gérer le suivi de la série ${book.series.name}`}
                                            >
                                                <span>{book.series.name}</span>
                                                {book.series?.id && followStates[`series_${book.series.id}`] && (
                                                    <FontAwesomeIcon icon={faBell} className="book-page__followed-icon" />
                                                )}
                                            </button>
                                        </h2>
                                        <button
                                            type="button"
                                            onClick={handleOpenSeriesModal}
                                            title="Gérer ou modifier l'association de série"
                                            style={{
                                                background: "rgba(255, 255, 255, 0.05)",
                                                border: "1px solid var(--border-subtle)",
                                                color: "var(--text-muted)",
                                                padding: "4px 10px",
                                                borderRadius: "6px",
                                                fontSize: "0.75rem",
                                                cursor: "pointer",
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "6px"
                                            }}
                                        >
                                            <FontAwesomeIcon icon={faPen} />
                                            <span>Modifier la série</span>
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px", flexWrap: "wrap" }}>
                                        <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Aucune série associée</span>
                                        <button
                                            type="button"
                                            onClick={handleOpenSeriesModal}
                                            style={{
                                                background: "rgba(16, 185, 129, 0.15)",
                                                border: "1px solid var(--accent-primary)",
                                                color: "var(--accent-primary)",
                                                padding: "3px 10px",
                                                borderRadius: "14px",
                                                fontSize: "0.8rem",
                                                fontWeight: 600,
                                                cursor: "pointer",
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "6px"
                                            }}
                                        >
                                            <FontAwesomeIcon icon={faPlus} />
                                            <span>Associer à une série</span>
                                        </button>
                                    </div>
                                )}
                                <h1 className="book-page__title">{book.title}</h1>

                                {/* Auteurs cliquables pour Follow */}
                                {book.authors && book.authors.length > 0 && (
                                    <div className="book-page__authors-row">
                                        <span>Par</span>
                                        {book.authors.map((author, idx) => {
                                            const fullName = `${author.firstname || ""} ${author.lastname || ""}`.trim();
                                            const isFollowed = author.id ? Boolean(followStates[`author_${author.id}`]) : false;
                                            return (
                                                <span key={author.id || idx} className="book-page__author-item">
                                                    <button
                                                        type="button"
                                                        className="book-page__entity-inline-btn"
                                                        onClick={() => openFollowModal("author", author.id, fullName, author.type)}
                                                        title={`Gérer le suivi de ${fullName}`}
                                                    >
                                                        <span>{fullName}</span>
                                                        {isFollowed && (
                                                            <FontAwesomeIcon icon={faBell} className="book-page__followed-icon" />
                                                        )}
                                                    </button>
                                                    {idx < (book.authors?.length || 0) - 1 && (
                                                        <span className="book-page__author-sep">,</span>
                                                    )}
                                                </span>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {book.parentBookId && (
                                <div className="book-page__variant-banner">
                                    <FontAwesomeIcon icon={faClone} />
                                    <span>
                                        Ceci est une <strong>couverture variante</strong>.{" "}
                                        <Link to={`/app/book/${book.parentBookId}`}>
                                            Voir l'édition standard {book.parentBookTitle ? `(« ${book.parentBookTitle} »)` : ""}
                                        </Link>
                                    </span>
                                </div>
                            )}

                            {/* Description */}
                            {book.description && (
                                <div className="book-page__description">
                                    <p>{book.description}</p>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="book-page__actions">
                                {bookStatus !== "OWNED" && bookStatus !== "FOR_SALE" && bookStatus !== "SOLD" && (
                                    <ChangeBookStatusButton
                                        status={bookStatus}
                                        setStatus={setBookStatus}
                                        newStatus="WISHLISTED"
                                        bookId={id}
                                        session={session}
                                        icon={faHeart}
                                    >
                                        {bookStatus === "WISHLISTED" ? "Dans les souhaits" : "Liste de souhaits"}
                                    </ChangeBookStatusButton>
                                )}

                                {bookStatus !== "WISHLISTED" && (
                                    <ChangeBookStatusButton
                                        status={bookStatus}
                                        setStatus={setBookStatus}
                                        newStatus="OWNED"
                                        bookId={id}
                                        session={session}
                                        icon={faBook}
                                    >
                                        {bookStatus === "OWNED" ? "Dans la bibliothèque" : "Ajouter à la bibliothèque"}
                                    </ChangeBookStatusButton>
                                )}

                                {bookStatus !== "WISHLISTED" && (
                                    <ChangeBookStatusButton
                                        status={bookStatus}
                                        setStatus={setBookStatus}
                                        newStatus="FOR_SALE"
                                        bookId={id}
                                        session={session}
                                        icon={faTag}
                                    >
                                        {bookStatus === "FOR_SALE" ? "En vente" : (bookStatus === "SOLD" ? "Vendu (remettre en vente)" : "Mettre à vendre")}
                                    </ChangeBookStatusButton>
                                )}

                                {(bookStatus === "FOR_SALE" || bookStatus === "SOLD") && (
                                    <button
                                        type="button"
                                        className={`book-action-btn ${bookStatus === 'SOLD' ? 'book-action-btn--active' : ''}`}
                                        onClick={handleOpenSaleModal}
                                    >
                                        <FontAwesomeIcon icon={bookStatus === 'SOLD' ? faCheck : faCoins} />
                                        <span>{bookStatus === 'SOLD' ? 'Vendu' : 'Marquer comme vendu'}</span>
                                    </button>
                                )}

                                <div className={`book-reading-status-selector ${readingStatus && readingStatus.toUpperCase() !== "UNREAD" ? 'book-reading-status-selector--active' : ''}`}>
                                    <FontAwesomeIcon icon={faBookOpen} />
                                    <select
                                        value={readingStatus ? readingStatus.toUpperCase() : "UNREAD"}
                                        onChange={handleReadingStatusChange}
                                        aria-label="Statut de lecture"
                                    >
                                        <option value="UNREAD">Non lu</option>
                                        <option value="TO_READ">Pile à lire</option>
                                        <option value="READING">En cours de lecture</option>
                                        <option value="READ">Lu</option>
                                        <option value="ABANDONED">Abandonné</option>
                                    </select>
                                </div>
                            </div>

                            {/* Technical Details Card */}
                            <div className="book-page__specs-card">
                                <h3 className="book-page__specs-title">Détails techniques</h3>
                                <div className="book-page__specs-list">
                                    {/* Maison d'édition (Éditeur) cliquable */}
                                    {book.editor?.name && (
                                        <div className="book-page__spec-item">
                                            <span className="book-page__spec-label">
                                                <FontAwesomeIcon icon={faBuilding} /> Éditeur
                                            </span>
                                            <button
                                                type="button"
                                                className="book-page__spec-btn"
                                                onClick={() => openFollowModal("editor", book.editor?.id, book.editor!.name)}
                                                title={`Gérer le suivi de l'éditeur ${book.editor.name}`}
                                            >
                                                <span>{book.editor.name}</span>
                                                {book.editor?.id && followStates[`editor_${book.editor.id}`] && (
                                                    <FontAwesomeIcon icon={faBell} className="book-page__followed-icon" />
                                                )}
                                            </button>
                                        </div>
                                    )}

                                    {/* Collection cliquable */}
                                    {book.collection?.name && (
                                        <div className="book-page__spec-item">
                                            <span className="book-page__spec-label">
                                                <FontAwesomeIcon icon={faLayerGroup} /> Collection
                                            </span>
                                            <button
                                                type="button"
                                                className="book-page__spec-btn"
                                                onClick={() => openFollowModal("collection", book.collection?.id, book.collection!.name)}
                                                title={`Gérer le suivi de la collection ${book.collection.name}`}
                                            >
                                                <span>{book.collection.name}</span>
                                                {book.collection?.id && followStates[`collection_${book.collection.id}`] && (
                                                    <FontAwesomeIcon icon={faBell} className="book-page__followed-icon" />
                                                )}
                                            </button>
                                        </div>
                                    )}

                                    {/* Date de sortie */}
                                    {book.releaseDate && (
                                        <div className="book-page__spec-item">
                                            <span className="book-page__spec-label">
                                                <FontAwesomeIcon icon={faCalendarDays} /> Date de sortie
                                            </span>
                                            <span className="book-page__spec-value">
                                                {new Date(book.releaseDate).toLocaleDateString('fr-FR', {
                                                    day: 'numeric',
                                                    month: 'long',
                                                    year: 'numeric'
                                                })}
                                            </span>
                                        </div>
                                    )}

                                    {/* Scénariste(s) cliquable(s) */}
                                    {scenaristes.length > 0 && (
                                        <div className="book-page__spec-item">
                                            <span className="book-page__spec-label">
                                                <FontAwesomeIcon icon={faPenNib} /> Scénariste{scenaristes.length > 1 ? "s" : ""}
                                            </span>
                                            <div className="book-page__spec-authors-list">
                                                {scenaristes.map((a, i) => {
                                                    const name = `${a.firstname || ""} ${a.lastname || ""}`.trim();
                                                    const isFollowed = a.id ? Boolean(followStates[`author_${a.id}`]) : false;
                                                    return (
                                                        <button
                                                            type="button"
                                                            key={a.id || i}
                                                            className="book-page__spec-author-chip"
                                                            onClick={() => openFollowModal("author", a.id, name, "Scénariste")}
                                                            title={`Gérer le suivi de ${name}`}
                                                        >
                                                            <span>{name}</span>
                                                            {isFollowed && (
                                                                <FontAwesomeIcon icon={faBell} className="book-page__followed-icon" />
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Dessinateur(s) cliquable(s) */}
                                    {dessinateurs.length > 0 && (
                                        <div className="book-page__spec-item">
                                            <span className="book-page__spec-label">
                                                <FontAwesomeIcon icon={faPalette} /> Dessinateur{dessinateurs.length > 1 ? "s" : ""}
                                            </span>
                                            <div className="book-page__spec-authors-list">
                                                {dessinateurs.map((a, i) => {
                                                    const name = `${a.firstname || ""} ${a.lastname || ""}`.trim();
                                                    const isFollowed = a.id ? Boolean(followStates[`author_${a.id}`]) : false;
                                                    return (
                                                        <button
                                                            type="button"
                                                            key={a.id || i}
                                                            className="book-page__spec-author-chip"
                                                            onClick={() => openFollowModal("author", a.id, name, "Dessinateur")}
                                                            title={`Gérer le suivi de ${name}`}
                                                        >
                                                            <span>{name}</span>
                                                            {isFollowed && (
                                                                <FontAwesomeIcon icon={faBell} className="book-page__followed-icon" />
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Coloriste(s) cliquable(s) */}
                                    {coloristes.length > 0 && (
                                        <div className="book-page__spec-item">
                                            <span className="book-page__spec-label">
                                                <FontAwesomeIcon icon={faPaintbrush} /> Coloriste{coloristes.length > 1 ? "s" : ""}
                                            </span>
                                            <div className="book-page__spec-authors-list">
                                                {coloristes.map((a, i) => {
                                                    const name = `${a.firstname || ""} ${a.lastname || ""}`.trim();
                                                    const isFollowed = a.id ? Boolean(followStates[`author_${a.id}`]) : false;
                                                    return (
                                                        <button
                                                            type="button"
                                                            key={a.id || i}
                                                            className="book-page__spec-author-chip"
                                                            onClick={() => openFollowModal("author", a.id, name, "Coloriste")}
                                                            title={`Gérer le suivi de ${name}`}
                                                        >
                                                            <span>{name}</span>
                                                            {isFollowed && (
                                                                <FontAwesomeIcon icon={faBell} className="book-page__followed-icon" />
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* ISBN / EAN */}
                                    {book.isbn && (
                                        <div className="book-page__spec-item">
                                            <span className="book-page__spec-label">
                                                <FontAwesomeIcon icon={faBarcode} /> ISBN / EAN
                                            </span>
                                            <span className="book-page__spec-value">{book.isbn}</span>
                                        </div>
                                    )}

                                    {/* Dimensions */}
                                    {(book.length || book.height || book.thickness) ? (
                                        <div className="book-page__spec-item">
                                            <span className="book-page__spec-label">
                                                <FontAwesomeIcon icon={faRulerCombined} /> Dimensions
                                            </span>
                                            <span className="book-page__spec-value">
                                                {book.length || 0} × {book.height || 0} × {book.thickness || 0} mm
                                            </span>
                                        </div>
                                    ) : null}

                                    {/* Poids */}
                                    {book.weight ? (
                                        <div className="book-page__spec-item">
                                            <span className="book-page__spec-label">
                                                <FontAwesomeIcon icon={faWeightHanging} /> Poids
                                            </span>
                                            <span className="book-page__spec-value">{book.weight} g</span>
                                        </div>
                                    ) : null}

                                    {/* Pages */}
                                    {book.pageCount ? (
                                        <div className="book-page__spec-item">
                                            <span className="book-page__spec-label">
                                                <FontAwesomeIcon icon={faFileLines} /> Pages
                                            </span>
                                            <span className="book-page__spec-value">{book.pageCount} pages</span>
                                        </div>
                                    ) : null}

                                    {/* Type (cartonné, relié, souple, etc.) */}
                                    {book.type && (
                                        <div className="book-page__spec-item">
                                            <span className="book-page__spec-label">
                                                <FontAwesomeIcon icon={faBookBookmark} /> Type
                                            </span>
                                            <span className="book-page__spec-value">{book.type}</span>
                                        </div>
                                    )}

                                    {/* Thèmes (justice, gotham, enquête, aventure, scifi, etc.) */}
                                    {book.themes && book.themes.length > 0 && (
                                        <div className="book-page__spec-item book-page__spec-item--themes">
                                            <span className="book-page__spec-label">
                                                <FontAwesomeIcon icon={faTags} /> Thèmes
                                            </span>
                                            <div className="book-page__themes-list">
                                                {book.themes.map((theme: string) => (
                                                    <span key={theme} className="book-page__theme-pill">
                                                        {theme}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Prix */}
                                    {book.price ? (
                                        <div className="book-page__spec-item">
                                            <span className="book-page__spec-label">
                                                <FontAwesomeIcon icon={faTag} /> Prix
                                            </span>
                                            <span className="book-page__spec-value">{book.price} €</span>
                                        </div>
                                    ) : null}
                                </div>
                            </div>

                            {/* Purchase & Sales Transactions History Card */}
                            <div className="book-page__transactions-card">
                                <div className="book-page__transactions-header">
                                    <div className="book-page__transactions-header-title">
                                        <FontAwesomeIcon icon={faCoins} />
                                        <h3>Historique d'achat (Acheté, Vendu) {transactions.length > 0 ? `(${transactions.length})` : ""}</h3>
                                    </div>
                                    <div className="book-page__transactions-header-actions">
                                        <button
                                            type="button"
                                            className="book-page__tx-btn book-page__tx-btn--buy"
                                            onClick={handleOpenPurchaseModal}
                                            title="Ajouter un achat pour cet album"
                                        >
                                            <FontAwesomeIcon icon={faCartShopping} />
                                            <span>Ajouter un achat</span>
                                        </button>
                                        <button
                                            type="button"
                                            className="book-page__tx-btn book-page__tx-btn--sell"
                                            onClick={handleOpenSaleModal}
                                            title="Renseigner une vente pour cet album"
                                        >
                                            <FontAwesomeIcon icon={faCoins} />
                                            <span>Renseigner une vente</span>
                                        </button>
                                    </div>
                                </div>

                                {transactions.length > 0 && (
                                    <div className="book-page__transactions-summary">
                                        {hasBought && (
                                            <div className="book-page__summary-pill book-page__summary-pill--bought">
                                                <span>Total acheté :</span>
                                                <strong>{totalBought.toFixed(2).replace('.', ',')} €</strong>
                                            </div>
                                        )}
                                        {hasSold && (
                                            <div className="book-page__summary-pill book-page__summary-pill--sold">
                                                <span>Total vendu :</span>
                                                <strong>{totalSold.toFixed(2).replace('.', ',')} €</strong>
                                            </div>
                                        )}
                                        {hasBought && hasSold && (
                                            <div className="book-page__summary-pill">
                                                <span>Solde :</span>
                                                <strong style={{ color: totalSold >= totalBought ? "#34d399" : "#f87171" }}>
                                                    {(totalSold - totalBought >= 0 ? "+" : "") + (totalSold - totalBought).toFixed(2).replace('.', ',')} €
                                                </strong>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {loadingTransactions ? (
                                    <div className="book-page__transactions-empty">
                                        <p>Chargement de l'historique...</p>
                                    </div>
                                ) : transactions.length === 0 ? (
                                    <div className="book-page__transactions-empty">
                                        <p>Aucun historique d'achat ou de vente renseigné pour cet album.</p>
                                        <div style={{ marginTop: "10px" }}>
                                            <button
                                                type="button"
                                                className="book-page__tx-btn book-page__tx-btn--buy"
                                                onClick={handleOpenPurchaseModal}
                                            >
                                                <FontAwesomeIcon icon={faCartShopping} />
                                                <span>Ajouter un premier achat</span>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="book-page__transactions-list">
                                        {transactions.map((tx) => {
                                            const isBuy = tx.type === "BOUGHT";
                                            return (
                                                <div key={tx.id} className="book-page__tx-item">
                                                    <div className="book-page__tx-left">
                                                        <span className={`book-page__tx-badge ${isBuy ? 'book-page__tx-badge--bought' : 'book-page__tx-badge--sold'}`}>
                                                            <FontAwesomeIcon icon={isBuy ? faCartShopping : faCoins} />
                                                            <span>{isBuy ? "Acheté" : "Vendu"}</span>
                                                        </span>

                                                        <div className="book-page__tx-details">
                                                            <div className="book-page__tx-date-location">
                                                                <span>
                                                                    {tx.date
                                                                        ? new Date(tx.date + 'T00:00:00').toLocaleDateString('fr-FR', {
                                                                            day: 'numeric',
                                                                            month: 'short',
                                                                            year: 'numeric'
                                                                        })
                                                                        : (tx.createdAt
                                                                            ? new Date(tx.createdAt).toLocaleDateString('fr-FR', {
                                                                                day: 'numeric',
                                                                                month: 'short',
                                                                                year: 'numeric'
                                                                            })
                                                                            : "Date non renseignée")}
                                                                </span>

                                                                {tx.location && (
                                                                    <span className="book-page__tx-location" title={isBuy ? "Lieu d'achat" : "Canal / Acheteur"}>
                                                                        <FontAwesomeIcon icon={faStore} />
                                                                        <span>{tx.location}</span>
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {tx.memo && (
                                                                <span className="book-page__tx-memo" title="Mémo">
                                                                    <FontAwesomeIcon icon={faNoteSticky} />
                                                                    <span>« {tx.memo} »</span>
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="book-page__tx-right">
                                                        <span className={`book-page__tx-price ${isBuy ? 'book-page__tx-price--bought' : 'book-page__tx-price--sold'}`}>
                                                            {tx.price != null ? `${Number(tx.price).toFixed(2).replace('.', ',')} €` : "- €"}
                                                        </span>

                                                        <button
                                                            type="button"
                                                            className="book-page__tx-delete"
                                                            onClick={() => handleDeleteTransaction(tx.id)}
                                                            title="Supprimer cette ligne"
                                                        >
                                                            <FontAwesomeIcon icon={faTrashCan} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Variants / Alternative Covers Section */}
                            {((book.variants && book.variants.length > 0) || Boolean(book.parentBookId)) && (
                                <div className="book-page__variants-card">
                                    <div className="book-page__variants-header">
                                        <FontAwesomeIcon icon={faClone} />
                                        <h3>Éditions & Couvertures alternatives ({1 + (book.variants?.length || (book.parentBookId ? 1 : 0))})</h3>
                                    </div>
                                    <p className="book-page__variants-desc">
                                        Sélectionnez une version pour afficher sa couverture dédiée, son ISBN et ses spécifications :
                                    </p>
                                    <div className="book-page__variants-grid">
                                        {/* Standard / Parent Edition */}
                                        {book.parentBookId ? (
                                            <Link
                                                to={`/app/book/${book.parentBookId}`}
                                                className="book-page__variant-pill"
                                                title={`Édition standard : ${book.parentBookTitle || ""}`}
                                            >
                                                <div className="book-page__variant-pill-thumb">
                                                    <FontAwesomeIcon icon={faBookOpen} />
                                                </div>
                                                <div className="book-page__variant-pill-info">
                                                    <span className="book-page__variant-pill-badge">Édition standard</span>
                                                    <span className="book-page__variant-pill-title">{book.parentBookTitle || "Édition standard"}</span>
                                                </div>
                                            </Link>
                                        ) : (
                                            <div className="book-page__variant-pill book-page__variant-pill--active" title="Édition standard affichée">
                                                {book.coverUrl ? (
                                                    <img src={book.coverUrl} alt={book.title} className="book-page__variant-pill-img" />
                                                ) : (
                                                    <div className="book-page__variant-pill-fallback"><FontAwesomeIcon icon={faBookOpen} /></div>
                                                )}
                                                <div className="book-page__variant-pill-info">
                                                    <span className="book-page__variant-pill-badge book-page__variant-pill-badge--active">Standard (Actuel)</span>
                                                    <span className="book-page__variant-pill-title">{book.title}</span>
                                                    {book.price ? <span className="book-page__variant-pill-price">{book.price} €</span> : null}
                                                </div>
                                            </div>
                                        )}

                                        {/* Variants list */}
                                        {book.variants && book.variants.map((v) => {
                                            const isCurrent = String(v.id) === String(book.id);
                                            if (isCurrent) {
                                                return (
                                                    <div key={v.id} className="book-page__variant-pill book-page__variant-pill--active" title="Variante actuelle affichée">
                                                        {v.coverUrl ? (
                                                            <img src={v.coverUrl} alt={v.title} className="book-page__variant-pill-img" />
                                                        ) : (
                                                            <div className="book-page__variant-pill-fallback"><FontAwesomeIcon icon={faBookOpen} /></div>
                                                        )}
                                                        <div className="book-page__variant-pill-info">
                                                            <span className="book-page__variant-pill-badge book-page__variant-pill-badge--active">Variante (Actuel)</span>
                                                            <span className="book-page__variant-pill-title">{v.title}</span>
                                                            {v.price ? <span className="book-page__variant-pill-price">{v.price} €</span> : null}
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return (
                                                <Link
                                                    key={v.id}
                                                    to={`/app/book/${v.id}`}
                                                    className="book-page__variant-pill"
                                                    title={v.title}
                                                >
                                                    {v.coverUrl ? (
                                                        <img src={v.coverUrl} alt={v.title} className="book-page__variant-pill-img" />
                                                    ) : (
                                                        <div className="book-page__variant-pill-fallback"><FontAwesomeIcon icon={faBookOpen} /></div>
                                                    )}
                                                    <div className="book-page__variant-pill-info">
                                                        <span className="book-page__variant-pill-badge book-page__variant-pill-badge--alt">Variante</span>
                                                        <span className="book-page__variant-pill-title">{v.title}</span>
                                                        {v.price ? <span className="book-page__variant-pill-price">{v.price} €</span> : null}
                                                    </div>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

                        {/* Series Association Modal */}
            <Dialog
                open={seriesModalOpen}
                onClose={() => setSeriesModalOpen(false)}
                PaperProps={{
                    style: {
                        backgroundColor: "var(--bg-surface, #1e1e24)",
                        border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))",
                        borderRadius: "16px",
                        maxWidth: "500px",
                        width: "100%",
                        padding: "24px",
                        color: "var(--text-primary)"
                    }
                }}
            >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <FontAwesomeIcon icon={faLayerGroup} style={{ color: "var(--accent-primary)" }} />
                        <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>
                            {book?.series ? "Gérer la série de cet album" : "Associer à une série"}
                        </h3>
                    </div>
                    <button
                        type="button"
                        onClick={() => setSeriesModalOpen(false)}
                        style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "1.1rem" }}
                    >
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>

                {/* Tabs: Choose existing vs Create new */}
                <div style={{ display: "flex", gap: "8px", background: "rgba(255, 255, 255, 0.04)", padding: "4px", borderRadius: "8px", marginBottom: "16px" }}>
                    <button
                        type="button"
                        onClick={() => setSeriesModalMode("select")}
                        style={{
                            flex: 1,
                            padding: "6px 12px",
                            background: seriesModalMode === "select" ? "var(--accent-primary)" : "transparent",
                            color: seriesModalMode === "select" ? "#fff" : "var(--text-muted)",
                            border: "none",
                            borderRadius: "6px",
                            fontWeight: 600,
                            fontSize: "0.85rem",
                            cursor: "pointer"
                        }}
                    >
                        Série existante
                    </button>
                    <button
                        type="button"
                        onClick={() => setSeriesModalMode("create")}
                        style={{
                            flex: 1,
                            padding: "6px 12px",
                            background: seriesModalMode === "create" ? "var(--accent-primary)" : "transparent",
                            color: seriesModalMode === "create" ? "#fff" : "var(--text-muted)",
                            border: "none",
                            borderRadius: "6px",
                            fontWeight: 600,
                            fontSize: "0.85rem",
                            cursor: "pointer"
                        }}
                    >
                        + Nouvelle série
                    </button>
                </div>

                {seriesModalMode === "select" ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                        <div>
                            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                                Sélectionner une série
                            </label>
                            <select
                                value={selectedSeriesId || ""}
                                onChange={(e) => setSelectedSeriesId(e.target.value ? Number(e.target.value) : null)}
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
                                <option value="" style={{ background: "#1f2937", color: "#fff" }}>-- Aucune série --</option>
                                {seriesListOptions.map((s) => (
                                    <option key={s.id} value={s.id} style={{ background: "#1f2937", color: "#fff" }}>
                                        {s.name} ({s.category || "Comics"})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                                Numéro de tome / volume
                            </label>
                            <input
                                type="number"
                                min={1}
                                value={selectedVolume}
                                onChange={(e) => setSelectedVolume(Math.max(1, parseInt(e.target.value, 10) || 1))}
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
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                        <div>
                            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                                Nom de la nouvelle série *
                            </label>
                            <input
                                type="text"
                                placeholder="ex: Batman Rebirth, Blackwater..."
                                value={newSeriesName}
                                onChange={(e) => setNewSeriesName(e.target.value)}
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

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                            <div>
                                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                                    Catégorie
                                </label>
                                <select
                                    value={newSeriesCategory}
                                    onChange={(e) => setNewSeriesCategory(Number(e.target.value))}
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
                                    <option value={3} style={{ background: "#1f2937", color: "#fff" }}>Comics</option>
                                    <option value={2} style={{ background: "#1f2937", color: "#fff" }}>Bande dessinée</option>
                                    <option value={4} style={{ background: "#1f2937", color: "#fff" }}>Manga</option>
                                    <option value={5} style={{ background: "#1f2937", color: "#fff" }}>Roman Graphique</option>
                                    <option value={1} style={{ background: "#1f2937", color: "#fff" }}>Roman</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                                    Tome de cet album
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    value={selectedVolume}
                                    onChange={(e) => setSelectedVolume(Math.max(1, parseInt(e.target.value, 10) || 1))}
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
                    </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "24px" }}>
                    {book?.series ? (
                        <button
                            type="button"
                            onClick={handleRemoveFromSeries}
                            style={{
                                padding: "8px 14px",
                                background: "rgba(239, 68, 68, 0.15)",
                                border: "1px solid rgba(239, 68, 68, 0.3)",
                                color: "#ef4444",
                                borderRadius: "8px",
                                cursor: "pointer",
                                fontWeight: 600,
                                fontSize: "0.8rem",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px"
                            }}
                        >
                            <FontAwesomeIcon icon={faTrash} />
                            <span>Retirer de la série</span>
                        </button>
                    ) : <div />}

                    <div style={{ display: "flex", gap: "10px" }}>
                        <button
                            type="button"
                            onClick={() => setSeriesModalOpen(false)}
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
                            type="button"
                            disabled={savingSeries}
                            onClick={handleSaveSeriesAssociation}
                            style={{
                                padding: "8px 18px",
                                background: "var(--accent-primary)",
                                border: "none",
                                color: "#fff",
                                borderRadius: "8px",
                                cursor: "pointer",
                                fontWeight: 600
                            }}
                        >
                            {savingSeries ? "Enregistrement..." : "Valider"}
                        </button>
                    </div>
                </div>
            </Dialog>

            {/* Follow / Unfollow Dialog Modal */}
            <Dialog
                open={Boolean(followModalTarget)}
                onClose={() => setFollowModalTarget(null)}
                PaperProps={{
                    style: {
                        backgroundColor: "var(--bg-surface, #1e1e24)",
                        border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))",
                        borderRadius: "16px",
                        boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6)",
                        width: "100%",
                        maxWidth: "440px",
                        margin: "16px",
                        padding: "24px"
                    }
                }}
            >
                {followModalTarget && (() => {
                    const key = `${followModalTarget.type}_${followModalTarget.id}`;
                    const isFollowed = Boolean(followStates[key]);
                    return (
                        <div className="follow-dialog">
                            <div className="follow-dialog__header">
                                <div className={`follow-dialog__icon-wrapper follow-dialog__icon-wrapper--${followModalTarget.type}`}>
                                    <FontAwesomeIcon icon={getFollowTypeIcon(followModalTarget.type)} />
                                </div>
                                <div className="follow-dialog__header-text">
                                    <span className="follow-dialog__type-badge">
                                        {getFollowTypeLabel(followModalTarget.type)}
                                    </span>
                                    <h3 className="follow-dialog__title">{followModalTarget.name}</h3>
                                    {followModalTarget.roleOrSubtitle && (
                                        <p className="follow-dialog__subtitle">{followModalTarget.roleOrSubtitle}</p>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    className="follow-dialog__close-btn"
                                    onClick={() => setFollowModalTarget(null)}
                                    aria-label="Fermer"
                                >
                                    <FontAwesomeIcon icon={faXmark} />
                                </button>
                            </div>

                            <div className="follow-dialog__body">
                                <p className="follow-dialog__desc">
                                    {isFollowed
                                        ? `Vous êtes abonné aux parutions de cet élément. Vous recevrez les actualités et nouveaux albums associés.`
                                        : `Abonnez-vous à cet élément pour être alerté des futures sorties et facilement le retrouver dans vos suivis.`}
                                </p>

                                <div className="follow-dialog__actions">
                                    <button
                                        type="button"
                                        className={`follow-dialog__btn ${isFollowed ? "follow-dialog__btn--unfollow" : "follow-dialog__btn--follow"}`}
                                        onClick={handleToggleFollow}
                                        disabled={followProcessing}
                                    >
                                        <FontAwesomeIcon icon={isFollowed ? faBellSlash : faBell} />
                                        <span>{isFollowed ? "Ne plus suivre" : "Suivre"}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </Dialog>
            {/* Purchase Modal */}
            <Dialog
                open={purchaseModalOpen}
                onClose={() => setPurchaseModalOpen(false)}
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
                            <FontAwesomeIcon icon={faCartShopping} style={{ color: "#10b981" }} />
                            <h3>Ajouter un achat</h3>
                        </div>
                        <button
                            type="button"
                            className="tx-dialog__header-close"
                            onClick={() => setPurchaseModalOpen(false)}
                            aria-label="Fermer"
                        >
                            <FontAwesomeIcon icon={faXmark} />
                        </button>
                    </div>

                    {book && (
                        <p style={{ margin: "0 0 4px", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                            Renseignez les détails d'achat pour <strong>« {book.title} »</strong> :
                        </p>
                    )}

                    <form className="tx-dialog__form" onSubmit={handleSavePurchase}>
                        <div className="tx-dialog__grid">
                            <div className="tx-dialog__field">
                                <label>
                                    <FontAwesomeIcon icon={faCalendarDays} />
                                    <span>Date d'achat *</span>
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={buyDate}
                                    onChange={(e) => setBuyDate(e.target.value)}
                                />
                            </div>

                            <div className="tx-dialog__field">
                                <label>
                                    <FontAwesomeIcon icon={faTag} />
                                    <span>Prix d'achat (€)</span>
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="ex: 15.00"
                                    value={buyPrice}
                                    onChange={(e) => setBuyPrice(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="tx-dialog__field">
                            <label>
                                <FontAwesomeIcon icon={faStore} />
                                <span>Lieu d'achat</span>
                            </label>
                            <input
                                type="text"
                                placeholder="ex: Librairie Album, Fnac, Vinted, Brocante..."
                                value={buyLocation}
                                onChange={(e) => setBuyLocation(e.target.value)}
                            />
                        </div>

                        <div className="tx-dialog__field">
                            <label>
                                <FontAwesomeIcon icon={faNoteSticky} />
                                <span>Mémo / Remarques</span>
                            </label>
                            <textarea
                                placeholder="ex: Édition spéciale, état neuf, dédicacé..."
                                value={buyMemo}
                                onChange={(e) => setBuyMemo(e.target.value)}
                            />
                        </div>

                        <div className="tx-dialog__actions">
                            <button
                                type="button"
                                className="tx-dialog__btn-cancel"
                                onClick={() => setPurchaseModalOpen(false)}
                            >
                                Annuler
                            </button>
                            <button
                                type="submit"
                                disabled={submittingTx}
                                className="tx-dialog__btn-submit tx-dialog__btn-submit--bought"
                            >
                                <FontAwesomeIcon icon={faCheck} />
                                <span>{submittingTx ? "Enregistrement..." : "Enregistrer l'achat"}</span>
                            </button>
                        </div>
                    </form>
                </div>
            </Dialog>

            {/* Sale Modal */}
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
                            <h3>Renseigner la vente</h3>
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

                    {book && (
                        <p style={{ margin: "0 0 4px", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                            Renseignez les détails de la vente pour <strong>« {book.title} »</strong> :
                        </p>
                    )}

                    <form className="tx-dialog__form" onSubmit={handleSaveSale}>
                        <div className="tx-dialog__grid">
                            <div className="tx-dialog__field">
                                <label>
                                    <FontAwesomeIcon icon={faCalendarDays} />
                                    <span>Date de vente *</span>
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={sellDate}
                                    onChange={(e) => setSellDate(e.target.value)}
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
                                    value={sellPrice}
                                    onChange={(e) => setSellPrice(e.target.value)}
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
                                value={sellLocation}
                                onChange={(e) => setSellLocation(e.target.value)}
                            />
                        </div>

                        <div className="tx-dialog__field">
                            <label>
                                <FontAwesomeIcon icon={faNoteSticky} />
                                <span>Mémo / Remarques (optionnel)</span>
                            </label>
                            <textarea
                                placeholder="ex: Remise en main propre, vendu en lot..."
                                value={sellMemo}
                                onChange={(e) => setSellMemo(e.target.value)}
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
                                disabled={submittingTx}
                                className="tx-dialog__btn-submit tx-dialog__btn-submit--sold"
                            >
                                <FontAwesomeIcon icon={faCheck} />
                                <span>{submittingTx ? "Validation..." : "Valider la vente"}</span>
                            </button>
                        </div>
                    </form>
                </div>
            </Dialog>
        </div>
    );
}

