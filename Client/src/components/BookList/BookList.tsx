import { useState } from "react";
import BookSummaryDTO from "../../dto/BookSummary.dto.ts";
import "./BookList.scss";
import { Link } from "react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBook, faHeart, faCheck, faCalendarDays } from "@fortawesome/free-solid-svg-icons";
import useSession from "../../hooks/UseSession.tsx";
import { useSnackbar } from "notistack";
import AsyncCoverImage from "../AsyncCoverImage/AsyncCoverImage.tsx";

function getStatusBadge(book: BookSummaryDTO) {
    if (book.status === "FOR_SALE") {
        return <span className="booklist-card__status-badge is-for-sale">À vendre</span>;
    }
    const rStatus = (book.readingStatus || "").toUpperCase();
    if (rStatus === "READ" || rStatus === "LU") {
        return <span className="booklist-card__status-badge is-read">Lu</span>;
    }
    if (rStatus === "TO_READ" || rStatus === "A_LIRE" || rStatus === "PILE_A_LIRE") {
        return <span className="booklist-card__status-badge is-toread">À lire</span>;
    }
    if (rStatus === "READING" || rStatus === "EN_COURS") {
        return <span className="booklist-card__status-badge is-reading">En cours</span>;
    }
    if (rStatus === "ABANDONED" || rStatus === "ABANDONNE") {
        return <span className="booklist-card__status-badge is-abandoned">Abandonné</span>;
    }
    return null;
}

function formatReleaseDate(dateStr?: string): string | null {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric"
    });
}

interface BookListProps {
    books: BookSummaryDTO[];
    onBookStatusChange?: (bookId: string, newStatus: string | null) => void;
    showReleaseDate?: boolean;
}

