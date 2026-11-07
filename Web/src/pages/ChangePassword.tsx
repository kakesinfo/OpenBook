import { useState } from "react";
import useSession from "../hooks/UseSession.tsx";
import useLanguage from "../hooks/UseLanguage.tsx";
import { useNavigate } from "react-router";
import { enqueueSnackbar } from "notistack";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faKey, faLock, faArrowRightFromBracket, faCheck, faCircleNotch } from "@fortawesome/free-solid-svg-icons";

import Card from "../components/Card/Card.tsx";
import FormGroup from "../components/Form/FormGroup.tsx";
import "./Auth.scss";

export default function ChangePassword() {
    const [currentPassword, setCurrentPassword] = useState<string>("");
    const [newPassword, setNewPassword] = useState<string>("");
    const [confirmPassword, setConfirmPassword] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);

    const session = useSession();
    const { tr } = useLanguage();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (loading) return;

        if (!currentPassword) {
            return enqueueSnackbar(
                tr("Please enter your current temporary password.", "Veuillez saisir votre mot de passe actuel / provisoire."),
                { variant: "error" }
            );
        }

        if (!newPassword || newPassword.length < 6) {
            return enqueueSnackbar(
                tr("New password must be at least 6 characters long.", "Le nouveau mot de passe doit comporter au moins 6 caractères."),
                { variant: "error" }
            );
        }

        if (newPassword !== confirmPassword) {
            return enqueueSnackbar(
                tr("Passwords do not match.", "La confirmation ne correspond pas au nouveau mot de passe."),
                { variant: "error" }
            );
        }

        if (newPassword === currentPassword) {
            return enqueueSnackbar(
                tr("The new password must be different from the temporary password.", "Le nouveau mot de passe doit être différent du mot de passe provisoire."),
                { variant: "error" }
            );
        }

        setLoading(true);
        try {
            const response = await session.customFetch("/user/password", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentPassword, newPassword }),
            });

            if (response.ok) {
                const data = await response.json();
                if (data.token) {
                    session.updateToken(data.token);
                } else {
                    session.updateUser({ mustChangePassword: false });
                }

                enqueueSnackbar(
                    tr("Password updated successfully! Welcome.", "Mot de passe mis à jour avec succès ! Bienvenue."),
                    { variant: "success" }
                );

                if (session.isAdmin) {
                    navigate("/app/admin/indexation", { replace: true });
                } else {
                    navigate("/app/home", { replace: true });
                }
                return;
            }

            const errorText = await response.text().catch(() => "");
            let errorMessage = tr("Failed to update password.", "Erreur lors de la modification du mot de passe.");
            if (errorText) {
                try {
                    const parsed = JSON.parse(errorText);
                    errorMessage = parsed.message || parsed.error || errorText;
                } catch {
                    errorMessage = errorText;
                }
            }
            enqueueSnackbar(errorMessage, { variant: "error" });
        } catch (error) {
            console.error(error);
            enqueueSnackbar(
                tr("An unexpected error occurred.", "Une erreur inattendue est survenue."),
                { variant: "error" }
            );
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await session.logout();
        navigate("/login", { replace: true });
    };

    return (
        <div className="auth-page">
            <div className="auth-page__container">
                <div className="auth-page__header">
                    <div className="auth-page__logo" style={{ background: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)" }}>
                        <FontAwesomeIcon icon={faKey} />
                    </div>
                    <h1 className="auth-page__title">
                        {tr("Password change required", "Changement de mot de passe obligatoire")}
                    </h1>
                    <p className="auth-page__subtitle">
                        {tr(
                            "First login: For security reasons, you must change your temporary password before accessing your account.",
                            "Première connexion : Pour des raisons de sécurité, vous devez modifier votre mot de passe temporaire avant d'accéder à l'application."
                        )}
                    </p>
                </div>

                <Card>
                    <form onSubmit={handleSubmit}>
                        <FormGroup>
                            <label htmlFor="current-password">
                                <FontAwesomeIcon icon={faLock} style={{ marginRight: 6 }} />
                                {tr("Current temporary password", "Mot de passe provisoire actuel")}
                            </label>
                            <input
                                id="current-password"
                                type="password"
                                name="current-password"
                                autoComplete="current-password"
                                placeholder="••••••••"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                required
                            />
                        </FormGroup>

                        <FormGroup>
                            <label htmlFor="new-password">
                                <FontAwesomeIcon icon={faKey} style={{ marginRight: 6 }} />
                                {tr("New password (min. 6 characters)", "Nouveau mot de passe (min. 6 caractères)")}
                            </label>
                            <input
                                id="new-password"
                                type="password"
                                name="new-password"
                                autoComplete="new-password"
                                placeholder="••••••••"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                            />
                        </FormGroup>

                        <FormGroup>
                            <label htmlFor="confirm-password">
                                <FontAwesomeIcon icon={faKey} style={{ marginRight: 6 }} />
                                {tr("Confirm new password", "Confirmer le nouveau mot de passe")}
                            </label>
                            <input
                                id="confirm-password"
                                type="password"
                                name="confirm-password"
                                autoComplete="new-password"
                                placeholder="••••••••"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                            />
                        </FormGroup>

                        <FormGroup>
                            <button type="submit" disabled={loading}>
                                <FontAwesomeIcon icon={loading ? faCircleNotch : faCheck} spin={loading} style={{ marginRight: 8 }} />
                                {loading
                                    ? tr("Saving...", "Enregistrement...")
                                    : tr("Save new password", "Enregistrer le mot de passe")}
                            </button>
                        </FormGroup>

                        <FormGroup>
                            <button
                                type="button"
                                onClick={handleLogout}
                                style={{
                                    background: "transparent",
                                    color: "var(--text-muted, #94a3b8)",
                                    border: "1px solid var(--border-subtle, #334155)",
                                    boxShadow: "none"
                                }}
                            >
                                <FontAwesomeIcon icon={faArrowRightFromBracket} style={{ marginRight: 8 }} />
                                {tr("Log out", "Se déconnecter")}
                            </button>
                        </FormGroup>
                    </form>
                </Card>
            </div>
        </div>
    );
}
