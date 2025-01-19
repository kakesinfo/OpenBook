import { useState} from "react";

export default function useSession() {
    const [token, setToken] = useState<string | null>(() => {
        return localStorage.getItem("token");
    });

    const login = async (email: string, password: string) => {
        const response = await fetch("http://localhost:8080/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({ email, password }),
        });

        if (response.ok) {
            const data = await response.json();

            setToken(data.token);
            localStorage.setItem("token", data.token);

            return true;
        }

        return false;
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
            return true;
        }

        return false;
    }

    const customFetch = async (url: string, options: RequestInit) => {
       return window.fetch(url, {
           ...options,
           headers: {
               ...options.headers,
               Authorization: `Bearer ${token}`
           }
       });
    }

    return { token, login, logout, customFetch };
}