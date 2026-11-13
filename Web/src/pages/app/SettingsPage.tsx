import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from "react";
import { enqueueSnackbar } from "notistack";
import { useNavigate } from "react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faUser,
    faLock,
    faShieldHalved,
    faCheck,
    faTrashCan,
    faCamera,
    faTriangleExclamation,
    faXmark,
    faCircleNotch,
    faFileImport,
    faCloudArrowUp,
    faBook,
    faClock,
    faReceipt,
    faCircleCheck,
    faInfoCircle,
    faArrowsRotate,
    faPalette,
    faNoteSticky
} from "@fortawesome/free-solid-svg-icons";

import useSession from "../../hooks/UseSession.tsx";
import useLanguage from "../../hooks/UseLanguage.tsx";
import { WrapperHeader } from "../../components/Wrapper/Wrapper.tsx";
import UserAvatar from "../../components/UserAvatar/UserAvatar.tsx";
import ThemeSelector from "../../components/ThemeSelector/ThemeSelector.tsx";
import LanguageSelector from "../../components/LanguageSelector/LanguageSelector.tsx";
import HeaderFilterTabs, { type HeaderFilterTab } from "../../components/HeaderFilterTabs/HeaderFilterTabs.tsx";
import "./SettingsPage.scss";

const BACKEND_DELETE_PHRASE = "Je veux supprimer mon compte";

type SettingsTab = "profile" | "appearance" | "import" | "danger";

interface ImportJobStatus {
    id: string;
    user_id: number;
    status: "pending" | "processing" | "completed" | "failed";
    total_books: number;
    processed_books: number;
    created_books: number;
    updated_books: number;
    imported_purchases: number;
    imported_reading_sessions: number;
    imported_notes?: number;
    current_step: string;
    errors: string[];
}

