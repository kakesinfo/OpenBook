import {Box, Card, FormControl, FormLabel, Typography} from "@mui/material";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import {useState} from "react";
import useSession from "../hooks/UseSession.tsx";
import { useNavigate } from 'react-router';
import {enqueueSnackbar} from "notistack";

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
                            value={email}
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
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </FormControl>
                    <Button fullWidth variant="contained" onClick={handleLogin}>Login</Button>
                </Box>
            </Card>
        </div>
    );
}