import {useState} from "react";
import useSession from "../hooks/UseSession.tsx";
import {Link, useNavigate} from 'react-router';
import {enqueueSnackbar} from "notistack";

import Card from "../components/Card/Card.tsx";
import FormGroup from "../components/Form/FormGroup.tsx";

export default function Login(){
    const [email, setEmail] = useState<string>();
    const [password, setPassword] = useState<string>();

    const session = useSession();
    const navigate = useNavigate();

    const handleLogin = async () => {
        if (!email || !password) {
            return enqueueSnackbar("Email and password are required", {variant: "error"});
        }

        const status = await session.login(email, password);

        if (!status) {
            setEmail("");
            setPassword("");
            return enqueueSnackbar("Invalid email or password", {variant: "error"});
        }

        navigate('/profile');
        enqueueSnackbar("Bienvenue!", {variant: "success"})
    }

    return (
        <div style={{position: "absolute", width: '500px', left: '50%', top: '50%', transform: 'translate(-50%, -50%)'}}>
            <Card>
                <FormGroup>
                    <label htmlFor="email">Email</label>
                    <input
                        type="email"
                        name="email"
                        autoComplete="email"
                        placeholder="your@email.com"
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
                        autoComplete="password"
                        placeholder="••••••"
                        value={password as string}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </FormGroup>

                <FormGroup>
                    <button onClick={handleLogin}>Login</button>
                </FormGroup>

                <FormGroup>
                    <Link to={'/register'}>Pas de compte? Inscrivez-vous</Link>
                </FormGroup>
            </Card>
        </div>
    );
}