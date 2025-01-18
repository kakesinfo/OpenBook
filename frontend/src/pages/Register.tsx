import {Box, Card, FormControl, FormLabel, Typography} from "@mui/material";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import {useState} from "react";

import {Link, useNavigate} from 'react-router';

export default function Register(){
    const [email, setEmail] = useState<string>();
    const [password, setPassword] = useState<string>();
    const [username, setUsername] = useState<string>();

    const navigate = useNavigate();

    const handleRegister = async () => {
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
            <Card sx={{padding: '10px'}}>
                <Typography component="h1" variant="h4" sx={{width: '100%'}}>
                    S'inscrire
                </Typography>
                <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
                    <FormControl>
                        <FormLabel htmlFor="username">Pseudonyme</FormLabel>
                        <TextField
                            required
                            fullWidth
                            id="username"
                            name="username"
                            placeholder="Batman"
                            autoComplete="username"
                            variant="outlined"
                            type="text"
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    </FormControl>
                    <FormControl>
                        <FormLabel htmlFor="email">Email</FormLabel>
                        <TextField
                            required
                            fullWidth
                            id="email"
                            name="email"
                            placeholder="bruce.wayne@gotham.us"
                            autoComplete="email"
                            variant="outlined"
                            type="email"
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </FormControl>
                    <FormControl>
                        <FormLabel htmlFor="password">Password</FormLabel>
                        <TextField
                            required
                            fullWidth
                            id="password"
                            name="password"
                            placeholder="••••••"
                            autoComplete="new-password"
                            variant="outlined"
                            type="password"
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </FormControl>
                    <Button fullWidth variant="contained" onClick={handleRegister}>Login</Button>
                    <Link to={'/login'}>Déjà un compte? Connectez-vous</Link>
                </Box>
            </Card>
        </div>
    );
}