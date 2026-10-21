import {useState} from "react";
import {Link, useNavigate} from 'react-router';
import FormGroup from "../components/Form/FormGroup.tsx";
import Card from "../components/Card/Card.tsx";
import {enqueueSnackbar} from "notistack";
import useSession from "../hooks/UseSession.tsx";

export default function Register() {
    const [email, setEmail] = useState<string>("");
    const [password, setPassword] = useState<string>("");
    const [username, setUsername] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);

    const session = useSession();
    const navigate = useNavigate();

    const handleRegister = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (loading) return;

        const trimmedEmail = email.trim();
        const trimmedUsername = username.trim();

        if (!trimmedEmail || !password || !trimmedUsername) {
            return enqueueSnackbar("Email, password, and username are required", {variant: "error"});
        }

        setLoading(true);
        try {
            const result = await session.register(trimmedUsername, trimmedEmail, password);

            if (!result.success) {
                return enqueueSnackbar(result.error || "Registration failed", {variant: "error"});
            }

            enqueueSnackbar("Inscription réussie", {variant: "success"});
            navigate("/login");
        } catch (err) {
            enqueueSnackbar("Requête bloquée ou erreur réseau. Vérifiez que le serveur est accessible.", {variant: "error"});
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{position: "absolute", width: '500px', left: '50%', top: '50%', transform: 'translate(-50%, -50%)'}}>
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
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            name="email"
                            autoComplete="email"
                            placeholder="bruce.wayne@gotham.us"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </FormGroup>

                    <FormGroup>
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            name="password"
                            autoComplete="new-password"
                            placeholder="••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </FormGroup>

                    <FormGroup>
                        <button type="submit" disabled={loading}>
                            {loading ? "Inscription..." : "S'inscrire"}
                        </button>
                    </FormGroup>

                    <FormGroup>
                        <Link to={'/login'}>Déjà un compte? Connectez-vous</Link>
                    </FormGroup>
                </form>
            </Card>
        </div>
    );
}
