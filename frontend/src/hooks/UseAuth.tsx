import {useState} from "react";

export default function useAuth() {
    const [token, setToken] = useState<string | null>(() => {
        if (typeof window !== "undefined") {
            return localStorage.getItem("token");
        }
        return null;
    })

    const login = async (email: string, password: string) => {
        const response = await fetch("http://localhost:8080/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({ email, password }),
        });

        if (response.status === 200) {
            const data = await response.json();
            setToken(data.token);
            localStorage.setItem("token", data.token);
        }
    }

    const logout = async () => {
        const response = await fetch("http://localhost:8080/auth/logout", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Clear-Site-Data": "\"cookies\""
            },
            credentials: "include",
        });

        if (response.status === 200) {
            setToken(null);
            localStorage.removeItem("token");
        }
    }

    const isLogged = () => {
        return token !== null;
    }

    return { token, isLogged, login, logout };
}