export default function BookList({ books, onBookStatusChange, showReleaseDate = false }: BookListProps) {
    const session = useSession();
    const { enqueueSnackbar } = useSnackbar();
    const [statusOverrides, setStatusOverrides] = useState<Record<string, string | null>>({});
    const [loadingIds, setLoadingIds] = useState<Record<string, boolean>>({});

    const getEffectiveStatus = (book: BookSummaryDTO): string | null => {
        if (Object.prototype.hasOwnProperty.call(statusOverrides, book.id)) {
            return statusOverrides[book.id];
        }
        return book.status || null;
    };

    const handleQuickStatusToggle = async (
        e: React.MouseEvent,
        book: BookSummaryDTO,
        targetStatus: "WISHLISTED" | "OWNED"
    ) => {
        e.preventDefault();
        e.stopPropagation();

        if (loadingIds[book.id]) return;

        const currentStatus = getEffectiveStatus(book);
        const isRemoving = currentStatus === targetStatus;
        const nextStatus: string | null = isRemoving ? null : targetStatus;

        setLoadingIds((prev) => ({ ...prev, [book.id]: true }));
        setStatusOverrides((prev) => ({ ...prev, [book.id]: nextStatus }));

        try {
            let response: Response;
            if (isRemoving) {
                response = await session.customFetch(`/user/removeBook/${encodeURIComponent(book.id)}`, {
                    method: "DELETE"
                });
            } else {
                response = await session.customFetch(
                    `/user/addBook/${encodeURIComponent(book.id)}/${encodeURIComponent(targetStatus)}`,
                    { method: "POST" }
                );
            }

            if (response.ok) {
                if (targetStatus === "WISHLISTED") {
                    enqueueSnackbar(
                        isRemoving ? "Retiré de votre liste de souhaits" : "Ajouté à votre liste de souhaits",
                        { variant: isRemoving ? "info" : "success" }
                    );
                } else {
                    enqueueSnackbar(
                        isRemoving ? "Retiré de votre bibliothèque" : "Ajouté à votre bibliothèque",
                        { variant: isRemoving ? "info" : "success" }
                    );
                }
                onBookStatusChange?.(book.id, nextStatus);
            } else {
                setStatusOverrides((prev) => ({ ...prev, [book.id]: currentStatus }));
                enqueueSnackbar("Impossible de mettre à jour le statut de l'album", { variant: "error" });
            }
        } catch (err) {
            console.error("Quick status toggle error:", err);
            setStatusOverrides((prev) => ({ ...prev, [book.id]: currentStatus }));
            enqueueSnackbar("Erreur réseau lors de la mise à jour", { variant: "error" });
        } finally {
            setLoadingIds((prev) => ({ ...prev, [book.id]: false }));
        }
    };

    if (!books || books.length === 0) {
        return (
            <div className="booklist-empty">
                <div className="booklist-empty__icon">
                    <FontAwesomeIcon icon={faBook} />
                </div>
                <h3>Aucun livre disponible</h3>
                <p>Aucun ouvrage ne correspond à votre sélection pour le moment.</p>
            </div>
        );
    }

    return (
        <div className="booklist">
            {books.map((book) => {
                const effectiveStatus = getEffectiveStatus(book);
                const isWishlisted = effectiveStatus === "WISHLISTED";
                const isOwned = effectiveStatus === "OWNED";
                const isBusy = Boolean(loadingIds[book.id]);
                const releaseDateFormatted = showReleaseDate ? formatReleaseDate(book.releaseDate) : null;

                return (
                    <Link to={`/app/book/${book.id}`} className="booklist-card" key={book.id}>
                        <div className="booklist-card__cover-wrapper">
                            <AsyncCoverImage
                                src={book.coverUrl}
                                alt={`Couverture de ${book.title}`}
                                title={book.title}
                            />

                            {/* Status Badge top-left */}
                            {getStatusBadge({ ...book, status: effectiveStatus || "" })}

                            {/* Volume Badge top-right */}
                            <span className="booklist-card__badge">
                                {book.volume > 0 ? `Vol. ${book.volume}` : `Unique`}
                            </span>

                            {/* Hover Quick Actions (Wishlist & Library) */}
                            <div className="booklist-card__quick-actions">
                                <button
                                    type="button"
                                    className={`booklist-card__action-btn booklist-card__action-btn--wishlist ${isWishlisted ? "is-active" : ""}`}
                                    onClick={(e) => handleQuickStatusToggle(e, book, "WISHLISTED")}
                                    disabled={isBusy}
                                    title={
                                        isWishlisted
                                            ? "Retirer de ma liste de souhaits"
                                            : "Ajouter à ma liste de souhaits"
                                    }
                                    aria-label={
                                        isWishlisted
                                            ? "Retirer de ma liste de souhaits"
                                            : "Ajouter à ma liste de souhaits"
                                    }
                                >
                                    <FontAwesomeIcon icon={faHeart} />
                                </button>

                                <button
                                    type="button"
                                    className={`booklist-card__action-btn booklist-card__action-btn--library ${isOwned ? "is-active" : ""}`}
                                    onClick={(e) => handleQuickStatusToggle(e, book, "OWNED")}
                                    disabled={isBusy}
                                    title={
                                        isOwned
                                            ? "Dans ma bibliothèque (cliquer pour retirer)"
                                            : "Ajouter à ma bibliothèque"
                                    }
                                    aria-label={
                                        isOwned
                                            ? "Retirer de ma bibliothèque"
                                            : "Ajouter à ma bibliothèque"
                                    }
                                >
                                    <FontAwesomeIcon icon={isOwned ? faCheck : faBook} />
                                </button>
                            </div>
                        </div>

                        <div className="booklist-card__info">
                            <h3 className="booklist-card__title" title={book.title}>
                                {book.title}
                            </h3>
                            {releaseDateFormatted && (
                                <span className="booklist-card__release-date">
                                    <FontAwesomeIcon icon={faCalendarDays} />
                                    <span>{releaseDateFormatted}</span>
                                </span>
                            )}
                        </div>
                    </Link>
                );
            })}
        </div>
    );
}
