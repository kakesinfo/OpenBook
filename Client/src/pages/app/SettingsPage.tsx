import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from "react";
import { enqueueSnackbar } from "notistack";
import { useNavigate } from "react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faUser,
    faEnvelope,
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
    faPalette
} from "@fortawesome/free-solid-svg-icons";

import useSession from "../../hooks/UseSession.tsx";
import { WrapperHeader } from "../../components/Wrapper/Wrapper.tsx";
import UserAvatar from "../../components/UserAvatar/UserAvatar.tsx";
import ThemeSelector from "../../components/ThemeSelector/ThemeSelector.tsx";
import "./SettingsPage.scss";

const REQUIRED_DELETE_PHRASE = "Je veux supprimer mon compte";

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
    current_step: string;
    errors: string[];
}

export default function SettingsPage() {
    const session = useSession();
    const navigate = useNavigate();

    // Profile state
    const [username, setUsername] = useState("");
    const [avatar, setAvatar] = useState("");
    const [profileSaving, setProfileSaving] = useState(false);
    const [avatarUploading, setAvatarUploading] = useState(false);

    // Modal states for Danger Zone
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    // Email modal fields
    const [newEmail, setNewEmail] = useState("");
    const [emailCurrentPassword, setEmailCurrentPassword] = useState("");
    const [emailSaving, setEmailSaving] = useState(false);

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
            enqueueSnackbar("Format non supporté : seuls les fichiers JPG et PNG sont autorisés.", { variant: "error" });
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            enqueueSnackbar("Fichier trop volumineux (maximum 5 Mo).", { variant: "error" });
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

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
                enqueueSnackbar("Avatar vérifié par l'analyse de sécurité et mis à jour !", { variant: "success" });
            } else {
                const errorText = await response.text().catch(() => "");
                let msg = "Échec de l'analyse ou du téléversement de l'image.";
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
            enqueueSnackbar("Erreur lors du téléversement de l'avatar.", { variant: "error" });
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
                enqueueSnackbar("Photo de profil supprimée.", { variant: "success" });
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
            enqueueSnackbar("Le pseudonyme ne peut pas être vide.", { variant: "error" });
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
                enqueueSnackbar("Pseudonyme mis à jour avec succès !", { variant: "success" });
            } else {
                const errorText = await response.text().catch(() => "");
                let msg = "Erreur lors de la mise à jour.";
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
            enqueueSnackbar("Erreur de connexion.", { variant: "error" });
        } finally {
            setProfileSaving(false);
        }
    };

    // Bookmory Import Handler
    const handleBookmoryFileSelected = async (file: File) => {
        const lower = file.name.toLowerCase();
        if (!lower.endsWith(".bookmory") && !lower.endsWith(".zip")) {
            enqueueSnackbar("Format non valide : veuillez sélectionner un fichier .bookmory", { variant: "error" });
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        setImporting(true);
        setImportJob(null);

        try {
            const resp = await session.customFetch("/user/import/bookmory", {
                method: "POST",
                body: formData
            });

            if (!resp.ok) {
                const errText = await resp.text().catch(() => "");
                let msg = "Erreur lors de l'envoi de l'archive.";
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
                enqueueSnackbar("Réponse inattendue du service d'import.", { variant: "error" });
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
                                `Importation Bookmory réussie ! (${updatedJob.created_books} créés, ${updatedJob.updated_books} mis à jour, ${updatedJob.imported_purchases} achats, ${updatedJob.imported_reading_sessions} temps de lecture)`,
                                { variant: "success", autoHideDuration: 6000 }
                            );
                        } else if (updatedJob.status === "failed") {
                            if (importPollingRef.current) clearInterval(importPollingRef.current);
                            setImporting(false);
                            enqueueSnackbar("L'importation de la sauvegarde a échoué.", { variant: "error" });
                        }
                    }
                } catch (pollErr) {
                    console.error("Error polling import status:", pollErr);
                }
            }, 800);

        } catch (err) {
            console.error("Bookmory import error:", err);
            enqueueSnackbar("Erreur réseau lors de l'importation.", { variant: "error" });
            setImporting(false);
        }
    };

    // Submit Email Change (Destructive action)
    const handleConfirmEmailChange = async (e: FormEvent) => {
        e.preventDefault();
        const trimmed = newEmail.trim();

        if (!trimmed) {
            enqueueSnackbar("Veuillez saisir une nouvelle adresse email.", { variant: "error" });
            return;
        }

        if (!emailCurrentPassword) {
            enqueueSnackbar("Votre mot de passe actuel est obligatoire pour confirmer.", { variant: "error" });
            return;
        }

        setEmailSaving(true);
        try {
            const response = await session.customFetch("/user/email", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: trimmed,
                    currentPassword: emailCurrentPassword
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.token) {
                    session.updateToken(data.token);
                } else {
                    session.updateUser({ email: trimmed });
                }
                enqueueSnackbar("Adresse email mise à jour avec succès !", { variant: "success" });
                setIsEmailModalOpen(false);
                setEmailCurrentPassword("");
                setNewEmail("");
            } else {
                const errorText = await response.text().catch(() => "");
                let msg = "Erreur lors de la modification de l'adresse email.";
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
            enqueueSnackbar("Erreur lors de la modification de l'email.", { variant: "error" });
        } finally {
            setEmailSaving(false);
        }
    };

    // Submit Password Change (Destructive action)
    const handleConfirmPasswordChange = async (e: FormEvent) => {
        e.preventDefault();

        if (!currentPassword) {
            enqueueSnackbar("Le mot de passe actuel est requis.", { variant: "error" });
            return;
        }

        if (!newPassword || newPassword.length < 6) {
            enqueueSnackbar("Le nouveau mot de passe doit comporter au moins 6 caractères.", { variant: "error" });
            return;
        }

        if (newPassword !== confirmPassword) {
            enqueueSnackbar("La confirmation ne correspond pas au nouveau mot de passe.", { variant: "error" });
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
                enqueueSnackbar("Mot de passe modifié avec succès !", { variant: "success" });
                setIsPasswordModalOpen(false);
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
            } else {
                const errorText = await response.text().catch(() => "");
                let msg = "Erreur lors de la modification du mot de passe.";
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
            enqueueSnackbar("Erreur lors de la modification du mot de passe.", { variant: "error" });
        } finally {
            setPasswordSaving(false);
        }
    };

    // Submit Account Deletion (Destructive action)
    const handleConfirmDeleteAccount = async (e: FormEvent) => {
        e.preventDefault();

        if (!deletePassword) {
            enqueueSnackbar("Veuillez saisir votre mot de passe pour confirmer la suppression.", { variant: "error" });
            return;
        }

        if (deleteConfirmationText !== REQUIRED_DELETE_PHRASE) {
            enqueueSnackbar(`Vous devez saisir exactement "${REQUIRED_DELETE_PHRASE}".`, { variant: "error" });
            return;
        }

        setDeleteSaving(true);
        try {
            const response = await session.customFetch("/user/account", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    password: deletePassword,
                    confirmationText: deleteConfirmationText
                })
            });

            if (response.ok) {
                setIsDeleteModalOpen(false);
                await session.logout();
                enqueueSnackbar("Votre compte a été supprimé définitivement.", { variant: "info" });
                navigate("/login");
            } else {
                const errorText = await response.text().catch(() => "");
                let msg = "Erreur lors de la suppression du compte.";
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
            enqueueSnackbar("Erreur lors de la suppression du compte.", { variant: "error" });
        } finally {
            setDeleteSaving(false);
        }
    };

    return (
        <div className="settings-page">
            <WrapperHeader>
                <h2>Paramètres du compte</h2>
            </WrapperHeader>

            <div className="settings-container">
                {/* Hero profile banner */}
                <div className="settings-hero">
                    <UserAvatar
                        avatar={session.user?.avatar || avatar}
                        name={session.user?.username || username}
                        size="xl"
                    />
                    <div className="settings-hero__info">
                        <span className="settings-hero__name">
                            {session.user?.username || username || "Lecteur"}
                        </span>
                        <span className="settings-hero__email">
                            {session.user?.email || ""}
                        </span>
                        <span className="settings-hero__badge">
                            <FontAwesomeIcon icon={faShieldHalved} /> Compte actif
                        </span>
                    </div>
                </div>

                {/* Section 1: Profil (Avatar Upload & Pseudo) */}
                <section className="settings-card">
                    <header className="settings-card__header">
                        <div className="settings-card__header-title">
                            <div className="settings-card__icon settings-card__icon--primary">
                                <FontAwesomeIcon icon={faUser} />
                            </div>
                            <div>
                                <h3>Profil & Avatar</h3>
                                <p className="settings-card__header-desc">
                                    Gérez votre image de profil et votre pseudonyme
                                </p>
                            </div>
                        </div>
                    </header>

                    <div className="settings-card__body">
                        {/* Compact Avatar Upload Section */}
                        <div className="avatar-compact">
                            <UserAvatar avatar={avatar} name={username} size="lg" />

                            <div className="avatar-compact__content">
                                <span className="avatar-compact__title">
                                    {avatar ? "Photo de profil active" : "Initiales par défaut"}
                                </span>

                                <div className="avatar-compact__actions">
                                    <label className="avatar-compact__upload-btn">
                                        {avatarUploading ? (
                                            <FontAwesomeIcon icon={faCircleNotch} spin />
                                        ) : (
                                            <FontAwesomeIcon icon={faCamera} />
                                        )}
                                        <span>{avatarUploading ? "Vérification..." : "Changer la photo"}</span>
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
                                            <span>Supprimer la photo</span>
                                        </button>
                                    )}
                                </div>

                                <div className="avatar-compact__meta">
                                    <span>Formats : <strong>JPG, PNG</strong> (max. 5 Mo).</span>
                                    <span className="avatar-compact__security-tag">
                                        <FontAwesomeIcon icon={faShieldHalved} /> Analyse de sécurité & assainissement
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Pseudo Form */}
                        <form onSubmit={handleUpdateUsername} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label htmlFor="settings-username">Pseudonyme</label>
                                <input
                                    id="settings-username"
                                    type="text"
                                    placeholder="Votre pseudonyme"
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
                                <span>{profileSaving ? "Enregistrement..." : "Enregistrer le pseudonyme"}</span>
                            </button>
                        </form>
                    </div>
                </section>

                {/* Section: Thème & Apparence */}
                <section className="settings-card">
                    <header className="settings-card__header">
                        <div className="settings-card__header-title">
                            <div className="settings-card__icon settings-card__icon--primary">
                                <FontAwesomeIcon icon={faPalette} />
                            </div>
                            <div>
                                <h3>Thème & Apparence</h3>
                                <p className="settings-card__header-desc">
                                    Choisissez le thème graphique appliqué à l'ensemble du site
                                </p>
                            </div>
                        </div>
                    </header>

                    <div className="settings-card__body">
                        <ThemeSelector />
                    </div>
                </section>

                {/* Section 2: Import Bookmory */}
                <section className="settings-card settings-import-card">
                    <header className="settings-card__header">
                        <div className="settings-card__header-title">
                            <div className="settings-card__icon settings-card__icon--import">
                                <FontAwesomeIcon icon={faFileImport} />
                            </div>
                            <div>
                                <h3>Import de sauvegarde Bookmory</h3>
                                <p className="settings-card__header-desc">
                                    Importez vos albums, couvertures, données d'achat et temps de lecture depuis un fichier .bookmory
                                </p>
                            </div>
                        </div>
                    </header>

                    <div className="settings-card__body">
                        <div className="import-info-box">
                            <div className="import-info-box__icon">
                                <FontAwesomeIcon icon={faInfoCircle} />
                            </div>
                            <div className="import-info-box__text">
                                <p><strong>Règles d'importation :</strong></p>
                                <ul>
                                    <li><strong>Albums existants :</strong> mise à jour de la couverture et des informations si différentes.</li>
                                    <li><strong>Nouveaux albums :</strong> création automatique avec métadonnées et couvertures de la sauvegarde.</li>
                                    <li><strong>Données d'achat :</strong> prix, date d'acquisition, lieu d'achat et mémo importés dans vos transactions.</li>
                                    <li><strong>Temps de lecture :</strong> sessions et durées chronométrées intégrées dans votre historique de lecture.</li>
                                </ul>
                            </div>
                        </div>

                        <div className="import-action-zone">
                            <label className={`import-dropzone ${importing ? "import-dropzone--disabled" : ""}`}>
                                <div className="import-dropzone__icon">
                                    {importing ? (
                                        <FontAwesomeIcon icon={faCircleNotch} spin />
                                    ) : (
                                        <FontAwesomeIcon icon={faCloudArrowUp} />
                                    )}
                                </div>
                                <div className="import-dropzone__text">
                                    <span className="import-dropzone__title">
                                        {importing ? "Importation en cours..." : "Sélectionner une sauvegarde .bookmory"}
                                    </span>
                                    <span className="import-dropzone__subtitle">
                                        Fichiers acceptés : <strong>.bookmory</strong> (ou archive zip)
                                    </span>
                                </div>
                                <input
                                    type="file"
                                    accept=".bookmory,.zip"
                                    disabled={importing}
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files.length > 0) {
                                            handleBookmoryFileSelected(e.target.files[0]);
                                            e.target.value = "";
                                        }
                                    }}
                                />
                            </label>
                        </div>

                        {/* Live progress during import */}
                        {importing && importJob && (
                            <div className="import-progress-card">
                                <div className="import-progress-card__header">
                                    <span className="import-progress-card__step">
                                        <FontAwesomeIcon icon={faArrowsRotate} spin /> {importJob.current_step}
                                    </span>
                                    <span className="import-progress-card__count">
                                        {importJob.processed_books} / {importJob.total_books || "?"} albums
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
                                    <span>Importation réussie avec succès !</span>
                                </div>
                                <div className="import-stats-grid">
                                    <div className="import-stat-item import-stat-item--green">
                                        <FontAwesomeIcon icon={faBook} />
                                        <div className="import-stat-item__content">
                                            <span className="import-stat-item__num">{importJob.created_books}</span>
                                            <span className="import-stat-item__label">Nouveaux albums créés</span>
                                        </div>
                                    </div>
                                    <div className="import-stat-item import-stat-item--blue">
                                        <FontAwesomeIcon icon={faBook} />
                                        <div className="import-stat-item__content">
                                            <span className="import-stat-item__num">{importJob.updated_books}</span>
                                            <span className="import-stat-item__label">Albums mis à jour</span>
                                        </div>
                                    </div>
                                    <div className="import-stat-item import-stat-item--amber">
                                        <FontAwesomeIcon icon={faReceipt} />
                                        <div className="import-stat-item__content">
                                            <span className="import-stat-item__num">{importJob.imported_purchases}</span>
                                            <span className="import-stat-item__label">Achats importés</span>
                                        </div>
                                    </div>
                                    <div className="import-stat-item import-stat-item--purple">
                                        <FontAwesomeIcon icon={faClock} />
                                        <div className="import-stat-item__content">
                                            <span className="import-stat-item__num">{importJob.imported_reading_sessions}</span>
                                            <span className="import-stat-item__label">Temps de lecture importés</span>
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
                                    <span>{importJob.errors.length} avertissement(s) lors de l'import :</span>
                                </div>
                                <ul>
                                    {importJob.errors.slice(0, 5).map((err, idx) => (
                                        <li key={idx}>{err}</li>
                                    ))}
                                    {importJob.errors.length > 5 && (
                                        <li>... et {importJob.errors.length - 5} autre(s)</li>
                                    )}
                                </ul>
                            </div>
                        )}
                    </div>
                </section>

                {/* Section 3: Zone Danger */}
                <section className="settings-danger-card">
                    <header className="settings-card__header">
                        <div className="settings-card__header-title">
                            <div className="settings-card__icon settings-card__icon--danger">
                                <FontAwesomeIcon icon={faTriangleExclamation} />
                            </div>
                            <div>
                                <h3>Zone Danger</h3>
                                <p className="settings-card__header-desc">
                                    Actions sensibles et destructives nécessitant une confirmation
                                </p>
                            </div>
                        </div>
                        <div className="settings-card__badge-danger">
                            <FontAwesomeIcon icon={faLock} />
                            <span>Confirmation requise</span>
                        </div>
                    </header>

                    <div className="settings-danger-card__list">
                        {/* Ligne 1: Adresse Email */}
                        <div className="settings-danger-card__item">
                            <div className="settings-danger-card__item-info">
                                <span className="settings-danger-card__item-title">Adresse email</span>
                                <span className="settings-danger-card__item-desc">
                                    Adresse actuelle : <strong>{session.user?.email || "Non définie"}</strong>
                                </span>
                            </div>
                            <button
                                type="button"
                                className="settings-danger-card__btn"
                                onClick={() => {
                                    setNewEmail("");
                                    setEmailCurrentPassword("");
                                    setIsEmailModalOpen(true);
                                }}
                            >
                                <FontAwesomeIcon icon={faEnvelope} />
                                <span>Changer d'email</span>
                            </button>
                        </div>

                        {/* Ligne 2: Mot de passe */}
                        <div className="settings-danger-card__item">
                            <div className="settings-danger-card__item-info">
                                <span className="settings-danger-card__item-title">Mot de passe</span>
                                <span className="settings-danger-card__item-desc">
                                    Renforcez la sécurité de votre compte avec un mot de passe robuste
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
                                <span>Changer de mot de passe</span>
                            </button>
                        </div>

                        {/* Ligne 3: Suppression de compte */}
                        <div className="settings-danger-card__item">
                            <div className="settings-danger-card__item-info">
                                <span className="settings-danger-card__item-title" style={{ color: "#f87171" }}>
                                    Supprimer mon compte
                                </span>
                                <span className="settings-danger-card__item-desc">
                                    Supprime définitivement votre compte, vos listes et toutes vos données
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
                                <span>Supprimer le compte</span>
                            </button>
                        </div>
                    </div>
                </section>
            </div>

            {/* Popup / Modal 1: Changer d'email */}
            {isEmailModalOpen && (
                <div className="settings-modal-backdrop" onClick={() => setIsEmailModalOpen(false)}>
                    <div className="settings-modal" onClick={(e) => e.stopPropagation()}>\
                        <header className="settings-modal__header">
                            <div className="settings-modal__title">
                                <FontAwesomeIcon icon={faEnvelope} />
                                <span>Changer d'adresse email</span>
                            </div>
                            <button
                                type="button"
                                className="settings-modal__close"
                                onClick={() => setIsEmailModalOpen(false)}
                                aria-label="Fermer"
                            >
                                <FontAwesomeIcon icon={faXmark} />
                            </button>
                        </header>

                        <form onSubmit={handleConfirmEmailChange}>
                            <div className="settings-modal__body">
                                <div className="settings-modal__warning">
                                    <FontAwesomeIcon icon={faTriangleExclamation} />
                                    <span>
                                        Cette action modifiera l'adresse avec laquelle vous vous connectez. Vous devez obligatoirement confirmer avec votre mot de passe actuel.
                                    </span>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="modal-new-email">Nouvelle adresse email</label>
                                    <input
                                        id="modal-new-email"
                                        type="email"
                                        placeholder="nouvelle-adresse@exemple.com"
                                        value={newEmail}
                                        onChange={(e) => setNewEmail(e.target.value)}
                                        required
                                        autoFocus
                                    />
                                </div>

                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label htmlFor="modal-email-pwd">Mot de passe actuel</label>
                                    <input
                                        id="modal-email-pwd"
                                        type="password"
                                        placeholder="Votre mot de passe actuel pour confirmer"
                                        value={emailCurrentPassword}
                                        onChange={(e) => setEmailCurrentPassword(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <footer className="settings-modal__footer">
                                <button
                                    type="button"
                                    className="settings-btn settings-btn--ghost"
                                    onClick={() => setIsEmailModalOpen(false)}
                                    disabled={emailSaving}
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    className="settings-btn settings-btn--danger"
                                    disabled={emailSaving}
                                >
                                    <FontAwesomeIcon icon={emailSaving ? faCircleNotch : faCheck} spin={emailSaving} />
                                    <span>{emailSaving ? "Modification..." : "Confirmer le changement d'email"}</span>
                                </button>
                            </footer>
                        </form>
                    </div>
                </div>
            )}

            {/* Popup / Modal 2: Changer de mot de passe */}
            {isPasswordModalOpen && (
                <div className="settings-modal-backdrop" onClick={() => setIsPasswordModalOpen(false)}>
                    <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
                        <header className="settings-modal__header">
                            <div className="settings-modal__title">
                                <FontAwesomeIcon icon={faLock} />
                                <span>Changer de mot de passe</span>
                            </div>
                            <button
                                type="button"
                                className="settings-modal__close"
                                onClick={() => setIsPasswordModalOpen(false)}
                                aria-label="Fermer"
                            >
                                <FontAwesomeIcon icon={faXmark} />
                            </button>
                        </header>

                        <form onSubmit={handleConfirmPasswordChange}>
                            <div className="settings-modal__body">
                                <div className="settings-modal__warning">
                                    <FontAwesomeIcon icon={faTriangleExclamation} />
                                    <span>
                                        Pour des raisons de sécurité, vous devez renseigner votre mot de passe actuel pour définir un nouveau mot de passe.
                                    </span>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="modal-current-pwd">Mot de passe actuel</label>
                                    <input
                                        id="modal-current-pwd"
                                        type="password"
                                        placeholder="Votre mot de passe actuel"
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        required
                                        autoFocus
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="modal-new-pwd">Nouveau mot de passe (min. 6 caractères)</label>
                                    <input
                                        id="modal-new-pwd"
                                        type="password"
                                        placeholder="Nouveau mot de passe"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        minLength={6}
                                        required
                                    />
                                </div>

                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label htmlFor="modal-confirm-pwd">Confirmer le nouveau mot de passe</label>
                                    <input
                                        id="modal-confirm-pwd"
                                        type="password"
                                        placeholder="Confirmez le nouveau mot de passe"
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
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    className="settings-btn settings-btn--danger"
                                    disabled={passwordSaving}
                                >
                                    <FontAwesomeIcon icon={passwordSaving ? faCircleNotch : faCheck} spin={passwordSaving} />
                                    <span>{passwordSaving ? "Modification..." : "Confirmer le changement de mot de passe"}</span>
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
                                <span>Supprimer définitivement le compte</span>
                            </div>
                            <button
                                type="button"
                                className="settings-modal__close"
                                onClick={() => setIsDeleteModalOpen(false)}
                                aria-label="Fermer"
                            >
                                <FontAwesomeIcon icon={faXmark} />
                            </button>
                        </header>

                        <form onSubmit={handleConfirmDeleteAccount}>
                            <div className="settings-modal__body">
                                <div className="settings-modal__warning">
                                    <FontAwesomeIcon icon={faTriangleExclamation} />
                                    <span>
                                        Attention : cette action est <strong>irréversible</strong>. Toutes vos données de compte, votre bibliothèque et vos souhaits seront supprimés sans possibilité de récupération.
                                    </span>
                                </div>

                                <div className="form-group">
                                    <label>
                                        Recopiez la phrase suivante pour confirmer :
                                    </label>
                                    <div className="modal-confirm-quote">
                                        {REQUIRED_DELETE_PHRASE}
                                    </div>
                                    <input
                                        type="text"
                                        placeholder={REQUIRED_DELETE_PHRASE}
                                        value={deleteConfirmationText}
                                        onChange={(e) => setDeleteConfirmationText(e.target.value)}
                                        required
                                        autoFocus
                                    />
                                </div>

                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label htmlFor="modal-delete-pwd">Mot de passe actuel</label>
                                    <input
                                        id="modal-delete-pwd"
                                        type="password"
                                        placeholder="Votre mot de passe pour confirmer la suppression"
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
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    className="settings-btn settings-btn--danger"
                                    disabled={deleteSaving}
                                >
                                    <FontAwesomeIcon icon={deleteSaving ? faCircleNotch : faCheck} spin={deleteSaving} />
                                    <span>{deleteSaving ? "Suppression en cours..." : "Confirmer la suppression définitive"}</span>
                                </button>
                            </footer>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
