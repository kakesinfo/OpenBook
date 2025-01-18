"use client";

import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import React, {useState} from "react";

export default function Home() {
    const [password, setPassword] = useState<string>();
    const [email, setEmail] = useState<string>();

    const handleEmailChange: any = (e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value);
    const handlePasswordChange: any = (e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value);

    const handleLogin = async () => {
        const response = await fetch("http://localhost:8080/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({email, password}),
        });
        console.log(response);
    }

    const handleLogout = async () => {
        const response = await fetch("http://localhost:8080/auth/logout", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Clear-Site-Data": "\"cookies\""
            },
            credentials: "include",
        });
        console.log(response);
    }

    return (
        <div>
            <h1>Connexion</h1>
            <TextField label="Email" variant="standard" onChange={handleEmailChange}/>
            <TextField label="Password" variant="standard" type="password" onChange={handlePasswordChange} />
            <Button variant="contained" onClick={handleLogin}>Login</Button>
            <h1>Deconnexion</h1>
            <Button variant="contained" onClick={handleLogout}>Logout</Button>
        </div>
    );
}