export default function SettingsPage() {
    const session = useSession();
    const { tr } = useLanguage();
    const navigate = useNavigate();
    const requiredDeletePhrase = tr("I want to delete my account", "Je veux supprimer mon compte");

    const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
    const settingsTabs: HeaderFilterTab<SettingsTab>[] = [
        { id: "profile", label: tr("Profile", "Profil"), icon: faUser },
        { id: "appearance", label: tr("Appearance", "Apparence"), icon: faPalette },
        ...(!session.isAdmin
            ? [{ id: "import" as const, label: tr("Import", "Import Bookmory"), icon: faFileImport }]
            : []),
        { id: "danger", label: tr("Danger Zone", "Zone Danger"), icon: faTriangleExclamation }
    ];

    // Profile state
    const [username, setUsername] = useState("");
    const [avatar, setAvatar] = useState("");
    const [profileSaving, setProfileSaving] = useState(false);
    const [avatarUploading, setAvatarUploading] = useState(false);

    // Modal states for Danger Zone
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    // Password modal fields
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [passwordSaving, setPasswordSaving] = useState(false);

    // Delete account modal fields
    const [deletePassword, setDeletePassword] = useState("");
    const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
    const [deleteSaving, setDeleteSaving] = useState(false);

    // Import state
    const [importing, setImporting] = useState(false);
    const [importJob, setImportJob] = useState<ImportJobStatus | null>(null);
    const importPollingRef = useRef<number | null>(null);
    const [importBooks, setImportBooks] = useState(true);
    const [importStatuses, setImportStatuses] = useState(true);
    const [importReadingSessions, setImportReadingSessions] = useState(true);
    const [importPurchases, setImportPurchases] = useState(true);
    const [importNotes, setImportNotes] = useState(true);
    const hasAnyImportOption = importBooks || importStatuses || importReadingSessions || importPurchases || importNotes;

    // Fetch initial profile
    useEffect(() => {
        if (session.user) {
            setUsername(session.user.username || "");
            setAvatar(session.user.avatar || "");
        }

        session.customFetch("/user/profile", { method: "GET" })
            .then(async (res) => {
                if (res.ok) {
                    const data = await res.json();
                    if (data.username) setUsername(data.username);
                    if (data.avatar !== undefined && data.avatar !== null) setAvatar(data.avatar);
                }
            })
            .catch((err) => {
                console.error("Error fetching user profile:", err);
            });
    }, [session]);

    // Clean up polling timer
    useEffect(() => {
        return () => {
            if (importPollingRef.current) {
                clearInterval(importPollingRef.current);
            }
        };
    }, []);

    // Handle File Upload with Security Analysis
    const handleFileUpload = async (file: File) => {
        const lowerName = file.name.toLowerCase();
        if (!lowerName.endsWith(".jpg") && !lowerName.endsWith(".jpeg") && !lowerName.endsWith(".png")) {
            enqueueSnackbar(tr("Unsupported format: only JPG and PNG files are allowed.", "Format non supporté : seuls les fichiers JPG et PNG sont autorisés."), { variant: "error" });
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            enqueueSnackbar(tr("File too large (maximum 5 MB).", "Fichier trop volumineux (maximum 5 Mo)."), { variant: "error" });
            return;
        }

        const formData = new FormData();
        formData.append("file", file);
        formData.append("importBooks", String(importBooks));
        formData.append("importStatuses", String(importStatuses));
        formData.append("importReadingSessions", String(importReadingSessions));
        formData.append("importPurchases", String(importPurchases));
        formData.append("importNotes", String(importNotes));

        setAvatarUploading(true);
        try {
            const response = await session.customFetch("/user/avatar", {
                method: "POST",
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                setAvatar(data.avatar);
                if (data.token) {
                    session.updateToken(data.token);
                } else {
                    session.updateUser({ avatar: data.avatar });
                }
                enqueueSnackbar(tr("Avatar verified by security analysis and updated!", "Avatar vérifié par l'analyse de sécurité et mis à jour !"), { variant: "success" });
            } else {
                const errorText = await response.text().catch(() => "");
                let msg = tr("Failed to analyze or upload image.", "Échec de l'analyse ou du téléversement de l'image.");
                try {
                    const parsed = JSON.parse(errorText);
                    msg = parsed.error || parsed.message || errorText;
                } catch {
                    if (errorText) msg = errorText;
                }
                enqueueSnackbar(msg, { variant: "error" });
            }
        } catch (err) {
            console.error("Avatar upload error:", err);
            enqueueSnackbar(tr("Error uploading avatar.", "Erreur lors du téléversement de l'avatar."), { variant: "error" });
        } finally {
            setAvatarUploading(false);
        }
    };

    const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFileUpload(e.target.files[0]);
            e.target.value = "";
        }
    };

    // Remove avatar (reset to initial)
    const handleRemoveAvatar = async () => {
        setAvatar("");
        try {
            const response = await session.customFetch("/user/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: username.trim() || session.user?.username,
                    avatar: ""
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.token) {
                    session.updateToken(data.token);
                } else {
                    session.updateUser({ avatar: "" });
                }
                enqueueSnackbar(tr("Profile picture removed.", "Photo de profil supprimée."), { variant: "success" });
            }
        } catch (err) {
            console.error(err);
        }
    };

    // Update username
    const handleUpdateUsername = async (e: FormEvent) => {
        e.preventDefault();
        const trimmed = username.trim();
        if (!trimmed) {
            enqueueSnackbar(tr("Username cannot be empty.", "Le pseudonyme ne peut pas être vide."), { variant: "error" });
            return;
        }

        setProfileSaving(true);
        try {
            const response = await session.customFetch("/user/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: trimmed,
                    avatar: avatar
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.token) {
                    session.updateToken(data.token);
                } else {
                    session.updateUser({ username: trimmed });
                }
                enqueueSnackbar(tr("Username updated successfully!", "Pseudonyme mis à jour avec succès !"), { variant: "success" });
            } else {
                const errorText = await response.text().catch(() => "");
                let msg = tr("Error updating profile.", "Erreur lors de la mise à jour.");
                try {
                    const parsed = JSON.parse(errorText);
                    msg = parsed.message || parsed.error || errorText;
                } catch {
                    if (errorText) msg = errorText;
                }
                enqueueSnackbar(msg, { variant: "error" });
            }
        } catch (err) {
            console.error(err);
            enqueueSnackbar(tr("Connection error.", "Erreur de connexion."), { variant: "error" });
        } finally {
            setProfileSaving(false);
        }
    };

    // Bookmory Import Handler
    const handleBookmoryFileSelected = async (file: File) => {
        const lower = file.name.toLowerCase();
        if (!lower.endsWith(".bookmory") && !lower.endsWith(".zip")) {
            enqueueSnackbar(tr("Invalid format: please select a .bookmory file", "Format non valide : veuillez sélectionner un fichier .bookmory"), { variant: "error" });
            return;
        }

        const formData = new FormData();
        formData.append("file", file);
        formData.append("importBooks", String(importBooks));
        formData.append("importStatuses", String(importStatuses));
        formData.append("importReadingSessions", String(importReadingSessions));
        formData.append("importPurchases", String(importPurchases));
        formData.append("importNotes", String(importNotes));

        setImporting(true);
        setImportJob(null);

        try {
            const resp = await session.customFetch("/user/import/bookmory", {
                method: "POST",
                body: formData
            });

            if (!resp.ok) {
                const errText = await resp.text().catch(() => "");
                let msg = tr("Error uploading backup archive.", "Erreur lors de l'envoi de l'archive.");
                try {
                    const parsed = JSON.parse(errText);
                    msg = parsed.error || parsed.message || errText;
                } catch {
                    if (errText) msg = errText;
                }
                enqueueSnackbar(msg, { variant: "error" });
                setImporting(false);
                return;
            }

            const data = await resp.json();
            const initialJob = data.job;
            if (!initialJob || !initialJob.id) {
                enqueueSnackbar(tr("Unexpected response from import service.", "Réponse inattendue du service d'import."), { variant: "error" });
                setImporting(false);
                return;
            }

            setImportJob(initialJob);

            // Poll status
            if (importPollingRef.current) clearInterval(importPollingRef.current);
            importPollingRef.current = setInterval(async () => {
                try {
                    const sResp = await session.customFetch(`/user/import/status/${initialJob.id}`, { method: "GET" });
                    if (sResp.ok) {
                        const updatedJob: ImportJobStatus = await sResp.json();
                        setImportJob(updatedJob);

                        if (updatedJob.status === "completed") {
                            if (importPollingRef.current) clearInterval(importPollingRef.current);
                            setImporting(false);
                            enqueueSnackbar(
                                tr(
                                    `Bookmory import successful! (${updatedJob.created_books} created, ${updatedJob.updated_books} updated, ${updatedJob.imported_purchases} purchases, ${updatedJob.imported_reading_sessions} reading sessions, ${updatedJob.imported_notes ?? 0} notes)`,
                                    `Importation Bookmory réussie ! (${updatedJob.created_books} créés, ${updatedJob.updated_books} mis à jour, ${updatedJob.imported_purchases} achats, ${updatedJob.imported_reading_sessions} temps de lecture, ${updatedJob.imported_notes ?? 0} notes)`
                                ),
                                { variant: "success", autoHideDuration: 6000 }
                            );
                        } else if (updatedJob.status === "failed") {
                            if (importPollingRef.current) clearInterval(importPollingRef.current);
                            setImporting(false);
                            enqueueSnackbar(tr("Backup import failed.", "L'importation de la sauvegarde a échoué."), { variant: "error" });
                        }
                    }
                } catch (pollErr) {
                    console.error("Error polling import status:", pollErr);
                }
            }, 800);

        } catch (err) {
            console.error("Bookmory import error:", err);
            enqueueSnackbar(tr("Network error during import.", "Erreur réseau lors de l'importation."), { variant: "error" });
            setImporting(false);
        }
    };

    // Submit Password Change (Destructive action)
    const handleConfirmPasswordChange = async (e: FormEvent) => {
        e.preventDefault();

        if (!currentPassword) {
            enqueueSnackbar(tr("Current password is required.", "Le mot de passe actuel est requis."), { variant: "error" });
            return;
        }

        if (!newPassword || newPassword.length < 6) {
            enqueueSnackbar(tr("New password must be at least 6 characters long.", "Le nouveau mot de passe doit comporter au moins 6 caractères."), { variant: "error" });
            return;
        }

        if (newPassword !== confirmPassword) {
            enqueueSnackbar(tr("Confirmation does not match the new password.", "La confirmation ne correspond pas au nouveau mot de passe."), { variant: "error" });
            return;
        }

        setPasswordSaving(true);
        try {
            const response = await session.customFetch("/user/password", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    currentPassword,
                    newPassword
                })
            });

            if (response.ok) {
                enqueueSnackbar(tr("Password updated successfully!", "Mot de passe modifié avec succès !"), { variant: "success" });
                setIsPasswordModalOpen(false);
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
            } else {
                const errorText = await response.text().catch(() => "");
                let msg = tr("Error updating password.", "Erreur lors de la modification du mot de passe.");
                try {
                    const parsed = JSON.parse(errorText);
                    msg = parsed.message || parsed.error || errorText;
                } catch {
                    if (errorText) msg = errorText;
                }
                enqueueSnackbar(msg, { variant: "error" });
            }
        } catch (err) {
            console.error(err);
            enqueueSnackbar(tr("Error updating password.", "Erreur lors de la modification du mot de passe."), { variant: "error" });
        } finally {
            setPasswordSaving(false);
        }
    };

    // Submit Account Deletion (Destructive action)
    const handleConfirmDeleteAccount = async (e: FormEvent) => {
        e.preventDefault();

        if (!deletePassword) {
            enqueueSnackbar(tr("Please enter your password to confirm deletion.", "Veuillez saisir votre mot de passe pour confirmer la suppression."), { variant: "error" });
            return;
        }

        if (deleteConfirmationText !== requiredDeletePhrase && deleteConfirmationText !== BACKEND_DELETE_PHRASE) {
            enqueueSnackbar(tr(`You must type "${requiredDeletePhrase}" exactly.`, `Vous devez saisir exactement "${requiredDeletePhrase}".`), { variant: "error" });
            return;
        }

        setDeleteSaving(true);
        try {
            const response = await session.customFetch("/user/account", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    password: deletePassword,
                    confirmationText: BACKEND_DELETE_PHRASE
                })
            });

            if (response.ok) {
                setIsDeleteModalOpen(false);
                await session.logout();
                enqueueSnackbar(tr("Your account has been permanently deleted.", "Votre compte a été supprimé définitivement."), { variant: "info" });
                navigate("/login");
            } else {
                const errorText = await response.text().catch(() => "");
                let msg = tr("Error deleting account.", "Erreur lors de la suppression du compte.");
                try {
                    const parsed = JSON.parse(errorText);
                    msg = parsed.message || parsed.error || errorText;
                } catch {
                    if (errorText) msg = errorText;
                }
                enqueueSnackbar(msg, { variant: "error" });
            }
        } catch (err) {
            console.error(err);
            enqueueSnackbar(tr("Error deleting account.", "Erreur lors de la suppression du compte."), { variant: "error" });
        } finally {
            setDeleteSaving(false);
        }
    };

    return (
        <div className="settings-page">
            <WrapperHeader>
                <HeaderFilterTabs
                    tabs={settingsTabs}
                    selectedId={activeTab}
                    onChange={setActiveTab}
                />
            </WrapperHeader>

            <div className="settings-container">
                {/* Section 1: Réglages rapides (Pseudo, Avatar & Langue) */}
                {activeTab === "profile" && (
                <section className="settings-card">
                    <header className="settings-card__header">
                        <div className="settings-card__header-title">
                            <div className="settings-card__icon settings-card__icon--primary">
                                <FontAwesomeIcon icon={faUser} />
                            </div>
                            <div>
                                <h3>{tr("Quick Settings", "Réglages rapides")}</h3>
                                <p className="settings-card__header-desc">
                                    {session.isAdmin
                                        ? tr("Manage your username and display language", "Gérez votre pseudonyme et la langue d'affichage")
                                        : tr("Manage your username, profile picture and display language", "Gérez votre pseudonyme, votre image de profil et la langue d'affichage")}
                                </p>
                            </div>
                        </div>
                    </header>

                    <div className="settings-card__body">
                        {/* Pseudo Form */}
                        <form onSubmit={handleUpdateUsername} className="settings-inline-field">
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label htmlFor="settings-username">{tr("Username", "Pseudonyme")}</label>
                                <input
                                    id="settings-username"
                                    type="text"
                                    placeholder={tr("Your username", "Votre pseudonyme")}
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                className="settings-btn settings-btn--primary"
                                disabled={profileSaving}
                            >
                                <FontAwesomeIcon icon={faCheck} />
                                <span>{profileSaving ? tr("Saving...", "Enregistrement...") : tr("Save username", "Enregistrer le pseudonyme")}</span>
                            </button>
                        </form>

                        {/* Compact Avatar Upload Section */}
                        {!session.isAdmin && (
                        <div className="settings-field-block">
                            <span className="settings-field-label">{tr("Avatar", "Avatar")}</span>
                            <div className="avatar-compact">
                                <UserAvatar avatar={avatar} name={username} size="lg" />

                                <div className="avatar-compact__content">
                                    <span className="avatar-compact__title">
                                        {avatar ? tr("Active profile picture", "Photo de profil active") : tr("Default initials", "Initiales par défaut")}
                                    </span>

                                    <div className="avatar-compact__actions">
                                        <label className="avatar-compact__upload-btn">
                                            {avatarUploading ? (
                                                <FontAwesomeIcon icon={faCircleNotch} spin />
                                            ) : (
                                                <FontAwesomeIcon icon={faCamera} />
                                            )}
                                            <span>{avatarUploading ? tr("Verifying...", "Vérification...") : tr("Change picture", "Changer la photo")}</span>
                                            <input
                                                type="file"
                                                accept="image/png, image/jpeg, image/jpg"
                                                onChange={handleFileInputChange}
                                                disabled={avatarUploading}
                                            />
                                        </label>

                                        {avatar && (
                                            <button
                                                type="button"
                                                className="avatar-compact__reset-btn"
                                                onClick={handleRemoveAvatar}
                                            >
                                                <FontAwesomeIcon icon={faTrashCan} />
                                                <span>{tr("Remove picture", "Supprimer la photo")}</span>
                                            </button>
                                        )}
                                    </div>

                                    <div className="avatar-compact__meta">
                                        <span>{tr("Formats:", "Formats :")} <strong>JPG, PNG</strong> ({tr("max. 5 MB", "max. 5 Mo")}).</span>
                                        <span className="avatar-compact__security-tag">
                                            <FontAwesomeIcon icon={faShieldHalved} /> {tr("Security analysis & sanitization", "Analyse de sécurité & assainissement")}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        )}

                        {/* Language Selector */}
                        <LanguageSelector />
                    </div>
                </section>
                )}

                {/* Section: Thème & Apparence */}
                {activeTab === "appearance" && (
                <section className="settings-card">
                    <header className="settings-card__header">
                        <div className="settings-card__header-title">
                            <div className="settings-card__icon settings-card__icon--primary">
                                <FontAwesomeIcon icon={faPalette} />
                            </div>
                            <div>
                                <h3>{tr("Theme & Appearance", "Thème & Apparence")}</h3>
                                <p className="settings-card__header-desc">
                                    {tr("Choose the visual theme applied across the entire website", "Choisissez le thème graphique appliqué à l'ensemble du site")}
                                </p>
                            </div>
                        </div>
                    </header>

                    <div className="settings-card__body">
                        <ThemeSelector />
                    </div>
                </section>
                )}

                {/* Section 2: Import Bookmory */}
                {activeTab === "import" && !session.isAdmin && (
                <section className="settings-card settings-import-card">
                    <header className="settings-card__header">
                        <div className="settings-card__header-title">
                            <div className="settings-card__icon settings-card__icon--import">
                                <FontAwesomeIcon icon={faFileImport} />
                            </div>
                            <div>
                                <h3>{tr("Bookmory Backup Import", "Import de sauvegarde Bookmory")}</h3>
                                <p className="settings-card__header-desc">
                                    {tr("Import your books, covers, purchase data, reading time and notes from a .bookmory file", "Importez vos albums, couvertures, données d'achat, temps de lecture et notes depuis un fichier .bookmory")}
                                </p>
                            </div>
                        </div>
                    </header>

                    <div className="settings-card__body">
                        <div className="import-layout">
                        <div className="import-options-box">
                            <p className="import-options-box__title">
                                {tr("Data to import:", "Données à importer :")}
                            </p>
                            <div className="import-options-grid">
                                <label className="import-option-item">
                                    <input
                                        type="checkbox"
                                        checked={importBooks}
                                        disabled={importing}
                                        onChange={(e) => setImportBooks(e.target.checked)}
                                    />
                                    <span>{tr("Books and covers", "Albums et couvertures")}</span>
                                    <span
                                        className="import-option-info"
                                        title={tr(
                                            "Creates missing books and updates covers, authors, publishers and series.",
                                            "Crée les albums manquants et met à jour les couvertures, auteurs, éditeurs et séries."
                                        )}
                                    >
                                        <FontAwesomeIcon icon={faInfoCircle} />
                                    </span>
                                </label>
                                <label className="import-option-item">
                                    <input
                                        type="checkbox"
                                        checked={importStatuses}
                                        disabled={importing}
                                        onChange={(e) => setImportStatuses(e.target.checked)}
                                    />
                                    <span>{tr("Statuses & ownership", "Statuts et possession")}</span>
                                    <span
                                        className="import-option-info"
                                        title={tr(
                                            "Imports reading status (Read, Reading, To read) and wishlist/ownership.",
                                            "Importe le statut de lecture (Lu, En cours, À lire) et la possession / wishlist."
                                        )}
                                    >
                                        <FontAwesomeIcon icon={faInfoCircle} />
                                    </span>
                                </label>
                                <label className="import-option-item">
                                    <input
                                        type="checkbox"
                                        checked={importReadingSessions}
                                        disabled={importing}
                                        onChange={(e) => setImportReadingSessions(e.target.checked)}
                                    />
                                    <span>{tr("Reading sessions", "Sessions de lecture")}</span>
                                    <span
                                        className="import-option-info"
                                        title={tr(
                                            "Imports timed reading sessions and durations into your reading history.",
                                            "Importe les sessions et durées chronométrées dans votre historique de lecture."
                                        )}
                                    >
                                        <FontAwesomeIcon icon={faInfoCircle} />
                                    </span>
                                </label>
                                <label className="import-option-item">
                                    <input
                                        type="checkbox"
                                        checked={importPurchases}
                                        disabled={importing}
                                        onChange={(e) => setImportPurchases(e.target.checked)}
                                    />
                                    <span>{tr("Purchase data", "Données d'achat")}</span>
                                    <span
                                        className="import-option-info"
                                        title={tr(
                                            "Imports price, acquisition date, purchase location and memo into your transactions.",
                                            "Importe le prix, la date d'acquisition, le lieu d'achat et le mémo dans vos transactions."
                                        )}
                                    >
                                        <FontAwesomeIcon icon={faInfoCircle} />
                                    </span>
                                </label>
                                <label className="import-option-item">
                                    <input
                                        type="checkbox"
                                        checked={importNotes}
                                        disabled={importing}
                                        onChange={(e) => setImportNotes(e.target.checked)}
                                    />
                                    <span>{tr("Reading notes", "Notes de lecture")}</span>
                                    <span
                                        className="import-option-info"
                                        title={tr(
                                            "Imports book notes and reading comments into the Notes page.",
                                            "Importe les notes et commentaires de lecture dans la page Notes."
                                        )}
                                    >
                                        <FontAwesomeIcon icon={faInfoCircle} />
                                    </span>
                                </label>
                            </div>
                        </div>

                        <div className="import-action-zone">
                            <label className={`import-dropzone ${importing || !hasAnyImportOption ? "import-dropzone--disabled" : ""}`}>
                                <div className="import-dropzone__icon">
                                    {importing ? (
                                        <FontAwesomeIcon icon={faCircleNotch} spin />
                                    ) : (
                                        <FontAwesomeIcon icon={faCloudArrowUp} />
                                    )}
                                </div>
                                <div className="import-dropzone__text">
                                    <span className="import-dropzone__title">
                                        {importing
                                            ? tr("Importing...", "Importation en cours...")
                                            : !hasAnyImportOption
                                                ? tr("Select at least one option", "Sélectionnez au moins une option")
                                                : tr("Select a .bookmory backup", "Sélectionner une sauvegarde .bookmory")}
                                    </span>
                                    <span className="import-dropzone__subtitle">
                                        {tr("Accepted files:", "Fichiers acceptés :")} <strong>.bookmory</strong> {tr("(or zip archive)", "(ou archive zip)")}
                                    </span>
                                </div>
                                <input
                                    type="file"
                                    accept=".bookmory,.zip"
                                    disabled={importing || !hasAnyImportOption}
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files.length > 0) {
                                            handleBookmoryFileSelected(e.target.files[0]);
                                            e.target.value = "";
                                        }
                                    }}
                                />
                            </label>
                        </div>
                        </div>

                        {/* Live progress during import */}
                        {importing && importJob && (
                            <div className="import-progress-card">
                                <div className="import-progress-card__header">
                                    <span className="import-progress-card__step">
                                        <FontAwesomeIcon icon={faArrowsRotate} spin /> {importJob.current_step}
                                    </span>
                                    <span className="import-progress-card__count">
                                        {importJob.processed_books} / {importJob.total_books || "?"} {tr("books", "albums")}
                                    </span>
                                </div>
                                <div className="import-progress-bar">
                                    <div
                                        className="import-progress-bar__fill"
                                        style={{
                                            width: `${importJob.total_books > 0 ? Math.round((importJob.processed_books / importJob.total_books) * 100) : 10}%`
                                        }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Completed Job Statistics */}
                        {!importing && importJob && importJob.status === "completed" && (
                            <div className="import-results-card">
                                <div className="import-results-card__header">
                                    <FontAwesomeIcon icon={faCircleCheck} className="import-results-card__check" />
                                    <span>{tr("Import completed successfully!", "Importation réussie avec succès !")}</span>
                                </div>
                                <div className="import-stats-grid">
                                    <div className="import-stat-item import-stat-item--green">
                                        <FontAwesomeIcon icon={faBook} />
                                        <div className="import-stat-item__content">
                                            <span className="import-stat-item__num">{importJob.created_books}</span>
                                            <span className="import-stat-item__label">{tr("New books created", "Nouveaux albums créés")}</span>
                                        </div>
                                    </div>
                                    <div className="import-stat-item import-stat-item--blue">
                                        <FontAwesomeIcon icon={faBook} />
                                        <div className="import-stat-item__content">
                                            <span className="import-stat-item__num">{importJob.updated_books}</span>
                                            <span className="import-stat-item__label">{tr("Books updated", "Albums mis à jour")}</span>
                                        </div>
                                    </div>
                                    <div className="import-stat-item import-stat-item--amber">
                                        <FontAwesomeIcon icon={faReceipt} />
                                        <div className="import-stat-item__content">
                                            <span className="import-stat-item__num">{importJob.imported_purchases}</span>
                                            <span className="import-stat-item__label">{tr("Purchases imported", "Achats importés")}</span>
                                        </div>
                                    </div>
                                    <div className="import-stat-item import-stat-item--purple">
                                        <FontAwesomeIcon icon={faClock} />
                                        <div className="import-stat-item__content">
                                            <span className="import-stat-item__num">{importJob.imported_reading_sessions}</span>
                                            <span className="import-stat-item__label">{tr("Reading sessions imported", "Temps de lecture importés")}</span>
                                        </div>
                                    </div>
                                    <div className="import-stat-item import-stat-item--green">
                                        <FontAwesomeIcon icon={faNoteSticky} />
                                        <div className="import-stat-item__content">
                                            <span className="import-stat-item__num">{importJob.imported_notes ?? 0}</span>
                                            <span className="import-stat-item__label">{tr("Notes imported", "Notes importées")}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Errors summary if failed or warnings */}
                        {importJob && importJob.errors && importJob.errors.length > 0 && (
                            <div className="import-errors-box">
                                <div className="import-errors-box__title">
                                    <FontAwesomeIcon icon={faTriangleExclamation} />
                                    <span>{importJob.errors.length} {tr("warning(s) during import:", "avertissement(s) lors de l'import :")}</span>
                                </div>
                                <ul>
                                    {importJob.errors.slice(0, 5).map((err, idx) => (
                                        <li key={idx}>{err}</li>
                                    ))}
                                    {importJob.errors.length > 5 && (
                                        <li>{tr(`... and ${importJob.errors.length - 5} more`, `... et ${importJob.errors.length - 5} autre(s)`)}</li>
                                    )}
                                </ul>
                            </div>
                        )}
                    </div>
                </section>
                )}

                {/* Section 3: Zone Danger */}
                {activeTab === "danger" && (
                <section className="settings-danger-card">
                    <header className="settings-card__header">
                        <div className="settings-card__header-title">
                            <div className="settings-card__icon settings-card__icon--danger">
                                <FontAwesomeIcon icon={faTriangleExclamation} />
                            </div>
                            <div>
                                <h3>{tr("Danger Zone", "Zone Danger")}</h3>
                                <p className="settings-card__header-desc">
                                    {tr("Sensitive and destructive actions requiring confirmation", "Actions sensibles et destructives nécessitant une confirmation")}
                                </p>
                            </div>
                        </div>
                        <div className="settings-card__badge-danger">
                            <FontAwesomeIcon icon={faLock} />
                            <span>{tr("Confirmation required", "Confirmation requise")}</span>
                        </div>
                    </header>

                    <div className="settings-danger-card__list">
                        {/* Ligne 2: Mot de passe */}
                        <div className="settings-danger-card__item">
                            <div className="settings-danger-card__item-info">
                                <span className="settings-danger-card__item-title">{tr("Password", "Mot de passe")}</span>
                                <span className="settings-danger-card__item-desc">
                                    {tr("Strengthen your account security with a strong password", "Renforcez la sécurité de votre compte avec un mot de passe robuste")}
                                </span>
                            </div>
                            <button
                                type="button"
                                className="settings-danger-card__btn"
                                onClick={() => {
                                    setCurrentPassword("");
                                    setNewPassword("");
                                    setConfirmPassword("");
                                    setIsPasswordModalOpen(true);
                                }}
                            >
                                <FontAwesomeIcon icon={faLock} />
                                <span>{tr("Change password", "Changer de mot de passe")}</span>
                            </button>
                        </div>

                        {/* Ligne 3: Suppression de compte */}
                        <div className="settings-danger-card__item">
                            <div className="settings-danger-card__item-info">
                                <span className="settings-danger-card__item-title" style={{ color: "#f87171" }}>
                                    {tr("Delete my account", "Supprimer mon compte")}
                                </span>
                                <span className="settings-danger-card__item-desc">
                                    {tr("Permanently deletes your account, lists, and all your data", "Supprime définitivement votre compte, vos listes et toutes vos données")}
                                </span>
                            </div>
                            <button
                                type="button"
                                className="settings-danger-card__btn"
                                onClick={() => {
                                    setDeletePassword("");
                                    setDeleteConfirmationText("");
                                    setIsDeleteModalOpen(true);
                                }}
                            >
                                <FontAwesomeIcon icon={faTrashCan} />
                                <span>{tr("Delete account", "Supprimer le compte")}</span>
                            </button>
                        </div>
                    </div>
                </section>
                )}
            </div>

            {/* Popup / Modal 2: Changer de mot de passe */}
            {isPasswordModalOpen && (
                <div className="settings-modal-backdrop" onClick={() => setIsPasswordModalOpen(false)}>
                    <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
                        <header className="settings-modal__header">
                            <div className="settings-modal__title">
                                <FontAwesomeIcon icon={faLock} />
                                <span>{tr("Change password", "Changer de mot de passe")}</span>
                            </div>
                            <button
                                type="button"
                                className="settings-modal__close"
                                onClick={() => setIsPasswordModalOpen(false)}
                                aria-label={tr("Close", "Fermer")}
                            >
                                <FontAwesomeIcon icon={faXmark} />
                            </button>
                        </header>

                        <form onSubmit={handleConfirmPasswordChange}>
                            <div className="settings-modal__body">
                                <div className="settings-modal__warning">
                                    <FontAwesomeIcon icon={faTriangleExclamation} />
                                    <span>
                                        {tr("For security reasons, you must enter your current password to set a new password.", "Pour des raisons de sécurité, vous devez renseigner votre mot de passe actuel pour définir un nouveau mot de passe.")}
                                    </span>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="modal-current-pwd">{tr("Current password", "Mot de passe actuel")}</label>
                                    <input
                                        id="modal-current-pwd"
                                        type="password"
                                        placeholder={tr("Your current password", "Votre mot de passe actuel")}
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        required
                                        autoFocus
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="modal-new-pwd">{tr("New password (min. 6 characters)", "Nouveau mot de passe (min. 6 caractères)")}</label>
                                    <input
                                        id="modal-new-pwd"
                                        type="password"
                                        placeholder={tr("New password", "Nouveau mot de passe")}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        minLength={6}
                                        required
                                    />
                                </div>

                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label htmlFor="modal-confirm-pwd">{tr("Confirm new password", "Confirmer le nouveau mot de passe")}</label>
                                    <input
                                        id="modal-confirm-pwd"
                                        type="password"
                                        placeholder={tr("Confirm new password", "Confirmez le nouveau mot de passe")}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        minLength={6}
                                        required
                                    />
                                </div>
                            </div>

                            <footer className="settings-modal__footer">
                                <button
                                    type="button"
                                    className="settings-btn settings-btn--ghost"
                                    onClick={() => setIsPasswordModalOpen(false)}
                                    disabled={passwordSaving}
                                >
                                    {tr("Cancel", "Annuler")}
                                </button>
                                <button
                                    type="submit"
                                    className="settings-btn settings-btn--danger"
                                    disabled={passwordSaving}
                                >
                                    <FontAwesomeIcon icon={passwordSaving ? faCircleNotch : faCheck} spin={passwordSaving} />
                                    <span>{passwordSaving ? tr("Updating...", "Modification...") : tr("Confirm password change", "Confirmer le changement de mot de passe")}</span>
                                </button>
                            </footer>
                        </form>
                    </div>
                </div>
            )}

            {/* Popup / Modal 3: Suppression de compte */}
            {isDeleteModalOpen && (
                <div className="settings-modal-backdrop" onClick={() => setIsDeleteModalOpen(false)}>
                    <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
                        <header className="settings-modal__header">
                            <div className="settings-modal__title">
                                <FontAwesomeIcon icon={faTrashCan} />
                                <span>{tr("Permanently delete account", "Supprimer définitivement le compte")}</span>
                            </div>
                            <button
                                type="button"
                                className="settings-modal__close"
                                onClick={() => setIsDeleteModalOpen(false)}
                                aria-label={tr("Close", "Fermer")}
                            >
                                <FontAwesomeIcon icon={faXmark} />
                            </button>
                        </header>

                        <form onSubmit={handleConfirmDeleteAccount}>
                            <div className="settings-modal__body">
                                <div className="settings-modal__warning">
                                    <FontAwesomeIcon icon={faTriangleExclamation} />
                                    <span>
                                        {tr("Warning: this action is", "Attention : cette action est")} <strong>{tr("irreversible", "irréversible")}</strong>. {tr("All your account data, library and wishlist will be deleted with no possibility of recovery.", "Toutes vos données de compte, votre bibliothèque et vos souhaits seront supprimés sans possibilité de récupération.")}
                                    </span>
                                </div>

                                <div className="form-group">
                                    <label>
                                        {tr("Type the following phrase to confirm:", "Recopiez la phrase suivante pour confirmer :")}
                                    </label>
                                    <div className="modal-confirm-quote">
                                        {requiredDeletePhrase}
                                    </div>
                                    <input
                                        type="text"
                                        placeholder={requiredDeletePhrase}
                                        value={deleteConfirmationText}
                                        onChange={(e) => setDeleteConfirmationText(e.target.value)}
                                        required
                                        autoFocus
                                    />
                                </div>

                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label htmlFor="modal-delete-pwd">{tr("Current password", "Mot de passe actuel")}</label>
                                    <input
                                        id="modal-delete-pwd"
                                        type="password"
                                        placeholder={tr("Your password to confirm deletion", "Votre mot de passe pour confirmer la suppression")}
                                        value={deletePassword}
                                        onChange={(e) => setDeletePassword(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <footer className="settings-modal__footer">
                                <button
                                    type="button"
                                    className="settings-btn settings-btn--ghost"
                                    onClick={() => setIsDeleteModalOpen(false)}
                                    disabled={deleteSaving}
                                >
                                    {tr("Cancel", "Annuler")}
                                </button>
                                <button
                                    type="submit"
                                    className="settings-btn settings-btn--danger"
                                    disabled={deleteSaving}
                                >
                                    <FontAwesomeIcon icon={deleteSaving ? faCircleNotch : faCheck} spin={deleteSaving} />
                                    <span>{deleteSaving ? tr("Deleting...", "Suppression en cours...") : tr("Confirm permanent deletion", "Confirmer la suppression définitive")}</span>
                                </button>
                            </footer>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
