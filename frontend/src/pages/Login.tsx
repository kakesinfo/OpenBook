import {Box, Card, FormControl, FormLabel, Typography} from "@mui/material";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import {useState} from "react";
import useAuth from "../hooks/UseAuth.tsx";
import { useNavigate } from 'react-router';

export default function Login(){
    const [email, setEmail] = useState<string>();
    const [password, setPassword] = useState<string>();

    const auth = useAuth();
    const navigate = useNavigate();

    const handleLogin = async () => {
        if (email && password) {
            await auth.login(email, password);
            navigate('/profile');
        }
    }

    return (
        <div style={{position: "absolute", width: '500px', left: '50%', top: '50%', transform: 'translate(-50%, -50%)'}}>
            <div>{auth.isLogged() ? 'Is logged' : 'not logged'}</div>
            <Card sx={{padding: '10px'}}>
                <Typography component="h1" variant="h4" sx={{width: '100%'}}>
                    Se connecter
                </Typography>
                <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
                    <FormControl>
                        <FormLabel htmlFor="email">Email</FormLabel>
                        <TextField
                            required
                            fullWidth
                            placeholder="your@email.com"
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
                            placeholder="••••••"
                            autoComplete="new-password"
                            variant="outlined"
                            type="password"
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </FormControl>
                    <Button fullWidth variant="contained" onClick={handleLogin}>Login</Button>
                </Box>
            </Card>
        </div>
    );
}