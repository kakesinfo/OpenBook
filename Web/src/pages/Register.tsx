import { useState } from "react";
import { Link, useNavigate } from 'react-router';
import FormGroup from "../components/Form/FormGroup.tsx";
import Card from "../components/Card/Card.tsx";
import { enqueueSnackbar } from "notistack";
import useSession from "../hooks/UseSession.tsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBookOpen } from "@fortawesome/free-solid-svg-icons";
import "./Auth.scss";

export default function Register() {
    const [password, setPassword] = useState<string>("");
    const [username, setUsername] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);

    const session = useSession();
    const navigate = useNavigate();

    const handleRegister = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (loading) return;

        const trimmedUsername = username.trim();

        if (!trimmedUsername || !password) {
            return enqueueSnackbar("Tous les champs sont requis", { variant: "error" });
        }

        setLoading(true);
        try {
            const result = await session.register(trimmedUsername, password);

            if (!result.success) {
                return enqueueSnackbar(result.error || "Échec de l'inscription", { variant: "error" });
            }

            enqueueSnackbar("Inscription réussie ! Connectez-vous.", { variant: "success" });
            navigate("/login");
        } catch (err) {
            enqueueSnackbar("Requête bloquée ou erreur réseau. Vérifiez que le serveur est accessible.", { variant: "error" });
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
                    <h1 className="auth-page__title">Créer un compte</h1>
                    <p className="auth-page__subtitle">Rejoignez Yet Another Library et gérez votre bibliothèque</p>
                </div>

                <Card>
                    <form onSubmit={handleRegister}>
                        <FormGroup>
                            <label htmlFor="username">Pseudonyme</label>
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
                            <label htmlFor="password">Mot de passe</label>
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
                                {loading ? "Création du compte..." : "S'inscrire"}
                            </button>
                        </FormGroup>

                        <FormGroup>
                            <Link to={'/login'}>Déjà un compte ? Connectez-vous</Link>
                        </FormGroup>
                    </form>
                </Card>
            </div>
        </div>
    );
}
