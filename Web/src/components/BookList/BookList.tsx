import { useState } from "react";
import BookSummaryDTO from "../../dto/BookSummary.dto.ts";
import "./BookList.scss";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBook, faHeart, faCheck, faBookOpen, faPause, faBan, faTag } from "@fortawesome/free-solid-svg-icons";
import useSession from "../../hooks/UseSession.tsx";
import useCommonReadingBookIds from "../../hooks/UseCommonReadingBookIds.ts";
import { isCommonBook } from "../HomeWidgets/readingUtils.ts";
import useLanguage from "../../hooks/UseLanguage.tsx";
import { useSnackbar } from "notistack";
import BookCard from "../BookCard/BookCard.tsx";

function getStatusBadge(book: BookSummaryDTO, tr: (en: string, fr: string) => string) {
    if (book.status === "FOR_SALE") {
        return (
            <span className="book-card__status-badge is-for-sale">
                <FontAwesomeIcon icon={faTag} />
                <span>{tr("For sale", "À vendre")}</span>
            </span>
        );
    }
    const rStatus = (book.readingStatus || "").toUpperCase();
    if (rStatus === "READ" || rStatus === "LU") {
        return (
            <span className="book-card__status-badge is-read">
                <FontAwesomeIcon icon={faCheck} />
                <span>{tr("Read", "Lu")}</span>
            </span>
        );
    }

    if (rStatus === "READING" || rStatus === "EN_COURS") {
        return (
            <span className="book-card__status-badge is-reading">
                <FontAwesomeIcon icon={faBookOpen} />
                <span>{tr("Reading", "En cours")}</span>
            </span>
        );
    }
    if (rStatus === "PAUSED" || rStatus === "EN_PAUSE" || rStatus === "PAUSE") {
        return (
            <span className="book-card__status-badge is-paused">
                <FontAwesomeIcon icon={faPause} />
                <span>{tr("Paused", "En pause")}</span>
            </span>
        );
    }
    if (rStatus === "ABANDONED" || rStatus === "ABANDONNE") {
        return (
            <span className="book-card__status-badge is-abandoned">
                <FontAwesomeIcon icon={faBan} />
                <span>{tr("Abandoned", "Abandonné")}</span>
            </span>
        );
    }
    return null;
}

interface BookListProps {
    books: BookSummaryDTO[];
    onBookStatusChange?: (bookId: string, newStatus: string | null) => void;
    showReleaseDate?: boolean;
    showFinishedDate?: boolean;
}

export default function BookList({
    books,
    onBookStatusChange,
    showReleaseDate = false,
    showFinishedDate = false
}: BookListProps) {
    const session = useSession();
    const commonBookIds = useCommonReadingBookIds();
    const { tr } = useLanguage();
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
                        isRemoving
                            ? tr("Removed from your wishlist", "Retiré de votre liste de souhaits")
                            : tr("Added to your wishlist", "Ajouté à votre liste de souhaits"),
                        { variant: isRemoving ? "info" : "success" }
                    );
                } else {
                    enqueueSnackbar(
                        isRemoving
                            ? tr("Removed from your library", "Retiré de votre bibliothèque")
                            : tr("Added to your library", "Ajouté à votre bibliothèque"),
                        { variant: isRemoving ? "info" : "success" }
                    );
                }
                onBookStatusChange?.(book.id, nextStatus);
            } else {
                setStatusOverrides((prev) => ({ ...prev, [book.id]: currentStatus }));
                enqueueSnackbar(tr("Failed to update book status", "Impossible de mettre à jour le statut de l'album"), { variant: "error" });
            }
        } catch (err) {
            console.error("Quick status toggle error:", err);
            setStatusOverrides((prev) => ({ ...prev, [book.id]: currentStatus }));
            enqueueSnackbar(tr("Network error while updating", "Erreur réseau lors de la mise à jour"), { variant: "error" });
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
                <h3>{tr("No books available", "Aucun livre disponible")}</h3>
                <p>{tr("No books match your selection at the moment.", "Aucun ouvrage ne correspond à votre sélection pour le moment.")}</p>
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
                return (
                    <BookCard
                        key={book.id}
                        book={book}
                        statusBadge={getStatusBadge({ ...book, status: effectiveStatus || "" }, tr)}
                        badgeText={book.volume > 0 ? `Vol. ${book.volume}` : tr("One-shot", "Unique")}
                        isCommon={isCommonBook(commonBookIds, book.id)}
                        showReleaseDate={showReleaseDate}
                        showFinishedDate={showFinishedDate}
                        actions={
                            <>
                                <button
                                    type="button"
                                    className={`book-card__action-btn book-card__action-btn--wishlist ${isWishlisted ? "is-active" : ""}`}
                                    onClick={(e) => handleQuickStatusToggle(e, book, "WISHLISTED")}
                                    disabled={isBusy}
                                    title={
                                        isWishlisted
                                            ? tr("Remove from wishlist", "Retirer de ma liste de souhaits")
                                            : tr("Add to wishlist", "Ajouter à ma liste de souhaits")
                                    }
                                    aria-label={
                                        isWishlisted
                                            ? tr("Remove from wishlist", "Retirer de ma liste de souhaits")
                                            : tr("Add to wishlist", "Ajouter à ma liste de souhaits")
                                    }
                                >
                                    <FontAwesomeIcon icon={faHeart} />
                                </button>

                                <button
                                    type="button"
                                    className={`book-card__action-btn book-card__action-btn--library ${isOwned ? "is-active" : ""}`}
                                    onClick={(e) => handleQuickStatusToggle(e, book, "OWNED")}
                                    disabled={isBusy}
                                    title={
                                        isOwned
                                            ? tr("In my library (click to remove)", "Dans ma bibliothèque (cliquer pour retirer)")
                                            : tr("Add to my library", "Ajouter à ma bibliothèque")
                                    }
                                    aria-label={
                                        isOwned
                                            ? tr("Remove from my library", "Retirer de ma bibliothèque")
                                            : tr("Add to my library", "Ajouter à ma bibliothèque")
                                    }
                                >
                                    <FontAwesomeIcon icon={isOwned ? faCheck : faBook} />
                                </button>
                            </>
                        }
                    />
                );
            })}
        </div>
    );
}
