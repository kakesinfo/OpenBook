import { WrapperHeader } from "../../components/Wrapper/Wrapper.tsx";
import { useState, useEffect, useCallback, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faTrashCanArrowUp,
    faTrashCan,
    faRotate,
    faMagnifyingGlass,
    faBook,
    faCheck,
    faTriangleExclamation,
    faCircleNotch,
    faRotateLeft,
    faBarcode,
    faBuilding,
    faLayerGroup,
    faUserPen
} from "@fortawesome/free-solid-svg-icons";
import { enqueueSnackbar } from "notistack";
import useSession from "../../hooks/UseSession.tsx";
import useLanguage from "../../hooks/UseLanguage.tsx";
import "./AdminDeletedBooksPage.scss";

interface DeletedBook {
    id: number;
    title: string;
    volume: number | null;
    isbn?: string | null;
    coverUrl?: string | null;
    type?: string | null;
    price?: number | null;
    releaseDate?: string | null;
    deletedAt?: string | null;
    seriesName?: string | null;
    editorName?: string | null;
    authors?: string | null;
}

export default function AdminDeletedBooksPage() {
    const session = useSession();
    const { tr, locale } = useLanguage();
    const [books, setBooks] = useState<DeletedBook[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [restoringIds, setRestoringIds] = useState<Record<number, boolean>>({});
    const [bulkRestoring, setBulkRestoring] = useState(false);

    const fetchDeletedBooks = useCallback(async (searchQuery = "") => {
        setLoading(true);
        try {
            const url = searchQuery.trim()
                ? `/admin/books/deleted?search=${encodeURIComponent(searchQuery.trim())}`
                : `/admin/books/deleted`;
            const resp = await session.customFetch(url, { method: "GET" });
            if (resp.ok) {
                const data = await resp.json();
                setBooks(data.books || []);
            } else {
                enqueueSnackbar(tr("Unable to load deleted books.", "Impossible de charger les livres supprimés."), { variant: "error" });
            }
        } catch (err) {
            console.error("Failed to fetch deleted books:", err);
            enqueueSnackbar(tr("Server connection error.", "Erreur de connexion au serveur."), { variant: "error" });
        } finally {
            setLoading(false);
        }
    }, [session, tr]);

    useEffect(() => {
        void (async () => {
            await fetchDeletedBooks();
        })();
    }, [fetchDeletedBooks]);

    // Handle single restore
    const handleRestoreSingle = async (book: DeletedBook) => {
        setRestoringIds(prev => ({ ...prev, [book.id]: true }));
        try {
            const resp = await session.customFetch(`/admin/books/${book.id}/restore`, {
                method: "POST"
            });
            if (resp.ok) {
                enqueueSnackbar(tr(`"${book.title}" has been restored successfully!`, `« ${book.title} » a été restauré avec succès !`), { variant: "success" });
                setBooks(prev => prev.filter(b => b.id !== book.id));
                setSelectedIds(prev => prev.filter(id => id !== book.id));
            } else {
                const err = await resp.json().catch(() => null);
                enqueueSnackbar(err?.message || tr("Error while restoring the book.", "Erreur lors de la restauration du livre."), { variant: "error" });
            }
        } catch (err) {
            console.error("Failed to restore book:", err);
            enqueueSnackbar(tr("Network error while restoring.", "Erreur réseau lors de la restauration."), { variant: "error" });
        } finally {
            setRestoringIds(prev => ({ ...prev, [book.id]: false }));
        }
    };

    // Handle bulk restore
    const handleRestoreBulk = async () => {
        if (selectedIds.length === 0 || bulkRestoring) return;

        setBulkRestoring(true);
        try {
            const resp = await session.customFetch(`/admin/books/restore-bulk`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: selectedIds })
            });

            if (resp.ok) {
                const data = await resp.json();
                enqueueSnackbar(
                    data.message || tr(`${selectedIds.length} books restored successfully!`, `${selectedIds.length} albums restaurés avec succès !`),
                    { variant: "success" }
                );
                setBooks(prev => prev.filter(b => !selectedIds.includes(b.id)));
                setSelectedIds([]);
            } else {
                const err = await resp.json().catch(() => null);
                enqueueSnackbar(err?.message || tr("Error during bulk restore.", "Erreur lors de la restauration groupée."), { variant: "error" });
            }
        } catch (err) {
            console.error("Bulk restore error:", err);
            enqueueSnackbar(tr("Network error while restoring.", "Erreur réseau lors de la restauration."), { variant: "error" });
        } finally {
            setBulkRestoring(false);
        }
    };

    // Handle restore all
    const handleRestoreAll = async () => {
        if (books.length === 0 || bulkRestoring) return;
        if (!window.confirm(tr(
            `Are you sure you want to restore all ${books.length} deleted books?`,
            `Êtes-vous sûr de vouloir restaurer les ${books.length} albums supprimés ?`
        ))) {
            return;
        }

        setBulkRestoring(true);
        try {
            const resp = await session.customFetch(`/admin/books/restore-all`, {
                method: "POST"
            });

            if (resp.ok) {
                const data = await resp.json();
                enqueueSnackbar(data.message || tr("All books have been restored successfully!", "Tous les albums ont été restaurés avec succès !"), { variant: "success" });
                setBooks([]);
                setSelectedIds([]);
            } else {
                const err = await resp.json().catch(() => null);
                enqueueSnackbar(err?.message || tr("Error while restoring all books.", "Erreur lors de la restauration générale."), { variant: "error" });
            }
        } catch (err) {
            console.error("Restore all error:", err);
            enqueueSnackbar(tr("Network error while restoring.", "Erreur réseau lors de la restauration."), { variant: "error" });
        } finally {
            setBulkRestoring(false);
        }
    };

    // Client-side instant filter on top of loaded list
    const filteredBooks = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return books;
        return books.filter(b => {
            const titleMatch = b.title.toLowerCase().includes(q);
            const seriesMatch = b.seriesName ? b.seriesName.toLowerCase().includes(q) : false;
            const editorMatch = b.editorName ? b.editorName.toLowerCase().includes(q) : false;
            const authorMatch = b.authors ? b.authors.toLowerCase().includes(q) : false;
            const isbnMatch = b.isbn ? b.isbn.toLowerCase().includes(q) : false;
            return titleMatch || seriesMatch || editorMatch || authorMatch || isbnMatch;
        });
    }, [books, search]);

    // Selection management
    const handleToggleSelectAll = () => {
        if (selectedIds.length === filteredBooks.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredBooks.map(b => b.id));
        }
    };

    const handleToggleSelectOne = (id: number) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const formatDeletedDate = (dateStr?: string | null) => {
        if (!dateStr) return tr("Unknown date", "Date inconnue");
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString(locale, {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            });
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="admin-deleted-books">
            <WrapperHeader>
                <div className="admin-deleted-books__header-title">
                    <h2>{tr("Deleted Books", "Livres supprimés")}</h2>
                    <p>{tr("Manage and undo deletion of books from the catalog (deleted = false)", "Gestion et annulation de la suppression des albums du catalogue (deleted = false)")}</p>
                </div>
            </WrapperHeader>

            <div className="admin-deleted-books__content">
                {/* Status banner with quick actions */}
                <div className="admin-deleted-books__banner">
                    <div className="admin-deleted-books__banner-info">
                        <div className="admin-deleted-books__banner-icon">
                            <FontAwesomeIcon icon={faTrashCan} />
                        </div>
                        <div className="admin-deleted-books__banner-text">
                            <span className="admin-deleted-books__banner-count">
                                {loading
                                    ? tr("Loading...", "Chargement...")
                                    : tr(
                                        `${books.length} deleted book${books.length > 1 ? "s" : ""}`,
                                        `${books.length} album${books.length > 1 ? "s" : ""} supprimé${books.length > 1 ? "s" : ""}`
                                    )}
                            </span>
                            <span className="admin-deleted-books__banner-desc">
                                {tr(
                                    "These books have been marked as deleted and are hidden from readers.",
                                    "Ces albums ont été marqués comme supprimés et sont invisibles pour les lecteurs."
                                )}
                            </span>
                        </div>
                    </div>

                    <div className="admin-deleted-books__banner-actions">
                        <button
                            type="button"
                            className="admin-deleted-books__btn admin-deleted-books__btn--ghost"
                            onClick={() => fetchDeletedBooks(search)}
                            disabled={loading}
                            title={tr("Refresh list", "Actualiser la liste")}
                        >
                            <FontAwesomeIcon icon={faRotate} spin={loading} />
                            <span>{tr("Refresh", "Actualiser")}</span>
                        </button>

                        {selectedIds.length > 0 && (
                            <button
                                type="button"
                                className="admin-deleted-books__btn admin-deleted-books__btn--primary"
                                onClick={handleRestoreBulk}
                                disabled={bulkRestoring}
                            >
                                <FontAwesomeIcon icon={bulkRestoring ? faCircleNotch : faTrashCanArrowUp} spin={bulkRestoring} />
                                <span>{tr(`Restore selected (${selectedIds.length})`, `Restaurer la sélection (${selectedIds.length})`)}</span>
                            </button>
                        )}

                        {books.length > 0 && (
                            <button
                                type="button"
                                className="admin-deleted-books__btn admin-deleted-books__btn--restore"
                                onClick={handleRestoreAll}
                                disabled={bulkRestoring || loading}
                            >
                                <FontAwesomeIcon icon={bulkRestoring ? faCircleNotch : faCheck} spin={bulkRestoring} />
                                <span>{tr(`Restore all (${books.length})`, `Tout restaurer ({books.length})`.replace("{books.length}", String(books.length)))}</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Search & Filter bar */}
                {books.length > 0 && (
                    <div className="admin-deleted-books__controls">
                        <div className="admin-deleted-books__search">
                            <FontAwesomeIcon icon={faMagnifyingGlass} className="admin-deleted-books__search-icon" />
                            <input
                                type="text"
                                placeholder={tr("Filter by title, series, publisher, author, or ISBN...", "Filtrer par titre, série, éditeur, auteur ou ISBN...")}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {!loading && books.length === 0 && (
                    <div className="admin-deleted-books__empty">
                        <div className="admin-deleted-books__empty-icon">
                            <FontAwesomeIcon icon={faCheck} />
                        </div>
                        <h3>{tr("No deleted books", "Aucun album supprimé")}</h3>
                        <p>
                            {tr(
                                "All books in the library are currently active. When a book is deleted, it will appear here so you can undo its deletion at any time.",
                                "Tous les albums de la bibliothèque sont actuellement actifs. Lorsqu'un album est supprimé, il apparaîtra ici afin que vous puissiez annuler sa suppression à tout moment."
                            )}
                        </p>
                    </div>
                )}

                {/* No Search Results */}
                {!loading && books.length > 0 && filteredBooks.length === 0 && (
                    <div className="admin-deleted-books__empty">
                        <div className="admin-deleted-books__empty-icon" style={{ background: "var(--accent-primary-light)", color: "var(--accent-primary)", borderColor: "var(--border-focus)" }}>
                            <FontAwesomeIcon icon={faTriangleExclamation} />
                        </div>
                        <h3>{tr("No results found", "Aucun résultat trouvé")}</h3>
                        <p>{tr(`No deleted book matches your search "${search}".`, `Aucun album supprimé ne correspond à votre recherche « ${search} ».`)}</p>
                    </div>
                )}

                {/* Table of deleted books */}
                {filteredBooks.length > 0 && (
                    <div className="admin-deleted-books__table-card">
                        <div className="admin-deleted-books__table-wrapper">
                            <table className="admin-deleted-books__table">
                                <thead>
                                    <tr>
                                        <th>
                                            <input
                                                type="checkbox"
                                                className="admin-deleted-books__checkbox"
                                                checked={selectedIds.length > 0 && selectedIds.length === filteredBooks.length}
                                                onChange={handleToggleSelectAll}
                                                title={tr("Select all", "Tout sélectionner")}
                                            />
                                        </th>
                                        <th style={{ width: "56px" }}>{tr("Cover", "Couverture")}</th>
                                        <th>{tr("Book & Metadata", "Album & Métadonnées")}</th>
                                        <th>{tr("Publisher & Series", "Éditeur & Série")}</th>
                                        <th>{tr("Deletion Date", "Date de suppression")}</th>
                                        <th style={{ textAlign: "right" }}>{tr("Action", "Action")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredBooks.map((book) => {
                                        const isRestoring = restoringIds[book.id];
                                        const isSelected = selectedIds.includes(book.id);

                                        return (
                                            <tr key={book.id}>
                                                <td>
                                                    <input
                                                        type="checkbox"
                                                        className="admin-deleted-books__checkbox"
                                                        checked={isSelected}
                                                        onChange={() => handleToggleSelectOne(book.id)}
                                                    />
                                                </td>
                                                <td>
                                                    {book.coverUrl ? (
                                                        <img
                                                            src={book.coverUrl}
                                                            alt={book.title}
                                                            className="admin-deleted-books__table-cover"
                                                            loading="lazy"
                                                        />
                                                    ) : (
                                                        <div className="admin-deleted-books__table-cover-placeholder">
                                                            <FontAwesomeIcon icon={faBook} />
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    <div className="admin-deleted-books__table-title-group">
                                                        <div className="admin-deleted-books__table-title">
                                                            <span>{book.title}</span>
                                                            {book.volume !== null && book.volume !== undefined && (
                                                                <span className="admin-deleted-books__table-volume-badge">
                                                                    {tr(`Vol. ${book.volume}`, `Tome ${book.volume}`)}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="admin-deleted-books__table-meta">
                                                            {book.authors && (
                                                                <span className="admin-deleted-books__table-tag">
                                                                    <FontAwesomeIcon icon={faUserPen} style={{ fontSize: "0.7rem" }} />
                                                                    <span>{book.authors}</span>
                                                                </span>
                                                            )}
                                                            {book.isbn && (
                                                                <span className="admin-deleted-books__table-tag">
                                                                    <FontAwesomeIcon icon={faBarcode} style={{ fontSize: "0.7rem" }} />
                                                                    <span>{book.isbn}</span>
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="admin-deleted-books__table-title-group">
                                                        {book.seriesName && (
                                                            <span className="admin-deleted-books__table-tag" style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                                                                <FontAwesomeIcon icon={faLayerGroup} style={{ color: "#3b82f6", fontSize: "0.75rem" }} />
                                                                <span>{book.seriesName}</span>
                                                            </span>
                                                        )}
                                                        {book.editorName && (
                                                            <span className="admin-deleted-books__table-tag">
                                                                <FontAwesomeIcon icon={faBuilding} style={{ fontSize: "0.7rem" }} />
                                                                <span>{book.editorName}</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className="admin-deleted-books__table-date">
                                                        {formatDeletedDate(book.deletedAt)}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: "right" }}>
                                                    <button
                                                        type="button"
                                                        className="admin-deleted-books__btn admin-deleted-books__btn--restore"
                                                        onClick={() => handleRestoreSingle(book)}
                                                        disabled={isRestoring || bulkRestoring}
                                                        title={tr("Undo deletion and reactivate this book", "Annuler la suppression et réactiver cet album")}
                                                    >
                                                        <FontAwesomeIcon
                                                            icon={isRestoring ? faCircleNotch : faRotateLeft}
                                                            spin={isRestoring}
                                                        />
                                                        <span>{isRestoring ? tr("Restoring...", "Restauration...") : tr("Restore", "Restaurer")}</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
