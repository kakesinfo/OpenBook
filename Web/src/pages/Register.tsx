import { useState } from "react";
import { Link, useNavigate } from 'react-router';
import FormGroup from "../components/Form/FormGroup.tsx";
import Card from "../components/Card/Card.tsx";
import { enqueueSnackbar } from "notistack";
import useSession from "../hooks/UseSession.tsx";
import useLanguage from "../hooks/UseLanguage.tsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBookOpen } from "@fortawesome/free-solid-svg-icons";
import "./Auth.scss";

export default function Register() {
    const [password, setPassword] = useState<string>("");
    const [username, setUsername] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);

    const session = useSession();
    const { tr } = useLanguage();
    const navigate = useNavigate();

    const handleRegister = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (loading) return;

        const trimmedUsername = username.trim();

        if (!trimmedUsername || !password) {
            return enqueueSnackbar(tr("All fields are required", "Tous les champs sont requis"), { variant: "error" });
        }

        setLoading(true);
        try {
            const result = await session.register(trimmedUsername, password);

            if (!result.success) {
                return enqueueSnackbar(result.error || tr("Registration failed", "Échec de l'inscription"), { variant: "error" });
            }

            enqueueSnackbar(tr("Registration successful! Please sign in.", "Inscription réussie ! Connectez-vous."), { variant: "success" });
            navigate("/login");
        } catch (err) {
            enqueueSnackbar(tr("Request blocked or network error. Please check that the server is reachable.", "Requête bloquée ou erreur réseau. Vérifiez que le serveur est accessible."), { variant: "error" });
            console.error(err);
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
                    <h1 className="auth-page__title">{tr("Create an account", "Créer un compte")}</h1>
                    <p className="auth-page__subtitle">{tr("Join Yet Another Library and manage your collection", "Rejoignez Yet Another Library et gérez votre bibliothèque")}</p>
                </div>

                <Card>
                    <form onSubmit={handleRegister}>
                        <FormGroup>
                            <label htmlFor="username">{tr("Username", "Pseudonyme")}</label>
                            <input
                                id="username"
                                type="text"
                                name="username"
                                autoComplete="username"
                                placeholder="Batman"
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
                                autoComplete="new-password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </FormGroup>

                        <FormGroup>
                            <button type="submit" disabled={loading}>
                                {loading ? tr("Creating account...", "Création du compte...") : tr("Sign up", "S'inscrire")}
                            </button>
                        </FormGroup>

                        <FormGroup>
                            <Link to={'/login'}>{tr("Already have an account? Sign in", "Déjà un compte ? Connectez-vous")}</Link>
                        </FormGroup>
                    </form>
                </Card>
            </div>
        </div>
    );
}
