import { useState } from "react";
import useSession from "../hooks/UseSession.tsx";
import useLanguage from "../hooks/UseLanguage.tsx";
import { useNavigate } from 'react-router';
import { enqueueSnackbar } from "notistack";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBookOpen } from "@fortawesome/free-solid-svg-icons";

import Card from "../components/Card/Card.tsx";
import FormGroup from "../components/Form/FormGroup.tsx";
import "./Auth.scss";

export default function Login() {
    const [username, setUsername] = useState<string>("");
    const [password, setPassword] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);

    const session = useSession();
    const { tr } = useLanguage();
    const navigate = useNavigate();

    const handleLogin = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (loading) return;

        const trimmedUsername = username.trim();
        if (!trimmedUsername || !password) {
            return enqueueSnackbar(tr("Please enter your username and password", "Veuillez saisir votre nom d'utilisateur et mot de passe"), { variant: "error" });
        }

        setLoading(true);
        try {
            const result = await session.login(trimmedUsername, password);

            if (!result.success) {
                setPassword("");
                return enqueueSnackbar(result.error || tr("Invalid username or password", "Nom d'utilisateur ou mot de passe invalide"), { variant: "error" });
            }

            if (result.mustChangePassword) {
                navigate('/change-password');
                enqueueSnackbar(tr("First login: Please set your new password.", "Première connexion : Veuillez définir votre nouveau mot de passe."), { variant: "info" });
                return;
            }

            navigate('/app');
            enqueueSnackbar(tr("Welcome!", "Bienvenue !"), { variant: "success" });
        } catch (error) {
            console.error(error);
            enqueueSnackbar(tr("An unexpected error occurred", "Une erreur inattendue est survenue"), { variant: "error" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-page__container">
                <div className="auth-page__header">
                    <div className="auth-page__logo">
                        <FontAwesomeIcon icon={faBookOpen} />
                    </div>
                    <h1 className="auth-page__title">Yet Another Library</h1>
                    <p className="auth-page__subtitle">{tr("Sign in to your personal library", "Connectez-vous à votre bibliothèque personnelle")}</p>
                </div>

                <Card>
                    <form onSubmit={handleLogin}>
                        <FormGroup>
                            <label htmlFor="username">{tr("Username", "Nom d'utilisateur")}</label>
                            <input
                                id="username"
                                type="text"
                                name="username"
                                autoComplete="username"
                                placeholder={tr("e.g., admin", "ex: admin")}
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                            />
                        </FormGroup>

                        <FormGroup>
                            <label htmlFor="password">{tr("Password", "Mot de passe")}</label>
                            <input
                                id="password"
                                type="password"
                                name="password"
                                autoComplete="current-password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </FormGroup>

                        <FormGroup>
                            <button type="submit" disabled={loading}>
                                {loading ? tr("Signing in...", "Connexion en cours...") : tr("Sign in", "Se connecter")}
                            </button>
                        </FormGroup>
                    </form>
                </Card>
            </div>
        </div>
    );
}
