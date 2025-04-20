import {useState} from "react";

import {Link, useNavigate} from 'react-router';
import FormGroup from "../components/Form/FormGroup.tsx";
import Card from "../components/Card/Card.tsx";
import {enqueueSnackbar} from "notistack";

export default function Register(){
    const [email, setEmail] = useState<string>();
    const [password, setPassword] = useState<string>();
    const [username, setUsername] = useState<string>();

    const navigate = useNavigate();

    const handleRegister = async () => {
        if (!email || !password || !username) {
            return enqueueSnackbar("Email, password, and username are required", {variant: "error"});
        }

        const response = await fetch("http://localhost:8080/auth/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({ email, password, username }),
        });

        if (response.ok) navigate('/login');
    }

    return (
        <div style={{position: "absolute", width: '500px', left: '50%', top: '50%', transform: 'translate(-50%, -50%)'}}>
            <Card>
                <FormGroup>
                    <label htmlFor="username">Pseudonyme</label>
                    <input
                        type="text"
                        name="username"
                        autoComplete="username"
                        placeholder="Batman"
                        value={username as string}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                    />
                </FormGroup>

                <FormGroup>
                    <label htmlFor="email">Email</label>
                    <input
                        type="email"
                        name="email"
                        autoComplete="email"
                        placeholder="bruce.wayne@gotham.us"
                        value={email as string}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </FormGroup>

                <FormGroup>
                    <label htmlFor="password">Password</label>
                    <input
                        type="password"
                        name="password"
                        autoComplete="new-password"
                        placeholder="••••••"
                        value={password as string}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </FormGroup>

                <FormGroup>
                    <button onClick={handleRegister}>S'inscire</button>
                </FormGroup>

                <FormGroup>
                    <Link to={'/login'}>Déjà un compte? Connectez-vous</Link>
                </FormGroup>
            </Card>
        </div>
    );
}