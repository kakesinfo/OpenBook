import { useState } from "react";
import useSession from "../hooks/UseSession.tsx";
import { Link, useNavigate } from 'react-router';
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
    const navigate = useNavigate();

    const handleLogin = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (loading) return;

        const trimmedUsername = username.trim();
        if (!trimmedUsername || !password) {
            return enqueueSnackbar("Veuillez saisir votre nom d'utilisateur et mot de passe", { variant: "error" });
        }

        setLoading(true);
        try {
            const result = await session.login(trimmedUsername, password);

            if (!result.success) {
                setPassword("");
                return enqueueSnackbar(result.error || "Nom d'utilisateur ou mot de passe invalide", { variant: "error" });
            }

            navigate('/app');
            enqueueSnackbar("Bienvenue !", { variant: "success" });
        } catch (error) {
            console.error(error);
            enqueueSnackbar("Une erreur inattendue est survenue", { variant: "error" });
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
                    <p className="auth-page__subtitle">Connectez-vous à votre bibliothèque personnelle</p>
                </div>

                <Card>
                    <form onSubmit={handleLogin}>
                        <FormGroup>
                            <label htmlFor="username">Nom d'utilisateur</label>
                            <input
                                id="username"
                                type="text"
                                name="username"
                                autoComplete="username"
                                placeholder="ex: admin"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                            />
                        </FormGroup>

                        <FormGroup>
                            <label htmlFor="password">Mot de passe</label>
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
                                {loading ? "Connexion en cours..." : "Se connecter"}
                            </button>
                        </FormGroup>

                        <FormGroup>
                            <Link to={'/register'}>Pas encore de compte ? Inscrivez-vous</Link>
                        </FormGroup>
                    </form>
                </Card>
            </div>
        </div>
    );
}
