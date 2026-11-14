import { useState } from "react";
import { useNavigate } from "react-router";
import { enqueueSnackbar } from "notistack";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faServer,
    faCircleInfo,
    faSpinner,
    faUser,
    faLock,
    faArrowRight
} from "@fortawesome/free-solid-svg-icons";
import useSession from "../hooks/UseSession.tsx";
import useLanguage from "../hooks/UseLanguage.tsx";
import { API_URL } from "../config/api.ts";
import Card from "../components/Card/Card.tsx";
import FormGroup from "../components/Form/FormGroup.tsx";
import "./SetupPage.scss";

export default function SetupPage() {
    const [username, setUsername] = useState("admin");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const session = useSession();
    const { tr } = useLanguage();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (loading) return;

        const trimmedUser = username.trim();

        if (!trimmedUser || trimmedUser.length < 3) {
            return enqueueSnackbar(tr("Username must be at least 3 characters long.", "Le nom d'utilisateur doit contenir au moins 3 caractères."), { variant: "error" });
        }

        if (!password || password.length < 6) {
            return enqueueSnackbar(tr("Password must be at least 6 characters long.", "Le mot de passe doit contenir au moins 6 caractères."), { variant: "error" });
        }

        if (password !== confirmPassword) {
            return enqueueSnackbar(tr("Passwords do not match.", "Les deux mots de passe ne correspondent pas."), { variant: "error" });
        }

        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/setup/admin`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    username: trimmedUser,
                    password: password
                })
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => null);
                const message = errorData?.message || tr("Error configuring administrator.", "Erreur lors de la configuration de l'administrateur.");
                enqueueSnackbar(message, { variant: "error" });
                return;
            }

            const data = await res.json();
            if (data.token) {
                session.updateToken(data.token);
                await session.checkSetupStatus();
                enqueueSnackbar(tr("Server configured successfully! Welcome to administration.", "Serveur configuré avec succès ! Bienvenue dans l'administration."), { variant: "success" });
                navigate("/app/admin/indexation", { replace: true });
            }
        } catch (err) {
            console.error("Setup error:", err);
            enqueueSnackbar(tr("Unable to reach server for initial setup.", "Impossible de joindre le serveur pour la configuration initiale."), { variant: "error" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="setup-page">
            <div className="setup-page__container">
                <div className="setup-page__header">
                    <div className="setup-page__badge">
                        <FontAwesomeIcon icon={faServer} />
                        <span>{tr("First Launch", "Premier Lancement")}</span>
                    </div>
                    <h1 className="setup-page__title">OpenBook</h1>
                    <p className="setup-page__subtitle">
                        {tr("Complete server configuration.", "Finalisez la configuration du serveur.")}
                    </p>
                </div>

                <Card>
                    <div className="setup-page__notice">
                        <FontAwesomeIcon icon={faCircleInfo} />
                        <div>
                            <strong>{tr("Dedicated Administrator Access:", "Accès Administrateur dédié :")}</strong> {tr("This account has exclusive access to server administration. It does not have a personal reading library.", "Ce compte a un accès exclusif à l'administration du serveur. Il ne dispose pas de bibliothèque personnelle de lecture.")}
                        </div>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <FormGroup>
                            <label htmlFor="admin-username" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <FontAwesomeIcon icon={faUser} style={{ fontSize: "0.8rem", color: "var(--text-muted)" }} />
                                <span>{tr("Administrator account name *", "Nom du compte administrateur *")}</span>
                            </label>
                            <input
                                id="admin-username"
                                type="text"
                                name="username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder={tr("e.g., admin", "ex: admin")}
                                required
                                autoComplete="username"
                            />
                        </FormGroup>

                        <FormGroup>
                            <label htmlFor="admin-password" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <FontAwesomeIcon icon={faLock} style={{ fontSize: "0.8rem", color: "var(--text-muted)" }} />
                                <span>{tr("Administrator password *", "Mot de passe administrateur *")}</span>
                            </label>
                            <input
                                id="admin-password"
                                type="password"
                                name="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={tr("Minimum 6 characters", "Minimum 6 caractères")}
                                required
                                autoComplete="new-password"
                            />
                        </FormGroup>

                        <FormGroup>
                            <label htmlFor="admin-confirm-password" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <FontAwesomeIcon icon={faLock} style={{ fontSize: "0.8rem", color: "var(--text-muted)" }} />
                                <span>{tr("Confirm password *", "Confirmer le mot de passe *")}</span>
                            </label>
                            <input
                                id="admin-confirm-password"
                                type="password"
                                name="confirmPassword"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder={tr("Re-enter password", "Retapez le mot de passe")}
                                required
                                autoComplete="new-password"
                            />
                        </FormGroup>

                        <button
                            type="submit"
                            className="setup-page__submit-btn"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <FontAwesomeIcon icon={faSpinner} spin />
                                    <span>{tr("Configuring...", "Configuration en cours...")}</span>
                                </>
                            ) : (
                                <>
                                    <span>{tr("Finish and open administration", "Finaliser et ouvrir l'administration")}</span>
                                    <FontAwesomeIcon icon={faArrowRight} />
                                </>
                            )}
                        </button>
                    </form>
                </Card>
            </div>
        </div>
    );
}
