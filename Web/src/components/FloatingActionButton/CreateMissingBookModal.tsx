import { useState, useEffect, useRef } from "react";
import { Dialog } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faBook,
    faXmark,
    faCheck,
    faBarcode,
    faTag,
    faImage,
    faUpload,
    faLink,
    faPenNib
} from "@fortawesome/free-solid-svg-icons";
import { useSnackbar } from "notistack";
import { useNavigate } from "react-router";
import useSession from "../../hooks/UseSession.tsx";
import useLanguage from "../../hooks/UseLanguage.tsx";
import BookDTO from "../../dto/Book.dto.ts";

export interface InitialBookData {
    title?: string;
    isbn?: string;
    price?: number | null;
    coverUrl?: string | null;
}

interface Props {
    open: boolean;
    onClose: () => void;
    initialData?: InitialBookData | string;
    initialTitle?: string;
}

export default function CreateMissingBookModal({ open, onClose, initialData, initialTitle }: Props) {
    const session = useSession();
    const { tr } = useLanguage();
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();

    // Essential fields for quick creation
    const [title, setTitle] = useState("");
    const [isbn, setIsbn] = useState("");
    const [price, setPrice] = useState<string>("");

    // Cover
    const [coverMode, setCoverMode] = useState<"url" | "file">("url");
    const [coverUrl, setCoverUrl] = useState("");
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [filePreview, setFilePreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const titleInputRef = useRef<HTMLInputElement | null>(null);

    // Submitting state
    const [submitting, setSubmitting] = useState(false);

    // Reset when modal opens
    useEffect(() => {
        if (!open) return;

        let resolvedTitle = initialTitle || "";
        let resolvedIsbn = "";
        let resolvedPrice = "";
        let resolvedCoverUrl = "";

        if (initialData) {
            if (typeof initialData === "string") {
                resolvedTitle = initialData;
            } else {
                resolvedTitle = initialData.title || "";
                resolvedIsbn = initialData.isbn || "";
                resolvedPrice = initialData.price != null ? String(initialData.price) : "";
                resolvedCoverUrl = initialData.coverUrl || "";
            }
        }

        setTitle(resolvedTitle);
        setIsbn(resolvedIsbn);
        setPrice(resolvedPrice);
        setCoverMode("url");
        setCoverUrl(resolvedCoverUrl);
        setCoverFile(null);
        setFilePreview(null);
        setSubmitting(false);

        setTimeout(() => {
            titleInputRef.current?.focus();
        }, 120);
    }, [open, initialData, initialTitle]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setCoverFile(file);
            const previewUrl = URL.createObjectURL(file);
            setFilePreview(previewUrl);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || submitting) return;

        setSubmitting(true);

        try {
            const payload = {
                title: title.trim(),
                isbn: isbn.trim() ? isbn.trim() : null,
                price: price !== "" ? parseInt(price, 10) : 0,
                coverUrl: coverMode === "url" && coverUrl.trim() ? coverUrl.trim() : null,
                addToLibrary: true
            };

            const response = await session.customFetch("/books", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => null);
                const message = errData?.message || tr("Error creating book", "Erreur lors de la création du livre");
                enqueueSnackbar(message, { variant: "error" });
                setSubmitting(false);
                return;
            }

            const createdBook: BookDTO = await response.json();

            // If a cover file was uploaded, upload it now
            if (coverMode === "file" && coverFile && createdBook.id) {
                try {
                    const formData = new FormData();
                    formData.append("file", coverFile);
                    await session.customFetch(`/books/${encodeURIComponent(createdBook.id)}/cover`, {
                        method: "POST",
                        body: formData
                    });
                } catch (coverErr) {
                    console.error("Cover upload error:", coverErr);
                }
            }

            enqueueSnackbar(tr(`Book "${createdBook.title}" created successfully!`, `Livre « ${createdBook.title} » créé avec succès !`), { variant: "success" });
            onClose();

            if (createdBook.id) {
                navigate(`/app/book/${createdBook.id}`);
            }
        } catch (err) {
            console.error("Error creating book:", err);
            enqueueSnackbar(tr("An unexpected error occurred", "Une erreur inattendue est survenue"), { variant: "error" });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={() => !submitting && onClose()}
            PaperProps={{
                style: {
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-primary)",
                    borderRadius: "16px",
                    maxWidth: "520px",
                    width: "100%",
                    padding: "22px 24px",
                    margin: "16px",
                    boxShadow: "var(--shadow-lg)"
                }
            }}
        >
            <div className="fab-modal">
                <div className="fab-modal__header">
                    <div className="fab-modal__header-title">
                        <FontAwesomeIcon icon={faPenNib} />
                        <h3>{tr("Create a missing book", "Créer un livre manquant")}</h3>
                    </div>
                    <button
                        type="button"
                        className="fab-modal__header-close"
                        onClick={onClose}
                        disabled={submitting}
                        aria-label={tr("Close", "Fermer")}
                    >
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>

                <form className="fab-modal__body fab-form" onSubmit={handleSubmit}>
                    {/* Titre */}
                    <div className="fab-form__field">
                        <label>
                            <FontAwesomeIcon icon={faBook} />
                            <span>{tr("Book title *", "Titre de l'album *")}</span>
                        </label>
                        <input
                            ref={titleInputRef}
                            type="text"
                            required
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder={tr("e.g., Watchmen, Volume 1...", "ex: Watchmen, Tome 1...")}
                            autoComplete="off"
                        />
                    </div>

                    {/* ISBN / EAN & Prix */}
                    <div className="fab-form__row fab-form__row--2col">
                        <div className="fab-form__field">
                            <label>
                                <FontAwesomeIcon icon={faBarcode} />
                                <span>ISBN / EAN</span>
                            </label>
                            <input
                                type="text"
                                value={isbn}
                                onChange={(e) => setIsbn(e.target.value)}
                                placeholder={tr("e.g., 9782809499872", "ex: 9782809499872")}
                            />
                        </div>

                        <div className="fab-form__field">
                            <label>
                                <FontAwesomeIcon icon={faTag} />
                                <span>{tr("Price (€)", "Prix (€)")}</span>
                            </label>
                            <input
                                type="number"
                                min="0"
                                step="1"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                placeholder={tr("e.g., 20", "ex: 20")}
                            />
                        </div>
                    </div>

                    {/* Image de couverture */}
                    <div className="fab-form__cover-section">
                        <div className="fab-form__cover-section-preview">
                            {coverMode === "file" && filePreview ? (
                                <img src={filePreview} alt={tr("Cover preview", "Aperçu couverture")} />
                            ) : coverMode === "url" && coverUrl.trim() ? (
                                <img
                                    src={coverUrl}
                                    alt={tr("Cover preview", "Aperçu couverture")}
                                    onError={(e) => { (e.target as HTMLElement).style.display = "none"; }}
                                />
                            ) : (
                                <FontAwesomeIcon icon={faImage} />
                            )}
                        </div>

                        <div className="fab-form__cover-section-inputs">
                            <div className="fab-form__cover-section-tabs">
                                <button
                                    type="button"
                                    className={coverMode === "url" ? "active" : ""}
                                    onClick={() => setCoverMode("url")}
                                >
                                    <FontAwesomeIcon icon={faLink} />
                                    <span>{tr("URL link", "Lien URL")}</span>
                                </button>
                                <button
                                    type="button"
                                    className={coverMode === "file" ? "active" : ""}
                                    onClick={() => setCoverMode("file")}
                                >
                                    <FontAwesomeIcon icon={faUpload} />
                                    <span>{tr("File", "Fichier")}</span>
                                </button>
                            </div>

                            {coverMode === "url" ? (
                                <input
                                    type="text"
                                    value={coverUrl}
                                    onChange={(e) => setCoverUrl(e.target.value)}
                                    placeholder={tr("https://example.com/image.jpg", "https://exemple.com/image.jpg")}
                                />
                            ) : (
                                <div className="fab-form__file-upload-zone">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/png, image/jpeg, image/webp"
                                        onChange={handleFileChange}
                                        style={{ display: "none" }}
                                    />
                                    <button
                                        type="button"
                                        className="fab-form__file-btn"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <FontAwesomeIcon icon={faUpload} />
                                        <span>{coverFile ? coverFile.name : tr("Choose an image...", "Choisir une image...")}</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer boutons */}
                    <div className="fab-modal__footer">
                        <button
                            type="button"
                            className="fab-btn-cancel"
                            onClick={onClose}
                            disabled={submitting}
                        >
                            {tr("Cancel", "Annuler")}
                        </button>
                        <button
                            type="submit"
                            className="fab-btn-submit"
                            disabled={submitting || !title.trim()}
                        >
                            <FontAwesomeIcon icon={faCheck} />
                            <span>{submitting ? tr("Creating...", "Création...") : tr("Create book", "Créer le livre")}</span>
                        </button>
                    </div>
                </form>
            </div>
        </Dialog>
    );
}
