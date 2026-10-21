import { useState, useEffect, type FormEvent, type ChangeEvent } from "react";
import { enqueueSnackbar } from "notistack";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faUser,
    faEnvelope,
    faLock,
    faShieldHalved,
    faCheck,
    faRotateLeft,
    faCloudArrowUp,
    faTriangleExclamation,
    faXmark,
    faCircleNotch
} from "@fortawesome/free-solid-svg-icons";

import useSession from "../../hooks/UseSession.tsx";
import { WrapperHeader } from "../../components/Wrapper/Wrapper.tsx";
import UserAvatar from "../../components/UserAvatar/UserAvatar.tsx";
import "./SettingsPage.scss";

const PRESET_AVATARS = [
    "📚", "🧙‍♂️", "🧝‍♀️", "🐉", "🦊", "🐱",
    "🦉", "🤖", "🕵️‍♂️", "🚀", "☕", "⚔️",
    "✨", "🪐", "🎨", "👑"
];

export default function SettingsPage() {
    const session = useSession();

    // Profile state
    const [username, setUsername] = useState("");
    const [avatar, setAvatar] = useState("");
    const [profileSaving, setProfileSaving] = useState(false);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);

    // Modal states for Danger Zone
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

    // Email modal fields
    const [newEmail, setNewEmail] = useState("");
    const [emailCurrentPassword, setEmailCurrentPassword] = useState("");
    const [emailSaving, setEmailSaving] = useState(false);

    // Password modal fields
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [passwordSaving, setPasswordSaving] = useState(false);

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

    // Handle File Upload with Security Analysis
    const handleFileUpload = async (file: File) => {
        // Client-side pre-checks
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

    // Preset emoji or reset avatar
    const handleSetEmojiAvatar = async (selectedAvatar: string) => {
        setAvatar(selectedAvatar);
        try {
            const response = await session.customFetch("/user/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: username.trim() || session.user?.username,
                    avatar: selectedAvatar
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.token) {
                    session.updateToken(data.token);
                } else {
                    session.updateUser({ avatar: selectedAvatar });
                }
                enqueueSnackbar(selectedAvatar ? "Avatar modifié !" : "Avatar réinitialisé avec succès.", { variant: "success" });
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
                                    Téléversez une photo de profil ou choisissez un avatar personnalisé
                                </p>
                            </div>
                        </div>
                    </header>

                    <div className="settings-card__body">
                        {/* Avatar management */}
                        <div className="avatar-section">
                            <div className="avatar-section__current">
                                <UserAvatar avatar={avatar} name={username} size="lg" />
                                <div className="avatar-section__info">
                                    <span className="avatar-section__type">
                                        {avatar ? (avatar.startsWith("/") || avatar.startsWith("http") ? "Photo de profil personnalisée" : `Avatar emoji (${avatar})`) : "Initiales par défaut"}
                                    </span>
                                    {avatar && (
                                        <button
                                            type="button"
                                            className="avatar-section__reset-btn"
                                            onClick={() => handleSetEmojiAvatar("")}
                                        >
                                            <FontAwesomeIcon icon={faRotateLeft} style={{ marginRight: 6 }} />
                                            Supprimer et revenir aux initiales
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Image File Upload with Security Analysis */}
                            <div
                                className={`avatar-dropzone ${isDragOver ? 'avatar-dropzone--active' : ''}`}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    setIsDragOver(true);
                                }}
                                onDragLeave={() => setIsDragOver(false)}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setIsDragOver(false);
                                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                        handleFileUpload(e.dataTransfer.files[0]);
                                    }
                                }}
                            >
                                <input
                                    type="file"
                                    className="avatar-dropzone__input"
                                    accept="image/png, image/jpeg, image/jpg"
                                    onChange={handleFileInputChange}
                                    disabled={avatarUploading}
                                />
                                <div className="avatar-dropzone__icon">
                                    {avatarUploading ? (
                                        <FontAwesomeIcon icon={faCircleNotch} spin />
                                    ) : (
                                        <FontAwesomeIcon icon={faCloudArrowUp} />
                                    )}
                                </div>
                                <span className="avatar-dropzone__label">
                                    {avatarUploading ? "Analyse de sécurité & téléversement en cours..." : <><span>Cliquez pour parcourir</span> ou glissez-déposez une image</>}
                                </span>
                                <span className="avatar-dropzone__hint">
                                    Fichiers acceptés : <strong>JPG, PNG</strong> (max. 5 Mo).
                                </span>
                                <span className="avatar-dropzone__security-badge">
                                    <FontAwesomeIcon icon={faShieldHalved} /> Analyse antivirus, vérification des octets magiques & assainissement automatique
                                </span>
                            </div>

                            {/* Emoji presets */}
                            <div className="avatar-presets">
                                <span className="avatar-presets__label">Ou choisissez un avatar emoji :</span>
                                <div className="avatar-presets__grid">
                                    {PRESET_AVATARS.map((emoji) => (
                                        <button
                                            key={emoji}
                                            type="button"
                                            className={`avatar-presets__btn ${avatar === emoji ? 'avatar-presets__btn--selected' : ''}`}
                                            onClick={() => handleSetEmojiAvatar(emoji)}
                                            title={`Sélectionner ${emoji}`}
                                        >
                                            {emoji}
                                        </button>
                                    ))}
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

                {/* Section 2: Zone Danger */}
                <section className="settings-danger-card">
                    <header className="settings-card__header">
                        <div className="settings-card__header-title">
                            <div className="settings-card__icon settings-card__icon--danger">
                                <FontAwesomeIcon icon={faTriangleExclamation} />
                            </div>
                            <div>
                                <h3>Zone Danger</h3>
                                <p className="settings-card__header-desc">
                                    Actions sensibles modifiant vos identifiants d'accès
                                </p>
                            </div>
                        </div>
                        <div className="settings-card__badge-danger">
                            <FontAwesomeIcon icon={faLock} />
                            <span>Confirmation par mot de passe requise</span>
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
                    </div>
                </section>
            </div>

            {/* Popup / Modal 1: Changer d'email */}
            {isEmailModalOpen && (
                <div className="settings-modal-backdrop" onClick={() => setIsEmailModalOpen(false)}>
                    <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
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
        </div>
    );
}
