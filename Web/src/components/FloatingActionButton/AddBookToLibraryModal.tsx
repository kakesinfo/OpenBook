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
    faArrowLeft,
    faSpinner
} from "@fortawesome/free-solid-svg-icons";
import { useSnackbar } from "notistack";
import { useNavigate } from "react-router";
import useSession from "../../hooks/UseSession.tsx";
import useLanguage from "../../hooks/UseLanguage.tsx";
import { useDebounce } from "../../hooks/UseDebounce.tsx";
import BookSummaryDTO from "../../dto/BookSummary.dto.ts";
import { searchBnf, BnfBookResult } from "../../services/bnfService.ts";
import { InitialBookData } from "./CreateMissingBookModal.tsx";

interface Props {
    open: boolean;
    onClose: () => void;
    onOpenCreateBook?: (initialData?: InitialBookData | string) => void;
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
    const [bnfResults, setBnfResults] = useState<BnfBookResult[]>([]);
    const [addingIds, setAddingIds] = useState<Set<string>>(new Set());
    const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
    const [creatingBnfKey, setCreatingBnfKey] = useState<string | null>(null);

    // Listing details step when putting a book up for sale
    const [listingTargetBook, setListingTargetBook] = useState<BookSummaryDTO | null>(null);
    const [listingPrice, setListingPrice] = useState<string>("");
    const [listingUrl, setListingUrl] = useState<string>("");
    const [submittingListing, setSubmittingListing] = useState(false);

    const inputRef = useRef<HTMLInputElement | null>(null);
    const searchRequestIdRef = useRef(0);

    // Reset the modal contents when it opens (adjust state during render instead of in an effect)
    const [prevOpen, setPrevOpen] = useState(open);
    if (open !== prevOpen) {
        setPrevOpen(open);
        if (open) {
            setQuery("");
            setBooks([]);
            setSearching(false);
            setBnfResults([]);
            setAddedIds(new Set());
            setCreatingBnfKey(null);
            setListingTargetBook(null);
            setListingPrice("");
            setListingUrl("");
            setSubmittingListing(false);
        }
    }

    useEffect(() => {
        if (open) {
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        }
    }, [open]);

