import { useEffect, useState, useRef } from "react";

export default function useSession() {
    const [token, setToken] = useState<string | null>(() => {
        return localStorage.getItem("token");
    });

    const isLoggingOutRef = useRef(false);

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

    const broadcastTokenRemoval = (oldToken: string | null) => {
        // try to notify other tabs about the token removal
        try {
            const evt = new StorageEvent('storage', {
                key: 'token',
                oldValue: oldToken ?? null,
                newValue: null,
            } as any);
            window.dispatchEvent(evt);
        } catch (e) {
            // StorageEvent constructor may not be supported in all environments; ignore if it fails
        }
    }

    const clearLocalSession = () => {
        const old = localStorage.getItem('token');
        setToken(null);
        localStorage.removeItem('token');
        broadcastTokenRemoval(old);
    }

    const logout = async () => {
        if (isLoggingOutRef.current) return false;
        isLoggingOutRef.current = true;

        try {
            const response = await fetch("http://localhost:8080/auth/logout", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "include",
            });

            // If the server accepts the logout OR the session is already invalid (401/403),
            // consider the logout successful on the client and clear the local session.
            if (response.ok || response.status === 401 || response.status === 403) {
                clearLocalSession();
                return true;
            } else {
                // Unexpected status code: log it for debugging and don't clear automatically.
                try {
                    const text = await response.text();
                    console.error('Logout failed, status:', response.status, 'body:', text);
                } catch (e) {
                    console.error('Logout failed, status:', response.status);
                }
            }
        } catch (error) {
            // Network error / backend down: clear local session to avoid client crashes
            console.error("Logout error:", error);
            clearLocalSession();
            return true;
        } finally {
            isLoggingOutRef.current = false;
        }
        return false;
    }

    const customFetch = async (url: string, options: RequestInit = {}) => {
        try {
            const response = await window.fetch(url, {
                ...options,
                headers: {
                    ...((options && options.headers) || {}),
                    Authorization: token ? `Bearer ${token}` : ""
                },
                credentials: "include"
            });

            // If the token became invalid on the server, clear local session so the app can react.
            if (response.status === 401 || response.status === 403) {
                clearLocalSession();
            }

            return response;
        } catch (error) {
            console.error("Fetch error:", error);
            // don't silently swallow errors — rethrow so callers can handle them
            throw error;
        }
    }

    return { token, login, logout, customFetch };
}
