import { useState, useRef, useEffect } from "react";
import { Dialog } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faBookBookmark,
    faXmark,
    faMagnifyingGlass,
    faPlus,
    faCheck,
    faBook,
    faCalendarDays
} from "@fortawesome/free-solid-svg-icons";
import { useSnackbar } from "notistack";
import { useNavigate } from "react-router";
import useSession from "../../hooks/UseSession.tsx";
import { useDebounce } from "../../hooks/UseDebounce.tsx";
import BookSummaryDTO from "../../dto/BookSummary.dto.ts";

interface Props {
    open: boolean;
    onClose: () => void;
    onOpenCreateBook?: () => void;
}

export default function AddBookToLibraryModal({ open, onClose }: Props) {
    const session = useSession();
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();

    const [query, setQuery] = useState("");
    const [books, setBooks] = useState<BookSummaryDTO[]>([]);
    const [searching, setSearching] = useState(false);
    const [addingIds, setAddingIds] = useState<Set<number>>(new Set());
    const [addedIds, setAddedIds] = useState<Set<number>>(new Set());

    const inputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        if (open) {
            setQuery("");
            setBooks([]);
            setSearching(false);
            setAddedIds(new Set());
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
                enqueueSnackbar(`« ${book.title} » a été ajouté à votre bibliothèque !`, { variant: "success" });
            } else {
                enqueueSnackbar("Erreur lors de l'ajout à la bibliothèque", { variant: "error" });
            }
        } catch (err) {
            console.error("Error adding book to library:", err);
            enqueueSnackbar("Erreur de connexion", { variant: "error" });
        } finally {
            setAddingIds((prev) => {
                const next = new Set(prev);
                next.delete(book.id);
                return next;
            });
        }
    };

    const handleBookClick = (bookId: number) => {
        onClose();
        navigate(`/app/book/${bookId}`);
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            PaperProps={{
                style: {
                    backgroundColor: "var(--bg-surface, #131926)",
                    border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))",
                    borderRadius: "16px",
                    maxWidth: "560px",
                    width: "100%",
                    padding: "20px 24px",
                    margin: "16px"
                }
            }}
        >
            <div className="fab-modal">
                <div className="fab-modal__header">
                    <div className="fab-modal__header-title">
                        <FontAwesomeIcon icon={faBookBookmark} />
                        <h3>Ajouter un livre à ma bibliothèque</h3>
                    </div>
                    <button
                        type="button"
                        className="fab-modal__header-close"
                        onClick={onClose}
                        aria-label="Fermer"
                    >
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>

                <div className="fab-modal__body">
                    <div className="fab-form__field">
                        <label>
                            <FontAwesomeIcon icon={faMagnifyingGlass} />
                            <span>Rechercher l'album par titre, série ou ISBN</span>
                        </label>
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="ex: Batman, Blackwater, Thorgal..."
                            autoComplete="off"
                        />
                    </div>

                    {searching && (
                        <p style={{ textAlign: "center", color: "var(--text-muted)", padding: "14px 0", fontSize: "0.875rem" }}>
                            Recherche en cours...
                        </p>
                    )}

                    {!searching && query.trim() && books.length === 0 && (
                        <div style={{ textAlign: "center", padding: "16px 0", color: "var(--text-muted)", fontSize: "0.875rem" }}>
                            Aucun livre trouvé pour « {query} »
                        </div>
                    )}

                    {books.length > 0 && (
                        <ul className="fab-search-results">
                            {books.map((book) => {
                                const isOwned = book.status === "OWNED" || addedIds.has(book.id);
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
                                                        <span>{book.volume > 0 ? `Tome ${book.volume}` : "One-shot"}</span>
                                                    )}
                                                    {book.releaseDate && (
                                                        <span>• {new Date(book.releaseDate).getFullYear()}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="fab-search-item__actions">
                                            {isOwned ? (
                                                <span className="fab-badge-owned">
                                                    <FontAwesomeIcon icon={faCheck} />
                                                    <span>Dans votre bibliothèque</span>
                                                </span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="fab-btn-add"
                                                    disabled={isAdding}
                                                    onClick={(e) => handleAddBook(book, e)}
                                                >
                                                    <FontAwesomeIcon icon={isAdding ? faCheck : faPlus} />
                                                    <span>{isAdding ? "Ajout..." : "Ajouter"}</span>
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </div>
        </Dialog>
    );
}
