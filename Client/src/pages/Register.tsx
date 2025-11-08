import { useState } from "react";
import { Link, useNavigate } from 'react-router';
import FormGroup from "../components/Form/FormGroup.tsx";
import Card from "../components/Card/Card.tsx";
import { enqueueSnackbar } from "notistack";

export default function Register() {
    const [email, setEmail] = useState<string>("");
    const [password, setPassword] = useState<string>("");
    const [username, setUsername] = useState<string>("");

    const navigate = useNavigate();

    const handleRegister = async () => {
        if (!email || !password || !username) {
            return enqueueSnackbar("Email, password, and username are required", { variant: "error" });
        }

        try {
            const response = await fetch("http://localhost:8080/auth/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "include",
                body: JSON.stringify({ email, password, username }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({ message: response.statusText }));
                enqueueSnackbar(data?.message || "Registration failed", { variant: "error" });
                return;
            }

            enqueueSnackbar("Inscription réussie", { variant: "success" });
            navigate("/login");
        } catch (err) {
            enqueueSnackbar("Requête bloquée ou erreur réseau. Désactivez les extensions (ex. adblock) ou utilisez un proxy de dev.", { variant: "error" });
            console.error(err);
        }
    }

    return (
        <div style={{ position: "absolute", width: '500px', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
            <Card>
                <form onSubmit={(e) => { e.preventDefault(); handleRegister(); }}>
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
                        <button type="submit">S'inscire</button>
                    </FormGroup>

                    <FormGroup>
                        <Link to={'/login'}>Déjà un compte? Connectez-vous</Link>
                    </FormGroup>
                </form>
            </Card>
        </div>
    );
}