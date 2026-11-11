import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router";
import { WrapperHeader } from "../../components/Wrapper/Wrapper.tsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faNoteSticky,
    faPlus,
    faMagnifyingGlass,
    faPen,
    faTrash,
    faClockRotateLeft
} from "@fortawesome/free-solid-svg-icons";
import { Dialog } from "@mui/material";
import { enqueueSnackbar } from "notistack";
import useSession from "../../hooks/UseSession.tsx";
import useLanguage from "../../hooks/UseLanguage.tsx";
import NoteDTO from "../../dto/Note.dto.ts";
import BookSummaryDTO from "../../dto/BookSummary.dto.ts";
import AsyncCoverImage from "../../components/AsyncCoverImage/AsyncCoverImage.tsx";
import SearchableSelect from "../../components/FloatingActionButton/SearchableSelect.tsx";
import "./NotesPage.scss";

export default function NotesPage() {
    const session = useSession();
    const { tr, locale } = useLanguage();

    const [notes, setNotes] = useState<NoteDTO[]>([]);
    const [allBooks, setAllBooks] = useState<BookSummaryDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    // Create / Edit modal state
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [deleteConfirmNote, setDeleteConfirmNote] = useState<NoteDTO | null>(null);

    // Form inputs
    const [selectedBookId, setSelectedBookId] = useState<string>("");
    const [noteContent, setNoteContent] = useState<string>("");
    const [editingNote, setEditingNote] = useState<NoteDTO | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Fetch notes
    const fetchNotes = async () => {
        try {
            setLoading(true);
            const res = await session.customFetch("/notes", { method: "GET" });
            if (res.ok) {
                const data = await res.json();
                setNotes(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error("Failed to load notes:", err);
            enqueueSnackbar(tr("Failed to load notes", "Impossible de charger les notes"), { variant: "error" });
        } finally {
            setLoading(false);
        }
    };

    // Fetch books to allow selecting when creating notes
    const fetchBooks = async () => {
        try {
            const res = await session.customFetch("/books", { method: "GET" });
            if (res.ok) {
                const data = await res.json();
                setAllBooks(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error("Failed to load books:", err);
        }
    };

    useEffect(() => {
        fetchNotes();
        fetchBooks();
    }, []);

    // Filter books that already have a note
    const booksWithNotes = useMemo(() => {
        return new Set(notes.map((n) => String(n.bookId)));
    }, [notes]);

    // Options for book select when creating a note
    const bookOptions = useMemo(() => {
        return allBooks
            .filter((b) => !booksWithNotes.has(String(b.id)))
            .map((b) => {
                const label = b.seriesName
                    ? `${b.seriesName} ${b.volume != null ? `#${b.volume}` : ""} - ${b.title}`
                    : b.title;
                return { label, value: String(b.id) };
            })
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [allBooks, booksWithNotes]);

    // Selected book preview
    const selectedBook = useMemo(() => {
        if (!selectedBookId) return null;
        return allBooks.find((b) => String(b.id) === selectedBookId) || null;
    }, [selectedBookId, allBooks]);

    // Filtered notes by search query
    const filteredNotes = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return notes;
        return notes.filter((n) => {
            const bookTitle = n.book?.title?.toLowerCase() || "";
            const seriesName = n.book?.seriesName?.toLowerCase() || "";
            const author = n.book?.author?.toLowerCase() || "";
            const content = n.content.toLowerCase();
            return bookTitle.includes(q) || seriesName.includes(q) || author.includes(q) || content.includes(q);
        });
    }, [notes, searchQuery]);

    // Open create modal
    const handleOpenCreate = () => {
        setSelectedBookId(bookOptions.length > 0 ? bookOptions[0].value : "");
        setNoteContent("");
        setIsCreateOpen(true);
    };

    // Open edit modal
    const handleOpenEdit = (note: NoteDTO) => {
        setEditingNote(note);
        setNoteContent(note.content);
        setIsEditOpen(true);
    };

    // Save newly created note
    const handleCreateNote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedBookId || !noteContent.trim()) {
            enqueueSnackbar(tr("Please select a book and enter note content", "Veuillez sélectionner un livre et saisir une note"), { variant: "warning" });
            return;
        }

        try {
            setSubmitting(true);
            const res = await session.customFetch("/notes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    bookId: parseInt(selectedBookId, 10),
                    content: noteContent.trim()
                })
            });

            if (res.ok) {
                enqueueSnackbar(tr("Note created successfully", "Note créée avec succès"), { variant: "success" });
                setIsCreateOpen(false);
                fetchNotes();
            } else if (res.status === 409) {
                enqueueSnackbar(tr("A note already exists for this book", "Une note existe déjà pour ce livre"), { variant: "error" });
            } else {
                enqueueSnackbar(tr("Failed to create note", "Erreur lors de la création de la note"), { variant: "error" });
            }
        } catch (err) {
            console.error("Create note error:", err);
            enqueueSnackbar(tr("An unexpected error occurred", "Une erreur inattendue est survenue"), { variant: "error" });
        } finally {
            setSubmitting(false);
        }
    };

    // Update existing note
    const handleUpdateNote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingNote || !noteContent.trim()) {
            return;
        }

        try {
            setSubmitting(true);
            const res = await session.customFetch(`/notes/${editingNote.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: noteContent.trim()
                })
            });

            if (res.ok) {
                enqueueSnackbar(tr("Note updated successfully", "Note mise à jour avec succès"), { variant: "success" });
                setIsEditOpen(false);
                setEditingNote(null);
                fetchNotes();
            } else {
                enqueueSnackbar(tr("Failed to update note", "Erreur lors de la mise à jour de la note"), { variant: "error" });
            }
        } catch (err) {
            console.error("Update note error:", err);
            enqueueSnackbar(tr("An unexpected error occurred", "Une erreur inattendue est survenue"), { variant: "error" });
        } finally {
            setSubmitting(false);
        }
    };

    // Delete note
    const handleDeleteNote = async () => {
        if (!deleteConfirmNote) return;

        try {
            setSubmitting(true);
            const res = await session.customFetch(`/notes/${deleteConfirmNote.id}`, {
                method: "DELETE"
            });

            if (res.ok || res.status === 204) {
                enqueueSnackbar(tr("Note deleted successfully", "Note supprimée avec succès"), { variant: "success" });
                setDeleteConfirmNote(null);
                fetchNotes();
            } else {
                enqueueSnackbar(tr("Failed to delete note", "Erreur lors de la suppression de la note"), { variant: "error" });
            }
        } catch (err) {
            console.error("Delete note error:", err);
            enqueueSnackbar(tr("An unexpected error occurred", "Une erreur inattendue est survenue"), { variant: "error" });
        } finally {
            setSubmitting(false);
        }
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return "";
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString(locale, {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            });
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="notes-page">
            <WrapperHeader>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                    <h2>
                        {tr("Book Notes", "Notes de lecture")} {notes.length > 0 ? `(${notes.length})` : ""}
                    </h2>
                    <div className="notes-page__header-actions">
                        <button
                            type="button"
                            className="notes-page__add-btn"
                            onClick={handleOpenCreate}
                        >
                            <FontAwesomeIcon icon={faPlus} />
                            <span>{tr("New note", "Nouvelle note")}</span>
                        </button>
                    </div>
                </div>
            </WrapperHeader>

            <div className="notes-page__content">
                {/* Toolbar: Search & count */}
            <div className="notes-page__toolbar">
                <div className="notes-page__search">
                    <FontAwesomeIcon icon={faMagnifyingGlass} style={{ color: "var(--text-muted)" }} />
                    <input
                        type="text"
                        placeholder={tr("Search notes by book, series or content...", "Rechercher par livre, série ou contenu...")}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="notes-page__count">
                    {filteredNotes.length} {filteredNotes.length > 1 ? tr("notes found", "notes trouvées") : tr("note found", "note trouvée")}
                </div>
            </div>

            {/* Content: List or Empty State */}
            {loading ? (
                <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
                    {tr("Loading your notes...", "Chargement de vos notes...")}
                </div>
            ) : filteredNotes.length > 0 ? (
                <div className="notes-page__grid">
                    {filteredNotes.map((note) => (
                        <div key={note.id} className="notes-page__card">
                            <div className="notes-page__card-header">
                                <div className="notes-page__card-cover">
                                    <Link to={`/app/book/${note.bookId}`}>
                                        <AsyncCoverImage
                                            src={note.book?.coverUrl}
                                            alt={note.book?.title || "Livre"}
                                            title={note.book?.title}
                                        />
                                    </Link>
                                </div>
                                <div className="notes-page__card-book-info">
                                    <Link
                                        to={`/app/book/${note.bookId}`}
                                        className="notes-page__card-title"
                                        title={note.book?.title}
                                    >
                                        {note.book?.title || tr("Unknown book", "Livre inconnu")}
                                    </Link>
                                    {note.book?.seriesName && (
                                        <div className="notes-page__card-series">
                                            {note.book.seriesName} {note.book.volume != null ? `(Vol. ${note.book.volume})` : ""}
                                        </div>
                                    )}
                                    {note.book?.author && (
                                        <div className="notes-page__card-series" style={{ fontStyle: "italic" }}>
                                            {note.book.author}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="notes-page__card-body">
                                <div className="notes-page__card-content">
                                    {note.content}
                                </div>
                            </div>

                            <div className="notes-page__card-footer">
                                <div className="notes-page__card-date" title={tr("Last updated", "Dernière modification")}>
                                    <FontAwesomeIcon icon={faClockRotateLeft} />
                                    <span>{formatDate(note.updatedAt || note.createdAt)}</span>
                                </div>
                                <div className="notes-page__card-actions">
                                    <button
                                        type="button"
                                        className="notes-page__icon-btn"
                                        title={tr("Edit note", "Modifier la note")}
                                        onClick={() => handleOpenEdit(note)}
                                    >
                                        <FontAwesomeIcon icon={faPen} />
                                    </button>
                                    <button
                                        type="button"
                                        className="notes-page__icon-btn notes-page__icon-btn--delete"
                                        title={tr("Delete note", "Supprimer la note")}
                                        onClick={() => setDeleteConfirmNote(note)}
                                    >
                                        <FontAwesomeIcon icon={faTrash} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="notes-page__empty">
                    <FontAwesomeIcon icon={faNoteSticky} className="notes-page__empty-icon" />
                    <h3 className="notes-page__empty-title">
                        {searchQuery.trim()
                            ? tr("No notes match your search", "Aucune note ne correspond à votre recherche")
                            : tr("No notes recorded yet", "Aucune note enregistrée")}
                    </h3>
                    <p className="notes-page__empty-text">
                        {searchQuery.trim()
                            ? tr("Try another keyword or clear the search field.", "Essayez avec d'autres termes de recherche.")
                            : tr("Write down your impressions, favorite quotes, or reminders for your books.", "Prenez des notes sur vos lectures, gardez en mémoire vos impressions et citations favorites.")}
                    </p>
                    {!searchQuery.trim() && (
                        <button
                            type="button"
                            className="notes-page__add-btn"
                            onClick={handleOpenCreate}
                        >
                            <FontAwesomeIcon icon={faPlus} />
                            <span>{tr("Create your first note", "Créer votre première note")}</span>
                        </button>
                    )}
                </div>
            )}
            </div>

            {/* Modal: Create Note */}
            <Dialog
                open={isCreateOpen}
                onClose={() => !submitting && setIsCreateOpen(false)}
                PaperProps={{
                    style: {
                        backgroundColor: "transparent",
                        boxShadow: "none",
                        overflow: "visible",
                        maxWidth: "560px",
                        width: "100%",
                        margin: "16px"
                    }
                }}
            >
                <div className="note-modal">
                    <div className="note-modal__header">
                        <h3>
                            <FontAwesomeIcon icon={faPlus} style={{ color: "var(--accent-primary)" }} />
                            <span>{tr("Create a note", "Créer une note")}</span>
                        </h3>
                        <button
                            type="button"
                            className="note-modal__close"
                            onClick={() => setIsCreateOpen(false)}
                            disabled={submitting}
                        >
                            &times;
                        </button>
                    </div>

                    <form onSubmit={handleCreateNote} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        <div className="note-modal__field">
                            <label>{tr("Select a book", "Sélectionner un livre")}</label>
                            {bookOptions.length > 0 ? (
                                <SearchableSelect
                                    value={selectedBookId}
                                    onChange={(val) => setSelectedBookId(val)}
                                    options={bookOptions}
                                    placeholder={tr("Choose a book...", "Choisir un livre...")}
                                    allowEmpty={false}
                                    allowCustom={false}
                                    searchable={true}
                                />
                            ) : (
                                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", padding: "8px 0" }}>
                                    {tr("All your books already have a note!", "Tous vos livres ont déjà une note associée !")}
                                </div>
                            )}
                        </div>

                        {selectedBook && (
                            <div className="note-modal__book-preview">
                                <AsyncCoverImage
                                    src={selectedBook.coverUrl}
                                    alt={selectedBook.title}
                                    title={selectedBook.title}
                                />
                                <div className="note-modal__book-preview-info">
                                    <strong>{selectedBook.title}</strong>
                                    <span>
                                        {selectedBook.seriesName
                                            ? `${selectedBook.seriesName} ${selectedBook.volume != null ? `#${selectedBook.volume}` : ""}`
                                            : selectedBook.author || ""}
                                    </span>
                                </div>
                            </div>
                        )}

                        <div className="note-modal__field">
                            <label>{tr("Note content", "Contenu de la note")}</label>
                            <textarea
                                value={noteContent}
                                onChange={(e) => setNoteContent(e.target.value)}
                                placeholder={tr("Write your thoughts, summary, favorite quotes...", "Écrivez vos impressions, résumés, passages marquants...")}
                                required
                            />
                        </div>

                        <div className="note-modal__actions">
                            <button
                                type="button"
                                className="note-modal__btn note-modal__btn--cancel"
                                onClick={() => setIsCreateOpen(false)}
                                disabled={submitting}
                            >
                                {tr("Cancel", "Annuler")}
                            </button>
                            <button
                                type="submit"
                                className="note-modal__btn note-modal__btn--save"
                                disabled={submitting || !selectedBookId || !noteContent.trim()}
                            >
                                {submitting ? tr("Saving...", "Enregistrement...") : tr("Save note", "Enregistrer")}
                            </button>
                        </div>
                    </form>
                </div>
            </Dialog>

            {/* Modal: Edit Note */}
            <Dialog
                open={isEditOpen}
                onClose={() => !submitting && setIsEditOpen(false)}
                PaperProps={{
                    style: {
                        backgroundColor: "transparent",
                        boxShadow: "none",
                        overflow: "visible",
                        maxWidth: "560px",
                        width: "100%",
                        margin: "16px"
                    }
                }}
            >
                {editingNote && (
                    <div className="note-modal">
                        <div className="note-modal__header">
                            <h3>
                                <FontAwesomeIcon icon={faPen} style={{ color: "var(--accent-primary)" }} />
                                <span>{tr("Edit note", "Modifier la note")}</span>
                            </h3>
                            <button
                                type="button"
                                className="note-modal__close"
                                onClick={() => setIsEditOpen(false)}
                                disabled={submitting}
                            >
                                &times;
                            </button>
                        </div>

                        <form onSubmit={handleUpdateNote} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            {editingNote.book && (
                                <div className="note-modal__book-preview">
                                    <AsyncCoverImage
                                        src={editingNote.book.coverUrl}
                                        alt={editingNote.book.title}
                                        title={editingNote.book.title}
                                    />
                                    <div className="note-modal__book-preview-info">
                                        <strong>{editingNote.book.title}</strong>
                                        <span>
                                            {editingNote.book.seriesName
                                                ? `${editingNote.book.seriesName} ${editingNote.book.volume != null ? `#${editingNote.book.volume}` : ""}`
                                                : editingNote.book.author || ""}
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div className="note-modal__field">
                                <label>{tr("Note content", "Contenu de la note")}</label>
                                <textarea
                                    value={noteContent}
                                    onChange={(e) => setNoteContent(e.target.value)}
                                    placeholder={tr("Write your thoughts...", "Écrivez vos impressions...")}
                                    required
                                />
                            </div>

                            <div className="note-modal__actions">
                                <button
                                    type="button"
                                    className="note-modal__btn note-modal__btn--cancel"
                                    onClick={() => setIsEditOpen(false)}
                                    disabled={submitting}
                                >
                                    {tr("Cancel", "Annuler")}
                                </button>
                                <button
                                    type="submit"
                                    className="note-modal__btn note-modal__btn--save"
                                    disabled={submitting || !noteContent.trim()}
                                >
                                    {submitting ? tr("Saving...", "Enregistrement...") : tr("Save changes", "Enregistrer les modifications")}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </Dialog>

            {/* Modal: Delete Confirmation */}
            <Dialog
                open={Boolean(deleteConfirmNote)}
                onClose={() => !submitting && setDeleteConfirmNote(null)}
                PaperProps={{
                    style: {
                        backgroundColor: "transparent",
                        boxShadow: "none",
                        overflow: "visible",
                        maxWidth: "460px",
                        width: "100%",
                        margin: "16px"
                    }
                }}
            >
                {deleteConfirmNote && (
                    <div className="note-modal">
                        <div className="note-modal__header">
                            <h3>
                                <FontAwesomeIcon icon={faTrash} style={{ color: "#ef4444" }} />
                                <span>{tr("Delete note?", "Supprimer la note ?")}</span>
                            </h3>
                            <button
                                type="button"
                                className="note-modal__close"
                                onClick={() => setDeleteConfirmNote(null)}
                                disabled={submitting}
                            >
                                &times;
                            </button>
                        </div>

                        <p style={{ margin: 0, fontSize: "0.95rem", lineHeight: 1.5, color: "var(--text-secondary)" }}>
                            {tr(
                                `Are you sure you want to delete the note for "${deleteConfirmNote.book?.title || 'this book'}"? This action cannot be undone.`,
                                `Êtes-vous sûr de vouloir supprimer la note pour « ${deleteConfirmNote.book?.title || 'ce livre'} » ? Cette action est irréversible.`
                            )}
                        </p>

                        <div className="note-modal__actions">
                            <button
                                type="button"
                                className="note-modal__btn note-modal__btn--cancel"
                                onClick={() => setDeleteConfirmNote(null)}
                                disabled={submitting}
                            >
                                {tr("Cancel", "Annuler")}
                            </button>
                            <button
                                type="button"
                                className="note-modal__btn note-modal__btn--delete"
                                onClick={handleDeleteNote}
                                disabled={submitting}
                            >
                                {submitting ? tr("Deleting...", "Suppression...") : tr("Delete", "Supprimer")}
                            </button>
                        </div>
                    </div>
                )}
            </Dialog>
        </div>
    );
}