    useDebounce(query, 280, async (val) => {
        const trimmed = val?.trim();
        const requestId = ++searchRequestIdRef.current;

        if (!trimmed) {
            setBooks([]);
            setSearching(false);
            setBnfResults([]);
            return;
        }

        setSearching(true);
        setBooks([]);
        setBnfResults([]);

        try {
            const [res, bnfs] = await Promise.all([
                session.customFetch(`/books/search?query=${encodeURIComponent(trimmed)}`, {
                    method: "GET"
                }),
                searchBnf(session.customFetch, trimmed)
            ]);

            if (requestId !== searchRequestIdRef.current) return;

            let dbBooks: BookSummaryDTO[] = [];
            if (res.ok) {
                dbBooks = await res.json();
            }

            const dbIsbns = new Set(
                dbBooks
                    .map((b) => b.isbn?.replace(/[^0-9Xx]/g, "").toUpperCase())
                    .filter((isbn): isbn is string => Boolean(isbn))
            );
            const filteredBnfs = bnfs.filter((bnf) => {
                const cleanBnfIsbn = bnf.isbn?.replace(/[^0-9Xx]/g, "").toUpperCase();
                return !cleanBnfIsbn || !dbIsbns.has(cleanBnfIsbn);
            });

            setBooks(dbBooks);
            setBnfResults(filteredBnfs);
        } catch (err) {
            console.error("Search error:", err);
            if (requestId === searchRequestIdRef.current) {
                setBooks([]);
                setBnfResults([]);
            }
        } finally {
            if (requestId === searchRequestIdRef.current) {
                setSearching(false);
            }
        }
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

    const handleCreateMissingFromScratch = () => {
        onClose();
        onOpenCreateBook?.(query.trim());
    };

    const handleDirectCreateFromBnf = async (bnf: BnfBookResult, bnfKey: string) => {
        if (!session.token || creatingBnfKey) return;

        setCreatingBnfKey(bnfKey);
        try {
            const payload = {
                title: bnf.title,
                isbn: bnf.isbn || null,
                price: bnf.price != null && bnf.price >= 0 ? bnf.price : 0,
                seriesName: null,
                volume: bnf.volume != null ? bnf.volume : null,
                editorName: bnf.editorName || null,
                collectionName: bnf.collectionName || null,
                pageCount: bnf.pageCount || 0,
                height: bnf.height || 0,
                length: bnf.length || 0,
                thickness: bnf.thickness || 0,
                releaseDate: bnf.releaseDate || null,
                description: bnf.description || null,
                type: bnf.docType || null,
                coverUrl: bnf.coverUrl || null,
                authors: bnf.authors && bnf.authors.length > 0
                    ? bnf.authors.map((a) => ({
                        firstname: a.firstname,
                        lastname: a.lastname,
                        type: a.type
                    }))
                    : [],
                addToLibrary: true
            };

            const res = await session.customFetch("/books", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const createdBook = await res.json();
                enqueueSnackbar(
                    tr(`"${bnf.title}" has been created and added to your library!`, `« ${bnf.title} » a été créé et ajouté à votre bibliothèque !`),
                    { variant: "success" }
                );
                onClose();
                if (createdBook?.id) {
                    navigate(`/app/book/${createdBook.id}`);
                }
            } else {
                let errMsg = tr("Error creating book", "Erreur lors de la création de l'album");
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
            console.error("Error creating book from BnF:", err);
            enqueueSnackbar(tr("Connection error", "Erreur de connexion"), { variant: "error" });
        } finally {
            setCreatingBnfKey(null);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            slotProps={{ paper: {
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
            }}}
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
                                onChange={(e) => {
                                    const next = e.target.value;
                                    setQuery(next);
                                    if (next.trim()) {
                                        setSearching(true);
                                    } else {
                                        setSearching(false);
                                        setBooks([]);
                                        setBnfResults([]);
                                    }
                                }}
                                placeholder={isSaleMode ? tr("Search for a book to list for sale...", "Rechercher un livre à mettre en vente...") : tr("Search by title, series or ISBN...", "Rechercher par titre, série ou ISBN...")}
                                autoComplete="off"
                            />
                        </div>

                        {searching && (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", color: "var(--text-muted)", padding: "24px 0", fontSize: "0.875rem" }}>
                                <FontAwesomeIcon icon={faSpinner} spin />
                                <span>{tr("Searching...", "Recherche en cours...")}</span>
                            </div>
                        )}

                        {/* Résultats BDD et BNF mélangés et triés par date décroissante */}
                        {!searching && (books.length > 0 || bnfResults.length > 0) && (() => {
                            const parseReleaseTs = (raw?: string | null): number => {
                                if (!raw) return Number.NEGATIVE_INFINITY;
                                const ts = Date.parse(raw);
                                return Number.isNaN(ts) ? Number.NEGATIVE_INFINITY : ts;
                            };

                            type CombinedItem =
                                | { kind: "db"; book: BookSummaryDTO; releaseTs: number }
                                | { kind: "bnf"; bnf: BnfBookResult; bnfKey: string; releaseTs: number };

                            const combined: CombinedItem[] = [
                                ...books.map((book) => ({
                                    kind: "db" as const,
                                    book,
                                    releaseTs: parseReleaseTs(book.releaseDate)
                                })),
                                ...bnfResults.map((bnf, idx) => ({
                                    kind: "bnf" as const,
                                    bnf,
                                    bnfKey: `${bnf.isbn || bnf.title}-${idx}`,
                                    releaseTs: parseReleaseTs(bnf.releaseDate)
                                }))
                            ].sort((a, b) => b.releaseTs - a.releaseTs);

                            return (
                            <ul className="fab-search-results">
                                {combined.map((item) => {
                                    if (item.kind === "db") {
                                        const book = item.book;
                                        const isOwned = book.status === "OWNED" || addedIds.has(book.id);
                                        const isForSale = book.status === "FOR_SALE" || (isSaleMode && addedIds.has(book.id));
                                        const isAdding = addingIds.has(book.id);

                                        return (
                                            <li
                                                key={`db-${book.id}`}
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
                                                        {(book.seriesName || book.editorName) && (
                                                            <span className="fab-search-item__series">
                                                                {[book.seriesName, book.editorName].filter(Boolean).join(" • ")}
                                                            </span>
                                                        )}
                                                        <span className="fab-search-item__title">
                                                            {book.title}
                                                        </span>
                                                        {book.author && (
                                                            <span className="fab-search-item__authors">
                                                                {book.author}
                                                            </span>
                                                        )}
                                                        <div className="fab-search-item__meta">
                                                            {book.volume !== undefined && book.volume !== null && (
                                                                <span>{book.volume > 0 ? `${tr("Volume", "Tome")} ${book.volume}` : "One-shot"}</span>
                                                            )}
                                                            {book.releaseDate && (
                                                                <span>• {new Date(book.releaseDate).getFullYear()}</span>
                                                            )}
                                                            {book.pageCount ? (
                                                                <span>• {book.pageCount} p.</span>
                                                            ) : null}
                                                            {book.price != null && (
                                                                <span>• {book.price} €</span>
                                                            )}
                                                            {book.isbn && (
                                                                <span>• ISBN {book.isbn}</span>
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
                                    }

                                    const bnfResult = item.bnf;
                                    const bnfKey = item.bnfKey;
                                    const isCreatingThis = creatingBnfKey === bnfKey;
                                    return (
                                        <li key={bnfKey} className="fab-search-item fab-search-item--bnf">
                                            <div className="fab-search-item__left" onClick={() => handleDirectCreateFromBnf(bnfResult, bnfKey)}>
                                                <div className="fab-search-item__thumb">
                                                    {bnfResult.coverUrl ? (
                                                        <img
                                                            src={bnfResult.coverUrl}
                                                            alt={bnfResult.title}
                                                            loading="lazy"
                                                            onError={(e) => { (e.target as HTMLElement).style.display = "none"; }}
                                                        />
                                                    ) : (
                                                        <FontAwesomeIcon icon={faBook} />
                                                    )}
                                                </div>

                                                <div className="fab-search-item__info">
                                                    <span className="fab-search-item__series">
                                                        BnF{bnfResult.editorName ? ` • ${bnfResult.editorName}` : ""}
                                                    </span>
                                                    <span className="fab-search-item__title">
                                                        {bnfResult.title}
                                                    </span>
                                                    {bnfResult.authors && bnfResult.authors.length > 0 && (
                                                        <span className="fab-search-item__authors">
                                                            {bnfResult.authors.map((a) => `${a.firstname ? a.firstname + " " : ""}${a.lastname}`).join(", ")}
                                                        </span>
                                                    )}
                                                    <div className="fab-search-item__meta">
                                                        {bnfResult.volume !== null && bnfResult.volume !== undefined && (
                                                            <span>{bnfResult.volume > 0 ? `${tr("Volume", "Tome")} ${bnfResult.volume}` : "One-shot"}</span>
                                                        )}
                                                        {bnfResult.releaseDate && (
                                                            <span>• {bnfResult.releaseDate.substring(0, 4)}</span>
                                                        )}
                                                        {bnfResult.pageCount ? (
                                                            <span>• {bnfResult.pageCount} p.</span>
                                                        ) : null}
                                                        {bnfResult.price != null && (
                                                            <span>• {bnfResult.price} €</span>
                                                        )}
                                                        {bnfResult.isbn && (
                                                            <span>• ISBN {bnfResult.isbn}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="fab-search-item__actions">
                                                <button
                                                    type="button"
                                                    className="fab-btn-add fab-btn-add--bnf"
                                                    disabled={Boolean(creatingBnfKey)}
                                                    onClick={() => handleDirectCreateFromBnf(bnfResult, bnfKey)}
                                                >
                                                    <FontAwesomeIcon icon={isCreatingThis ? faSpinner : faPlus} spin={isCreatingThis} />
                                                    <span>{isCreatingThis ? tr("Creating...", "Création...") : tr("Create & Add", "Créer et ajouter")}</span>
                                                </button>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                            );
                        })()}

                        {/* Aucun livre en BDD ni dans la BNF */}
                        {!searching && query.trim() && books.length === 0 && bnfResults.length === 0 && (
                            <div className="fab-no-results">
                                <p className="fab-no-results__text">
                                    {tr("No books found for", "Aucun livre trouvé pour")} « <strong>{query}</strong> »
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {!listingTargetBook && (
                    <div className="fab-modal__footer">
                        <button
                            type="button"
                            className="fab-no-results__btn"
                            onClick={handleCreateMissingFromScratch}
                        >
                            <FontAwesomeIcon icon={faPenNib} />
                            <span>{tr("Create a missing book", "Créer un livre manquant")}</span>
                        </button>
                    </div>
                )}
            </div>
        </Dialog>
    );
}
