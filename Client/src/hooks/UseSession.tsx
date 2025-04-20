import {useEffect, useState} from "react";

export default function useSession() {
    const [token, setToken] = useState<string | null>(() => {
        return localStorage.getItem("token");
    });

    useEffect(() => {
        const handleStorageChange = () => {
            setToken(localStorage.getItem("token"));
        };

        window.addEventListener("storage", handleStorageChange);
        return () => window.removeEventListener("storage", handleStorageChange);
    }, []);

    const login = async (email: string, password: string) => {
        try {
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
        } catch (error) {
            console.error("Login error:", error);
        }
        return false;
    }

    const logout = async () => {
        try {
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
        } catch (error) {
            console.error("Logout error:", error);
        }
        return false;
    }

    const customFetch = async (url: string, options: RequestInit) => {
        try {
            return window.fetch(url, {
               ...options,
               headers: {
                   ...options.headers,
                   Authorization: `Bearer ${token}`
               }
           });
        } catch (error) {
            console.error("Fetch error:", error);
            throw error;
        }
    }

    return { token, login, logout, customFetch };
}