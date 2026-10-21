import {useState} from "react";
import useSession from "../hooks/UseSession.tsx";
import {Link, useNavigate} from 'react-router';
import {enqueueSnackbar} from "notistack";

import Card from "../components/Card/Card.tsx";
import FormGroup from "../components/Form/FormGroup.tsx";

export default function Login() {
    const [email, setEmail] = useState<string>("");
    const [password, setPassword] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);

    const session = useSession();
    const navigate = useNavigate();

    const handleLogin = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (loading) return;

        const trimmedEmail = email.trim();
        if (!trimmedEmail || !password) {
            return enqueueSnackbar("Email and password are required", {variant: "error"});
        }

        setLoading(true);
        try {
            const result = await session.login(trimmedEmail, password);

            if (!result.success) {
                setPassword("");
                return enqueueSnackbar(result.error || "Invalid email or password", {variant: "error"});
            }

            navigate('/app');
            enqueueSnackbar("Bienvenue!", {variant: "success"});
        } catch (error) {
            console.error(error);
            enqueueSnackbar("Une erreur inattendue est survenue", {variant: "error"});
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{position: "absolute", width: '500px', left: '50%', top: '50%', transform: 'translate(-50%, -50%)'}}>
            <Card>
                <form onSubmit={handleLogin}>
                    <FormGroup>
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            name="email"
                            autoComplete="email"
                            placeholder="your@email.com"
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
                            autoComplete="current-password"
                            placeholder="••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </FormGroup>

                    <FormGroup>
                        <button type="submit" disabled={loading}>
                            {loading ? "Connexion..." : "Login"}
                        </button>
                    </FormGroup>

                    <FormGroup>
                        <Link to={'/register'}>Pas de compte? Inscrivez-vous</Link>
                    </FormGroup>
                </form>
            </Card>
        </div>
    );
}
