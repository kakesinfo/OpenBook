import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router";
import { WrapperHeader } from "../../components/Wrapper/Wrapper.tsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faSpellCheck,
    faPlus,
    faMagnifyingGlass,
    faPen,
    faTrash,
    faBook,
    faXmark
} from "@fortawesome/free-solid-svg-icons";
import { Dialog } from "@mui/material";
import { enqueueSnackbar } from "notistack";
import useSession from "../../hooks/UseSession.tsx";
import useLanguage from "../../hooks/UseLanguage.tsx";
import WordDTO from "../../dto/Word.dto.ts";
import BookSummaryDTO from "../../dto/BookSummary.dto.ts";
import SearchableSelect from "../../components/FloatingActionButton/SearchableSelect.tsx";
import "./GlossaryPage.scss";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function GlossaryPage() {
    const session = useSession();
    const { tr } = useLanguage();

    const [words, setWords] = useState<WordDTO[]>([]);
    const [allBooks, setAllBooks] = useState<BookSummaryDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedLetter, setSelectedLetter] = useState<string>("ALL");
    const [bookFilterId, setBookFilterId] = useState<string>("");

    // Create / Edit modal state
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [deleteConfirmWord, setDeleteConfirmWord] = useState<WordDTO | null>(null);

    // Form inputs
    const [wordInput, setWordInput] = useState<string>("");
    const [definitionInput, setDefinitionInput] = useState<string>("");
    const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
    const [bookToAddId, setBookToAddId] = useState<string>("");
    const [editingWord, setEditingWord] = useState<WordDTO | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Fetch words
    const fetchWords = async () => {
        try {
            setLoading(true);
            const res = await session.customFetch("/words", { method: "GET" });
            if (res.ok) {
                const data = await res.json();
                setWords(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error("Failed to load glossary words:", err);
            enqueueSnackbar(tr("Failed to load glossary", "Impossible de charger le glossaire"), { variant: "error" });
        } finally {
            setLoading(false);
        }
    };

    // Fetch all books for associations
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
        fetchWords();
        fetchBooks();
    }, []);

    // Filter books for the toolbar filter
    const bookFilterOptions = useMemo(() => {
        return [
            { label: tr("All books", "Tous les livres"), value: "" },
            ...allBooks.map((b) => ({
                label: b.seriesName ? `${b.seriesName} - ${b.title}` : b.title,
                value: String(b.id)
            }))
        ];
    }, [allBooks, tr]);

    // Available books to add in the modal (excluding already selected)
    const booksAvailableToAdd = useMemo(() => {
        const selectedSet = new Set(selectedBookIds);
        return allBooks
            .filter((b) => !selectedSet.has(String(b.id)))
            .map((b) => ({
                label: b.seriesName ? `${b.seriesName} ${b.volume != null ? `#${b.volume}` : ""} - ${b.title}` : b.title,
                value: String(b.id)
            }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [allBooks, selectedBookIds]);

    // Set of starting letters present in current words
    const activeLetters = useMemo(() => {
        const set = new Set<string>();
        words.forEach((w) => {
            if (w.word && w.word.length > 0) {
                const firstChar = w.word.trim().charAt(0).toUpperCase();
                set.add(firstChar);
            }
        });
        return set;
    }, [words]);

    // Filtered words
    const filteredWords = useMemo(() => {
        return words.filter((w) => {
            // Search query filter
            const q = searchQuery.trim().toLowerCase();
            if (q) {
                const matchesWord = w.word.toLowerCase().includes(q);
                const matchesDef = w.definition.toLowerCase().includes(q);
                const matchesBook = w.books?.some((b) => b.title.toLowerCase().includes(q) || b.seriesName?.toLowerCase().includes(q));
                if (!matchesWord && !matchesDef && !matchesBook) return false;
            }

            // Letter filter
            if (selectedLetter !== "ALL") {
                const firstChar = w.word.trim().charAt(0).toUpperCase();
                if (firstChar !== selectedLetter) return false;
            }

            // Book filter
            if (bookFilterId) {
                const isLinked = w.books?.some((b) => String(b.id) === bookFilterId);
                if (!isLinked) return false;
            }

            return true;
        });
    }, [words, searchQuery, selectedLetter, bookFilterId]);

    // Group filtered words by letter
    const groupedWords = useMemo(() => {
        const groups: Record<string, WordDTO[]> = {};
        filteredWords.forEach((w) => {
            const letter = (w.word.trim().charAt(0) || "#").toUpperCase();
            if (!groups[letter]) {
                groups[letter] = [];
            }
            groups[letter].push(w);
        });
        return groups;
    }, [filteredWords]);

    const sortedLetters = useMemo(() => {
        return Object.keys(groupedWords).sort((a, b) => a.localeCompare(b));
    }, [groupedWords]);

    // Open create modal
    const handleOpenCreate = () => {
        setWordInput("");
        setDefinitionInput("");
        setSelectedBookIds([]);
        setBookToAddId("");
        setIsCreateOpen(true);
    };

    // Open edit modal
    const handleOpenEdit = (word: WordDTO) => {
        setEditingWord(word);
        setWordInput(word.word);
        setDefinitionInput(word.definition);
        setSelectedBookIds(word.books ? word.books.map((b) => String(b.id)) : []);
        setBookToAddId("");
        setIsEditOpen(true);
    };

    // Add book to selected list
    const handleAddBookToSelection = (bookIdStr: string) => {
        if (!bookIdStr) return;
        if (!selectedBookIds.includes(bookIdStr)) {
            setSelectedBookIds([...selectedBookIds, bookIdStr]);
        }
        setBookToAddId("");
    };

    // Remove book from selected list
    const handleRemoveBookFromSelection = (bookIdStr: string) => {
        setSelectedBookIds(selectedBookIds.filter((id) => id !== bookIdStr));
    };

    // Create Word
    const handleCreateWord = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!wordInput.trim() || !definitionInput.trim()) {
            enqueueSnackbar(tr("Please provide both a word and its definition", "Veuillez renseigner le mot et sa définition"), { variant: "warning" });
            return;
        }

        try {
            setSubmitting(true);
            const res = await session.customFetch("/words", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    word: wordInput.trim(),
                    definition: definitionInput.trim(),
                    bookIds: selectedBookIds.map((id) => parseInt(id, 10))
                })
            });

            if (res.ok) {
                enqueueSnackbar(tr("Word added to glossary", "Mot ajouté au glossaire avec succès"), { variant: "success" });
                setIsCreateOpen(false);
                fetchWords();
            } else if (res.status === 409) {
                enqueueSnackbar(tr("This word already exists in the glossary", "Ce mot existe déjà dans le glossaire"), { variant: "error" });
            } else {
                enqueueSnackbar(tr("Failed to add word", "Erreur lors de l'ajout du mot"), { variant: "error" });
            }
        } catch (err) {
            console.error("Create word error:", err);
            enqueueSnackbar(tr("An unexpected error occurred", "Une erreur inattendue est survenue"), { variant: "error" });
        } finally {
            setSubmitting(false);
        }
    };

    // Update Word
    const handleUpdateWord = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingWord || !wordInput.trim() || !definitionInput.trim()) {
            return;
        }

        try {
            setSubmitting(true);
            const res = await session.customFetch(`/words/${editingWord.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    word: wordInput.trim(),
                    definition: definitionInput.trim(),
                    bookIds: selectedBookIds.map((id) => parseInt(id, 10))
                })
            });

            if (res.ok) {
                enqueueSnackbar(tr("Glossary entry updated", "Entrée mise à jour avec succès"), { variant: "success" });
                setIsEditOpen(false);
                setEditingWord(null);
                fetchWords();
            } else if (res.status === 409) {
                enqueueSnackbar(tr("Another entry already exists with this term", "Un autre mot avec ce terme existe déjà"), { variant: "error" });
            } else {
                enqueueSnackbar(tr("Failed to update word", "Erreur lors de la mise à jour"), { variant: "error" });
            }
        } catch (err) {
            console.error("Update word error:", err);
            enqueueSnackbar(tr("An unexpected error occurred", "Une erreur inattendue est survenue"), { variant: "error" });
        } finally {
            setSubmitting(false);
        }
    };

    // Delete Word
    const handleDeleteWord = async () => {
        if (!deleteConfirmWord) return;

        try {
            setSubmitting(true);
            const res = await session.customFetch(`/words/${deleteConfirmWord.id}`, {
                method: "DELETE"
            });

            if (res.ok || res.status === 204) {
                enqueueSnackbar(tr("Word deleted from glossary", "Mot supprimé du glossaire"), { variant: "success" });
                setDeleteConfirmWord(null);
                fetchWords();
            } else {
                enqueueSnackbar(tr("Failed to delete word", "Erreur lors de la suppression"), { variant: "error" });
            }
        } catch (err) {
            console.error("Delete word error:", err);
            enqueueSnackbar(tr("An unexpected error occurred", "Une erreur inattendue est survenue"), { variant: "error" });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="glossary-page">
            <WrapperHeader>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                    <h2>
                        {tr("Glossary", "Glossaire")} {words.length > 0 ? `(${words.length})` : ""}
                    </h2>
                    <div className="glossary-page__header-actions">
                        <button
                            type="button"
                            className="glossary-page__add-btn"
                            onClick={handleOpenCreate}
                        >
                            <FontAwesomeIcon icon={faPlus} />
                            <span>{tr("New term", "Nouveau terme")}</span>
                        </button>
                    </div>
                </div>
            </WrapperHeader>

            <div className="glossary-page__content">
                {/* Toolbar: Search, Filter by book, Alphabet bar */}
            <div className="glossary-page__toolbar">
                <div className="glossary-page__toolbar-row">
                    <div className="glossary-page__search-group">
                        <div className="glossary-page__search">
                            <FontAwesomeIcon icon={faMagnifyingGlass} style={{ color: "var(--text-muted)" }} />
                            <input
                                type="text"
                                placeholder={tr("Search term, definition or book...", "Rechercher un terme, une définition...")}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="glossary-page__count">
                        {filteredWords.length} {filteredWords.length > 1 ? tr("terms found", "termes trouvés") : tr("term found", "terme trouvé")}
                    </div>
                </div>

                {/* Alphabet quick jump */}
                <div className="glossary-page__alphabet-bar">
                    <button
                        type="button"
                        className={`glossary-page__letter-btn ${selectedLetter === "ALL" ? "glossary-page__letter-btn--active" : ""}`}
                        onClick={() => setSelectedLetter("ALL")}
                    >
                        {tr("All", "Tous")}
                    </button>
                    {ALPHABET.map((letter) => {
                        const hasWords = activeLetters.has(letter);
                        const isActive = selectedLetter === letter;
                        return (
                            <button
                                key={letter}
                                type="button"
                                className={`glossary-page__letter-btn ${isActive ? "glossary-page__letter-btn--active" : ""} ${!hasWords ? "glossary-page__letter-btn--disabled" : ""}`}
                                onClick={() => setSelectedLetter(letter)}
                                disabled={!hasWords && selectedLetter !== letter}
                            >
                                {letter}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Content: List grouped by letter or empty state */}
            {loading ? (
                <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
                    {tr("Loading glossary...", "Chargement du glossaire...")}
                </div>
            ) : filteredWords.length > 0 ? (
                <div className="glossary-page__list">
                    {sortedLetters.map((letter) => (
                        <div key={letter} className="glossary-page__group">
                            <span className="glossary-page__group-letter">{letter}</span>
                            {groupedWords[letter].map((w) => (
                                <div key={w.id} className="glossary-page__card">
                                    <div className="glossary-page__card-top">
                                        <h3 className="glossary-page__word">
                                            {w.word}
                                        </h3>
                                        <div className="glossary-page__card-actions">
                                            <button
                                                type="button"
                                                className="glossary-page__icon-btn"
                                                title={tr("Edit term", "Modifier le terme")}
                                                onClick={() => handleOpenEdit(w)}
                                            >
                                                <FontAwesomeIcon icon={faPen} />
                                            </button>
                                            <button
                                                type="button"
                                                className="glossary-page__icon-btn glossary-page__icon-btn--delete"
                                                title={tr("Delete term", "Supprimer le terme")}
                                                onClick={() => setDeleteConfirmWord(w)}
                                            >
                                                <FontAwesomeIcon icon={faTrash} />
                                            </button>
                                        </div>
                                    </div>

                                    <p className="glossary-page__definition">
                                        {w.definition}
                                    </p>

                                    {w.books && w.books.length > 0 && (
                                        <div className="glossary-page__books-section">
                                            <span className="glossary-page__books-label">
                                                <FontAwesomeIcon icon={faBook} />
                                                <span>{tr("Associated books", "Livres associés")} ({w.books.length}) :</span>
                                            </span>
                                            <div className="glossary-page__books-chips">
                                                {w.books.map((b) => (
                                                    <Link
                                                        key={b.id}
                                                        to={`/app/book/${b.id}`}
                                                        className="glossary-page__book-chip"
                                                        title={b.title}
                                                    >
                                                        {b.coverUrl && (
                                                            <img src={b.coverUrl} alt={b.title} />
                                                        )}
                                                        <span>
                                                            {b.seriesName ? `${b.seriesName} ${b.volume != null ? `#${b.volume}` : ""}` : b.title}
                                                        </span>
                                                    </Link>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="glossary-page__empty">
                    <FontAwesomeIcon icon={faSpellCheck} className="glossary-page__empty-icon" />
                    <h3 className="glossary-page__empty-title">
                        {searchQuery.trim() || selectedLetter !== "ALL" || bookFilterId
                            ? tr("No terms match your filters", "Aucun terme ne correspond à vos filtres")
                            : tr("Glossary is empty", "Le glossaire est vide")}
                    </h3>
                    <p className="glossary-page__empty-text">
                        {searchQuery.trim() || selectedLetter !== "ALL" || bookFilterId
                            ? tr("Try clearing your filters or changing search keywords.", "Essayez de réinitialiser vos filtres ou de modifier votre recherche.")
                            : tr("Add specialized terms, lore, fictional names or definitions and link them to one or multiple books.", "Ajoutez des définitions, concepts, personnages ou termes de vos univers et reliez-les à un ou plusieurs livres.")}
                    </p>
                    {(!searchQuery.trim() && selectedLetter === "ALL" && !bookFilterId) && (
                        <button
                            type="button"
                            className="glossary-page__add-btn"
                            onClick={handleOpenCreate}
                        >
                            <FontAwesomeIcon icon={faPlus} />
                            <span>{tr("Add the first term", "Ajouter le premier terme")}</span>
                        </button>
                    )}
                </div>
            )}
            </div>

            {/* Modal: Create Word */}
            <Dialog
                open={isCreateOpen}
                onClose={() => !submitting && setIsCreateOpen(false)}
                PaperProps={{
                    style: {
                        backgroundColor: "transparent",
                        boxShadow: "none",
                        overflow: "visible",
                        maxWidth: "600px",
                        width: "100%",
                        margin: "16px"
                    }
                }}
            >
                <div className="word-modal">
                    <div className="word-modal__header">
                        <h3>
                            <FontAwesomeIcon icon={faPlus} style={{ color: "var(--accent-primary)" }} />
                            <span>{tr("Add term to glossary", "Ajouter un terme au glossaire")}</span>
                        </h3>
                        <button
                            type="button"
                            className="word-modal__close"
                            onClick={() => setIsCreateOpen(false)}
                            disabled={submitting}
                        >
                            &times;
                        </button>
                    </div>

                    <form onSubmit={handleCreateWord} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        <div className="word-modal__field">
                            <label>{tr("Term / Word", "Mot / Terme")} *</label>
                            <input
                                type="text"
                                value={wordInput}
                                onChange={(e) => setWordInput(e.target.value)}
                                placeholder={tr("e.g. Kwisatz Haderach, Stand, Cyberware...", "ex : Grimoire, Stand, Cyberpunk...")}
                                required
                            />
                        </div>

                        <div className="word-modal__field">
                            <label>{tr("Definition", "Définition")} *</label>
                            <textarea
                                value={definitionInput}
                                onChange={(e) => setDefinitionInput(e.target.value)}
                                placeholder={tr("Write the definition or explanation...", "Rédigez la définition ou l'explication du terme...")}
                                required
                            />
                        </div>

                        <div className="word-modal__field">
                            <label>{tr("Associated books (optional)", "Associer à un ou plusieurs livres (optionnel)")}</label>
                            <div className="word-modal__selected-books">
                                {selectedBookIds.length > 0 ? (
                                    selectedBookIds.map((id) => {
                                        const b = allBooks.find((bk) => String(bk.id) === id);
                                        return (
                                            <span key={id} className="word-modal__selected-chip">
                                                <span>{b ? (b.seriesName ? `${b.seriesName} - ${b.title}` : b.title) : `Livre #${id}`}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveBookFromSelection(id)}
                                                    title={tr("Remove association", "Supprimer l'association")}
                                                >
                                                    <FontAwesomeIcon icon={faXmark} />
                                                </button>
                                            </span>
                                        );
                                    })
                                ) : (
                                    <span style={{ fontSize: "0.825rem", color: "var(--text-muted)", padding: "4px" }}>
                                        {tr("No books associated yet. Use the select below to add one or more books.", "Aucun livre associé. Utilisez le sélecteur ci-dessous pour en ajouter.")}
                                    </span>
                                )}
                            </div>

                            {booksAvailableToAdd.length > 0 && (
                                <div style={{ marginTop: "6px" }}>
                                    <SearchableSelect
                                        value={bookToAddId}
                                        onChange={(val) => handleAddBookToSelection(val)}
                                        options={booksAvailableToAdd}
                                        placeholder={tr("Add a book to this definition...", "Ajouter un livre à cette définition...")}
                                        allowEmpty={true}
                                        emptyLabel={tr("Select a book to add...", "Sélectionner un livre à ajouter...")}
                                        allowCustom={false}
                                        searchable={true}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="word-modal__actions">
                            <button
                                type="button"
                                className="word-modal__btn word-modal__btn--cancel"
                                onClick={() => setIsCreateOpen(false)}
                                disabled={submitting}
                            >
                                {tr("Cancel", "Annuler")}
                            </button>
                            <button
                                type="submit"
                                className="word-modal__btn word-modal__btn--save"
                                disabled={submitting || !wordInput.trim() || !definitionInput.trim()}
                            >
                                {submitting ? tr("Saving...", "Enregistrement...") : tr("Save term", "Enregistrer le terme")}
                            </button>
                        </div>
                    </form>
                </div>
            </Dialog>

            {/* Modal: Edit Word */}
            <Dialog
                open={isEditOpen}
                onClose={() => !submitting && setIsEditOpen(false)}
                PaperProps={{
                    style: {
                        backgroundColor: "transparent",
                        boxShadow: "none",
                        overflow: "visible",
                        maxWidth: "600px",
                        width: "100%",
                        margin: "16px"
                    }
                }}
            >
                {editingWord && (
                    <div className="word-modal">
                        <div className="word-modal__header">
                            <h3>
                                <FontAwesomeIcon icon={faPen} style={{ color: "var(--accent-primary)" }} />
                                <span>{tr("Edit definition", "Modifier la définition")}</span>
                            </h3>
                            <button
                                type="button"
                                className="word-modal__close"
                                onClick={() => setIsEditOpen(false)}
                                disabled={submitting}
                            >
                                &times;
                            </button>
                        </div>

                        <form onSubmit={handleUpdateWord} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            <div className="word-modal__field">
                                <label>{tr("Term / Word", "Mot / Terme")} *</label>
                                <input
                                    type="text"
                                    value={wordInput}
                                    onChange={(e) => setWordInput(e.target.value)}
                                    placeholder={tr("e.g. Kwisatz Haderach...", "Mot...")}
                                    required
                                />
                            </div>

                            <div className="word-modal__field">
                                <label>{tr("Definition", "Définition")} *</label>
                                <textarea
                                    value={definitionInput}
                                    onChange={(e) => setDefinitionInput(e.target.value)}
                                    placeholder={tr("Definition...", "Définition...")}
                                    required
                                />
                            </div>

                            <div className="word-modal__field">
                                <label>{tr("Associated books", "Associer à un ou plusieurs livres")}</label>
                                <div className="word-modal__selected-books">
                                    {selectedBookIds.length > 0 ? (
                                        selectedBookIds.map((id) => {
                                            const b = allBooks.find((bk) => String(bk.id) === id);
                                            return (
                                                <span key={id} className="word-modal__selected-chip">
                                                    <span>{b ? (b.seriesName ? `${b.seriesName} - ${b.title}` : b.title) : `Livre #${id}`}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveBookFromSelection(id)}
                                                        title={tr("Remove association", "Supprimer l'association")}
                                                    >
                                                        <FontAwesomeIcon icon={faXmark} />
                                                    </button>
                                                </span>
                                            );
                                        })
                                    ) : (
                                        <span style={{ fontSize: "0.825rem", color: "var(--text-muted)", padding: "4px" }}>
                                            {tr("No books associated.", "Aucun livre associé.")}
                                        </span>
                                    )}
                                </div>

                                {booksAvailableToAdd.length > 0 && (
                                    <div style={{ marginTop: "6px" }}>
                                        <SearchableSelect
                                            value={bookToAddId}
                                            onChange={(val) => handleAddBookToSelection(val)}
                                            options={booksAvailableToAdd}
                                            placeholder={tr("Add another book...", "Ajouter un autre livre...")}
                                            allowEmpty={true}
                                            emptyLabel={tr("Select a book to add...", "Sélectionner un livre à ajouter...")}
                                            allowCustom={false}
                                            searchable={true}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="word-modal__actions">
                                <button
                                    type="button"
                                    className="word-modal__btn word-modal__btn--cancel"
                                    onClick={() => setIsEditOpen(false)}
                                    disabled={submitting}
                                >
                                    {tr("Cancel", "Annuler")}
                                </button>
                                <button
                                    type="submit"
                                    className="word-modal__btn word-modal__btn--save"
                                    disabled={submitting || !wordInput.trim() || !definitionInput.trim()}
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
                open={Boolean(deleteConfirmWord)}
                onClose={() => !submitting && setDeleteConfirmWord(null)}
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
                {deleteConfirmWord && (
                    <div className="word-modal">
                        <div className="word-modal__header">
                            <h3>
                                <FontAwesomeIcon icon={faTrash} style={{ color: "#ef4444" }} />
                                <span>{tr("Delete definition?", "Supprimer le mot ?")}</span>
                            </h3>
                            <button
                                type="button"
                                className="word-modal__close"
                                onClick={() => setDeleteConfirmWord(null)}
                                disabled={submitting}
                            >
                                &times;
                            </button>
                        </div>

                        <p style={{ margin: 0, fontSize: "0.95rem", lineHeight: 1.5, color: "var(--text-secondary)" }}>
                            {tr(
                                `Are you sure you want to delete the term "${deleteConfirmWord.word}" from the glossary? This action cannot be undone.`,
                                `Êtes-vous sûr de vouloir supprimer le terme « ${deleteConfirmWord.word} » du glossaire ? Cette action est irréversible.`
                            )}
                        </p>

                        <div className="word-modal__actions">
                            <button
                                type="button"
                                className="word-modal__btn word-modal__btn--cancel"
                                onClick={() => setDeleteConfirmWord(null)}
                                disabled={submitting}
                            >
                                {tr("Cancel", "Annuler")}
                            </button>
                            <button
                                type="button"
                                className="word-modal__btn word-modal__btn--delete"
                                onClick={handleDeleteWord}
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
