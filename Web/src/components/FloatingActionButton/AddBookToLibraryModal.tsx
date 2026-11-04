import { useState, useRef, useEffect } from "react";
import { Dialog } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faXmark,
    faMagnifyingGlass,
    faPlus,
    faCheck,
    faBook,
    faPenNib,
    faTag,
    faCoins,
    faLink,
    faArrowLeft
} from "@fortawesome/free-solid-svg-icons";
import { useSnackbar } from "notistack";
import { useNavigate } from "react-router";
import useSession from "../../hooks/UseSession.tsx";
import useLanguage from "../../hooks/UseLanguage.tsx";
import { useDebounce } from "../../hooks/UseDebounce.tsx";
import BookSummaryDTO from "../../dto/BookSummary.dto.ts";

interface Props {
    open: boolean;
    onClose: () => void;
    onOpenCreateBook?: (initialTitle?: string) => void;
    mode?: "library" | "sale";
}

export default function AddBookToLibraryModal({ open, onClose, onOpenCreateBook, mode = "library" }: Props) {
    const session = useSession();
    const { tr } = useLanguage();
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();

    const isSaleMode = mode === "sale";

    const [query, setQuery] = useState("");
    const [books, setBooks] = useState<BookSummaryDTO[]>([]);
    const [searching, setSearching] = useState(false);
    const [addingIds, setAddingIds] = useState<Set<string>>(new Set());
    const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

    // Listing details step when putting a book up for sale
    const [listingTargetBook, setListingTargetBook] = useState<BookSummaryDTO | null>(null);
    const [listingPrice, setListingPrice] = useState<string>("");
    const [listingUrl, setListingUrl] = useState<string>("");
    const [submittingListing, setSubmittingListing] = useState(false);

    const inputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        if (open) {
            setQuery("");
            setBooks([]);
            setSearching(false);
            setAddedIds(new Set());
            setListingTargetBook(null);
            setListingPrice("");
            setListingUrl("");
            setSubmittingListing(false);
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        }
    }, [open]);

    useDebounce(query, 280, (val) => {
        const trimmed = val?.trim();
        if (!trimmed) {
            setBooks([]);
            setSearching(false);
            return;
        }

        setSearching(true);
        session.customFetch(`/books/search?query=${encodeURIComponent(trimmed)}`, {
            method: "GET"
        })
            .then(async (res) => {
                if (res.ok) {
                    const data: BookSummaryDTO[] = await res.json();
                    setBooks(data);
                }
            })
            .catch((err) => {
                console.error("Search error:", err);
            })
            .finally(() => {
                setSearching(false);
            });
    });

    const handleAddBook = async (book: BookSummaryDTO, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!session.token || addingIds.has(book.id)) return;

        setAddingIds((prev) => new Set(prev).add(book.id));
        try {
            const res = await session.customFetch(`/user/addBook/${encodeURIComponent(book.id)}/OWNED`, {
                method: "POST"
            });

            if (res.ok) {
                setAddedIds((prev) => new Set(prev).add(book.id));
                enqueueSnackbar(tr(`"${book.title}" has been added to your library!`, `« ${book.title} » a été ajouté à votre bibliothèque !`), { variant: "success" });
            } else {
                enqueueSnackbar(tr("Error adding book to library", "Erreur lors de l'ajout à la bibliothèque"), { variant: "error" });
            }
        } catch (err) {
            console.error("Error adding book to library:", err);
            enqueueSnackbar(tr("Connection error", "Erreur de connexion"), { variant: "error" });
        } finally {
            setAddingIds((prev) => {
                const next = new Set(prev);
                next.delete(book.id);
                return next;
            });
        }
    };

    const handleOpenListingStep = (book: BookSummaryDTO, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!session.token || addingIds.has(book.id)) return;

        setListingTargetBook(book);
        setListingPrice(book.price ? String(book.price) : "");
        setListingUrl(book.listingUrl || "");
    };

    const handleSaveListing = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!listingTargetBook || !session.token || submittingListing) return;

        setSubmittingListing(true);
        try {
            const res = await session.customFetch(`/user/addBook/${encodeURIComponent(listingTargetBook.id)}/FOR_SALE`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    price: listingPrice.trim() ? parseFloat(listingPrice) : null,
                    listingUrl: listingUrl.trim() || null
                })
            });

            if (res.ok) {
                setAddedIds((prev) => new Set(prev).add(listingTargetBook.id));
                setBooks((prev) =>
                    prev.map((b) =>
                        b.id === listingTargetBook.id
                            ? { ...b, status: "FOR_SALE", price: parseFloat(listingPrice) || b.price, listingUrl: listingUrl.trim() || null }
                            : b
                    )
                );
                enqueueSnackbar(tr(`"${listingTargetBook.title}" has been listed for sale!`, `« ${listingTargetBook.title} » a été mis en vente !`), { variant: "success" });
                window.dispatchEvent(new CustomEvent("sales-updated"));
                setListingTargetBook(null);
            } else {
                let errMsg = tr("Error listing book for sale", "Erreur lors de la mise en vente");
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
            console.error("Error listing book for sale:", err);
            enqueueSnackbar(tr("Connection error", "Erreur de connexion"), { variant: "error" });
        } finally {
            setSubmittingListing(false);
        }
    };

    const handleBookClick = (bookId: string | number) => {
        onClose();
        navigate(`/app/book/${bookId}`);
    };

    const handleCreateMissing = () => {
        onClose();
        onOpenCreateBook?.(query.trim());
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            PaperProps={{
                style: {
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                    boxShadow: "var(--shadow-lg)",
                    color: "var(--text-primary)",
                    borderRadius: "16px",
                    maxWidth: "560px",
                    width: "100%",
                    padding: "20px 24px",
                    margin: "16px"
                }
            }}
        >
            <div className={`fab-modal ${isSaleMode ? "fab-modal--sale" : ""}`}>
                <div className="fab-modal__header">
                    <div className="fab-modal__header-title">
                        <FontAwesomeIcon icon={isSaleMode ? faTag : faMagnifyingGlass} />
                        <h3>
                            {listingTargetBook
                                ? tr("List for sale", "Mettre en vente")
                                : isSaleMode
                                    ? tr("Search for a book to list for sale", "Chercher un livre à mettre en vente")
                                    : tr("Add a book to my library", "Ajouter un livre à ma bibliothèque")}
                        </h3>
                    </div>
                    <button
                        type="button"
                        className="fab-modal__header-close"
                        onClick={onClose}
                        aria-label={tr("Close", "Fermer")}
                    >
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>

                {listingTargetBook ? (
                    <form className="fab-form" onSubmit={handleSaveListing}>
                        <div className="fab-search-item" style={{ cursor: "default" }}>
                            <div className="fab-search-item__left" style={{ cursor: "default" }}>
                                <div className="fab-search-item__thumb">
                                    {listingTargetBook.coverUrl ? (
                                        <img src={listingTargetBook.coverUrl} alt={listingTargetBook.title} loading="lazy" />
                                    ) : (
                                        <FontAwesomeIcon icon={faBook} />
                                    )}
                                </div>
                                <div className="fab-search-item__info">
                                    {listingTargetBook.seriesName && (
                                        <span className="fab-search-item__series">
                                            {listingTargetBook.seriesName}
                                        </span>
                                    )}
                                    <span className="fab-search-item__title">
                                        {listingTargetBook.title}
                                    </span>
                                    <div className="fab-search-item__meta">
                                        {listingTargetBook.volume !== undefined && listingTargetBook.volume !== null && (
                                            <span>{listingTargetBook.volume > 0 ? `${tr("Volume", "Tome")} ${listingTargetBook.volume}` : "One-shot"}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="fab-form__field">
                            <label>
                                <FontAwesomeIcon icon={faCoins} />
                                <span>{tr("Listing price (€)", "Prix de mise en vente (€)")}</span>
                                <span style={{ fontSize: "0.75rem", fontWeight: 400, color: "var(--text-muted)" }}>{tr("(optional)", "(optionnel)")}</span>
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder={tr("e.g., 12.00", "ex: 12.00")}
                                value={listingPrice}
                                onChange={(e) => setListingPrice(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <div className="fab-form__field">
                            <label>
                                <FontAwesomeIcon icon={faLink} />
                                <span>{tr("Listing URL", "Lien de l'annonce")}</span>
                                <span style={{ fontSize: "0.75rem", fontWeight: 400, color: "var(--text-muted)" }}>{tr("(optional)", "(optionnel)")}</span>
                            </label>
                            <input
                                type="url"
                                placeholder="https://..."
                                value={listingUrl}
                                onChange={(e) => setListingUrl(e.target.value)}
                            />
                        </div>

                        <div className="fab-modal__footer">
                            <button
                                type="button"
                                className="fab-btn-cancel"
                                disabled={submittingListing}
                                onClick={() => setListingTargetBook(null)}
                                style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
                            >
                                <FontAwesomeIcon icon={faArrowLeft} />
                                <span>{tr("Back", "Retour")}</span>
                            </button>
                            <button
                                type="submit"
                                className="fab-btn-submit"
                                disabled={submittingListing}
                            >
                                <FontAwesomeIcon icon={faCheck} />
                                <span>{submittingListing ? tr("Saving...", "Enregistrement...") : tr("List for sale", "Mettre en vente")}</span>
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="fab-modal__body">
                        <div className="fab-form__field">
                            <input
                                ref={inputRef}
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={isSaleMode ? tr("Search for a book to list for sale...", "Rechercher un livre à mettre en vente...") : tr("Search by title, series or ISBN...", "Rechercher par titre, série ou ISBN...")}
                                autoComplete="off"
                            />
                        </div>

                        {searching && (
                            <p style={{ textAlign: "center", color: "var(--text-muted)", padding: "14px 0", fontSize: "0.875rem" }}>
                                {tr("Searching...", "Recherche en cours...")}
                            </p>
                        )}

                        {!searching && query.trim() && books.length === 0 && (
                            <div className="fab-no-results">
                                <p className="fab-no-results__text">
                                    {tr("No books found for", "Aucun livre trouvé pour")} « <strong>{query}</strong> »
                                </p>
                                <button
                                    type="button"
                                    className="fab-no-results__btn"
                                    onClick={handleCreateMissing}
                                >
                                    <FontAwesomeIcon icon={faPenNib} />
                                    <span>{tr("Create a missing book", "Créer un livre manquant")}</span>
                                </button>
                            </div>
                        )}

                        {books.length > 0 && (
                            <ul className="fab-search-results">
                                {books.map((book) => {
                                    const isOwned = book.status === "OWNED" || addedIds.has(book.id);
                                    const isForSale = book.status === "FOR_SALE" || (isSaleMode && addedIds.has(book.id));
                                    const isAdding = addingIds.has(book.id);

                                    return (
                                        <li
                                            key={book.id}
                                            className="fab-search-item"
                                            onClick={() => handleBookClick(book.id)}
                                        >
                                            <div className="fab-search-item__left">
                                                <div className="fab-search-item__thumb">
                                                    {book.coverUrl ? (
                                                        <img src={book.coverUrl} alt={book.title} loading="lazy" />
                                                    ) : (
                                                        <FontAwesomeIcon icon={faBook} />
                                                    )}
                                                </div>
                                                <div className="fab-search-item__info">
                                                    {book.seriesName && (
                                                        <span className="fab-search-item__series">
                                                            {book.seriesName}
                                                        </span>
                                                    )}
                                                    <span className="fab-search-item__title">
                                                        {book.title}
                                                    </span>
                                                    <div className="fab-search-item__meta">
                                                        {book.volume !== undefined && book.volume !== null && (
                                                            <span>{book.volume > 0 ? `${tr("Volume", "Tome")} ${book.volume}` : "One-shot"}</span>
                                                        )}
                                                        {book.releaseDate && (
                                                            <span>• {new Date(book.releaseDate).getFullYear()}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="fab-search-item__actions">
                                                {isSaleMode ? (
                                                    isForSale ? (
                                                        <span className="fab-badge-owned">
                                                            <FontAwesomeIcon icon={faCheck} />
                                                            <span>{tr("For sale", "En vente")}</span>
                                                        </span>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            className="fab-btn-add"
                                                            disabled={isAdding}
                                                            onClick={(e) => handleOpenListingStep(book, e)}
                                                        >
                                                            <FontAwesomeIcon icon={faTag} />
                                                            <span>{isAdding ? tr("Checking...", "Vérification...") : tr("List for sale", "Mettre en vente")}</span>
                                                        </button>
                                                    )
                                                ) : isOwned ? (
                                                    <span className="fab-badge-owned">
                                                        <FontAwesomeIcon icon={faCheck} />
                                                        <span>{tr("In your library", "Dans votre bibliothèque")}</span>
                                                    </span>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        className="fab-btn-add"
                                                        disabled={isAdding}
                                                        onClick={(e) => handleAddBook(book, e)}
                                                    >
                                                        <FontAwesomeIcon icon={isAdding ? faCheck : faPlus} />
                                                        <span>{isAdding ? tr("Adding...", "Ajout...") : tr("Add", "Ajouter")}</span>
                                                    </button>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                )}
            </div>
        </Dialog>
    );
}
