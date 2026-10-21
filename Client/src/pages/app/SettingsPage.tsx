import { useState, useEffect, type FormEvent } from "react";
import { enqueueSnackbar } from "notistack";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faUser,
    faEnvelope,
    faLock,
    faShieldHalved,
    faCheck,
    faRotateLeft,
    faImage,
    faTriangleExclamation
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
    const [customAvatarUrl, setCustomAvatarUrl] = useState("");
    const [profileSaving, setProfileSaving] = useState(false);

    // Email state (Destructive)
    const [newEmail, setNewEmail] = useState("");
    const [emailCurrentPassword, setEmailCurrentPassword] = useState("");
    const [emailSaving, setEmailSaving] = useState(false);

    // Password state (Destructive)
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [passwordSaving, setPasswordSaving] = useState(false);

    // Load initial profile data
    useEffect(() => {
        if (session.user) {
            setUsername(session.user.username || "");
            setNewEmail(session.user.email || "");
            const currentAv = session.user.avatar || "";
            setAvatar(currentAv);
            if (currentAv.startsWith("http://") || currentAv.startsWith("https://") || currentAv.startsWith("data:image")) {
                setCustomAvatarUrl(currentAv);
            }
        }

        session.customFetch("/user/profile", { method: "GET" })
            .then(async (res) => {
                if (res.ok) {
                    const data = await res.json();
                    if (data.username) setUsername(data.username);
                    if (data.email) setNewEmail(data.email);
                    if (data.avatar !== undefined && data.avatar !== null) {
                        setAvatar(data.avatar);
                        if (data.avatar.startsWith("http://") || data.avatar.startsWith("https://") || data.avatar.startsWith("data:image")) {
                            setCustomAvatarUrl(data.avatar);
                        }
                    }
                }
            })
            .catch((err) => {
                console.error("Error fetching user profile:", err);
            });
    }, [session]);

    // Handle Profile Update (Pseudo + Avatar)
    const handleUpdateProfile = async (e: FormEvent) => {
        e.preventDefault();
        const trimmedUsername = username.trim();
        if (!trimmedUsername) {
            enqueueSnackbar("Le pseudonyme ne peut pas être vide.", { variant: "error" });
            return;
        }

        setProfileSaving(true);
        try {
            const response = await session.customFetch("/user/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: trimmedUsername,
                    avatar: avatar
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.token) {
                    session.updateToken(data.token);
                } else {
                    session.updateUser({ username: trimmedUsername, avatar });
                }
                enqueueSnackbar("Profil mis à jour avec succès !", { variant: "success" });
            } else {
                const errorText = await response.text().catch(() => "");
                let msg = "Erreur lors de la mise à jour du profil.";
                try {
                    const parsed = JSON.parse(errorText);
                    msg = parsed.message || parsed.error || errorText;
                } catch {
                    if (errorText) msg = errorText;
                }
                enqueueSnackbar(msg, { variant: "error" });
            }
        } catch (err) {
            console.error("Update profile error:", err);
            enqueueSnackbar("Impossible de mettre à jour le profil. Vérifiez votre connexion.", { variant: "error" });
        } finally {
            setProfileSaving(false);
        }
    };

    // Handle Email Update (Destructive - requires current password confirmation)
    const handleUpdateEmail = async (e: FormEvent) => {
        e.preventDefault();
        const trimmedEmail = newEmail.trim();

        if (!trimmedEmail) {
            enqueueSnackbar("Veuillez saisir une adresse email.", { variant: "error" });
            return;
        }

        if (!emailCurrentPassword) {
            enqueueSnackbar("Votre mot de passe actuel est obligatoire pour confirmer le changement d'adresse email.", { variant: "error" });
            return;
        }

        setEmailSaving(true);
        try {
            const response = await session.customFetch("/user/email", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: trimmedEmail,
                    currentPassword: emailCurrentPassword
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.token) {
                    session.updateToken(data.token);
                } else {
                    session.updateUser({ email: trimmedEmail });
                }
                setEmailCurrentPassword("");
                enqueueSnackbar("Adresse email mise à jour avec succès !", { variant: "success" });
            } else {
                const errorText = await response.text().catch(() => "");
                let msg = "Erreur lors de la mise à jour de l'adresse email.";
                try {
                    const parsed = JSON.parse(errorText);
                    msg = parsed.message || parsed.error || errorText;
                } catch {
                    if (errorText) msg = errorText;
                }
                enqueueSnackbar(msg, { variant: "error" });
            }
        } catch (err) {
            console.error("Update email error:", err);
            enqueueSnackbar("Impossible de modifier l'email. Vérifiez votre connexion.", { variant: "error" });
        } finally {
            setEmailSaving(false);
        }
    };

    // Handle Password Update (Destructive - requires current password confirmation)
    const handleUpdatePassword = async (e: FormEvent) => {
        e.preventDefault();

        if (!currentPassword) {
            enqueueSnackbar("Votre mot de passe actuel est requis pour autoriser la modification.", { variant: "error" });
            return;
        }

        if (!newPassword || newPassword.length < 6) {
            enqueueSnackbar("Le nouveau mot de passe doit comporter au moins 6 caractères.", { variant: "error" });
            return;
        }

        if (newPassword !== confirmPassword) {
            enqueueSnackbar("La confirmation du mot de passe ne correspond pas au nouveau mot de passe.", { variant: "error" });
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
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
                enqueueSnackbar("Mot de passe modifié avec succès !", { variant: "success" });
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
            console.error("Update password error:", err);
            enqueueSnackbar("Impossible de modifier le mot de passe. Vérifiez votre connexion.", { variant: "error" });
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
                {/* Hero Profile Summary */}
                <div className="settings-hero">
                    <UserAvatar avatar={session.user?.avatar || avatar} name={session.user?.username || username} size="xl" />
                    <div className="settings-hero__info">
                        <span className="settings-hero__name">
                            {session.user?.username || username || "Lecteur"}
                        </span>
                        <span className="settings-hero__email">
                            {session.user?.email || newEmail || ""}
                        </span>
                        <span className="settings-hero__badge">
                            <FontAwesomeIcon icon={faShieldHalved} /> Compte actif
                        </span>
                    </div>
                </div>

                {/* Section 1: Profil (Avatar & Pseudo) */}
                <section className="settings-card">
                    <header className="settings-card__header">
                        <div className="settings-card__header-title">
                            <div className="settings-card__icon settings-card__icon--primary">
                                <FontAwesomeIcon icon={faUser} />
                            </div>
                            <div>
                                <h3>Profil & Avatar</h3>
                                <p className="settings-card__header-desc">
                                    Modifiez votre pseudonyme et l'avatar visible dans votre bibliothèque
                                </p>
                            </div>
                        </div>
                    </header>

                    <form className="settings-card__body" onSubmit={handleUpdateProfile}>
                        {/* Avatar Picker */}
                        <div className="avatar-selector">
                            <label className="avatar-selector__presets-label">Avatar</label>
                            <div className="avatar-selector__preview-row">
                                <UserAvatar avatar={avatar} name={username} size="lg" />
                                <div className="avatar-selector__preview-details">
                                    <span>
                                        {avatar ? (avatar.startsWith("http") ? "Image externe sélectionnée" : `Emoji avatar (${avatar})`) : "Initiales par défaut"}
                                    </span>
                                    {avatar && (
                                        <button
                                            type="button"
                                            className="avatar-selector__reset-btn"
                                            onClick={() => {
                                                setAvatar("");
                                                setCustomAvatarUrl("");
                                            }}
                                        >
                                            <FontAwesomeIcon icon={faRotateLeft} style={{ marginRight: 6 }} />
                                            Utiliser mes initiales
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Preset Emojis */}
                            <span className="avatar-selector__presets-label">Choisir un emoji :</span>
                            <div className="avatar-selector__presets">
                                {PRESET_AVATARS.map((emoji) => (
                                    <button
                                        key={emoji}
                                        type="button"
                                        className={`avatar-selector__preset-btn ${avatar === emoji ? 'avatar-selector__preset-btn--selected' : ''}`}
                                        onClick={() => {
                                            setAvatar(emoji);
                                            setCustomAvatarUrl("");
                                        }}
                                        title={`Choisir ${emoji}`}
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>

                            {/* Custom URL Input */}
                            <div className="form-group" style={{ marginBottom: 0, marginTop: 8 }}>
                                <label>
                                    <span>
                                        <FontAwesomeIcon icon={faImage} style={{ marginRight: 6 }} />
                                        Ou URL d'une image d'avatar :
                                    </span>
                                </label>
                                <input
                                    type="url"
                                    placeholder="https://exemple.com/avatar.png"
                                    value={customAvatarUrl}
                                    onChange={(e) => {
                                        setCustomAvatarUrl(e.target.value);
                                        setAvatar(e.target.value);
                                    }}
                                />
                            </div>
                        </div>

                        {/* Pseudo Input */}
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label htmlFor="settings-username">Pseudonyme</label>
                            <input
                                id="settings-username"
                                type="text"
                                placeholder="Votre pseudo"
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
                            <span>{profileSaving ? "Enregistrement..." : "Enregistrer le profil"}</span>
                        </button>
                    </form>
                </section>

                {/* Section 2: Adresse Email (Destructive - requires current password) */}
                <section className="settings-card settings-card--destructive">
                    <header className="settings-card__header">
                        <div className="settings-card__header-title">
                            <div className="settings-card__icon settings-card__icon--warning">
                                <FontAwesomeIcon icon={faEnvelope} />
                            </div>
                            <div>
                                <h3>Adresse Email</h3>
                                <p className="settings-card__header-desc">
                                    Modifiez l'adresse email servant d'identifiant de connexion
                                </p>
                            </div>
                        </div>
                        <div className="settings-card__security-badge">
                            <FontAwesomeIcon icon={faLock} />
                            <span>Confirmation requise</span>
                        </div>
                    </header>

                    <form className="settings-card__body" onSubmit={handleUpdateEmail}>
                        <div className="settings-destructive-notice">
                            <FontAwesomeIcon icon={faTriangleExclamation} />
                            <span>
                                La modification de l'adresse email modifie vos identifiants de connexion. Vous devez confirmer cette action avec votre mot de passe actuel.
                            </span>
                        </div>

                        <div className="form-group">
                            <label htmlFor="settings-email">Nouvelle adresse email</label>
                            <input
                                id="settings-email"
                                type="email"
                                placeholder="nouvelle-adresse@exemple.com"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label htmlFor="settings-email-current-pwd">
                                Mot de passe actuel (Confirmation obligatoire)
                            </label>
                            <input
                                id="settings-email-current-pwd"
                                type="password"
                                placeholder="Saisissez votre mot de passe actuel"
                                value={emailCurrentPassword}
                                onChange={(e) => setEmailCurrentPassword(e.target.value)}
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className="settings-btn settings-btn--danger"
                            disabled={emailSaving}
                        >
                            <FontAwesomeIcon icon={faEnvelope} />
                            <span>{emailSaving ? "Mise à jour en cours..." : "Confirmer et modifier l'adresse email"}</span>
                        </button>
                    </form>
                </section>

                {/* Section 3: Mot de passe & Sécurité (Destructive - requires current password) */}
                <section className="settings-card settings-card--destructive">
                    <header className="settings-card__header">
                        <div className="settings-card__header-title">
                            <div className="settings-card__icon settings-card__icon--danger">
                                <FontAwesomeIcon icon={faLock} />
                            </div>
                            <div>
                                <h3>Mot de passe & Sécurité</h3>
                                <p className="settings-card__header-desc">
                                    Changez votre mot de passe pour sécuriser votre compte
                                </p>
                            </div>
                        </div>
                        <div className="settings-card__security-badge">
                            <FontAwesomeIcon icon={faLock} />
                            <span>Confirmation requise</span>
                        </div>
                    </header>

                    <form className="settings-card__body" onSubmit={handleUpdatePassword}>
                        <div className="settings-destructive-notice">
                            <FontAwesomeIcon icon={faTriangleExclamation} />
                            <span>
                                Pour votre sécurité, la saisie de votre mot de passe actuel est indispensable pour enregistrer un nouveau mot de passe.
                            </span>
                        </div>

                        <div className="form-group">
                            <label htmlFor="settings-current-pwd">Mot de passe actuel</label>
                            <input
                                id="settings-current-pwd"
                                type="password"
                                placeholder="Votre mot de passe actuel"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="settings-new-pwd">Nouveau mot de passe (min. 6 caractères)</label>
                            <input
                                id="settings-new-pwd"
                                type="password"
                                placeholder="Nouveau mot de passe"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                minLength={6}
                                required
                            />
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label htmlFor="settings-confirm-pwd">Confirmer le nouveau mot de passe</label>
                            <input
                                id="settings-confirm-pwd"
                                type="password"
                                placeholder="Confirmez le nouveau mot de passe"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                minLength={6}
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className="settings-btn settings-btn--danger"
                            disabled={passwordSaving}
                        >
                            <FontAwesomeIcon icon={faLock} />
                            <span>{passwordSaving ? "Modification en cours..." : "Confirmer et modifier le mot de passe"}</span>
                        </button>
                    </form>
                </section>
            </div>
        </div>
    );
}
