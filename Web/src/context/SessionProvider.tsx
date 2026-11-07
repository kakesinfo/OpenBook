import { useEffect, useState, useRef, ReactNode, useCallback, useMemo } from "react";
import { jwtDecode } from "jwt-decode";
import { API_URL } from "../config/api.ts";
import { SessionContext, SessionUser } from "./SessionContext.tsx";

function parseToken(rawToken: string | null): { token: string | null; user: SessionUser | null } {
    if (!rawToken) return { token: null, user: null };
    try {
        const decoded = jwtDecode<SessionUser>(rawToken);
        if (decoded.exp && decoded.exp * 1000 <= Date.now()) {
            localStorage.removeItem("token");
            return { token: null, user: null };
        }
        return { token: rawToken, user: decoded };
    } catch {
        localStorage.removeItem("token");
        return { token: null, user: null };
    }
}

export function SessionProvider({ children }: { children: ReactNode }) {
    const [token, setToken] = useState<string | null>(() => {
        return parseToken(localStorage.getItem("token")).token;
    });

    const [user, setUser] = useState<SessionUser | null>(() => {
        return parseToken(localStorage.getItem("token")).user;
    });

    const [setupRequired, setSetupRequired] = useState<boolean | null>(null);

    const isLoggingOutRef = useRef(false);

    const updateToken = useCallback((newToken: string | null) => {
        const parsed = parseToken(newToken);
        if (parsed.token) {
            localStorage.setItem("token", parsed.token);
        } else {
            localStorage.removeItem("token");
        }
        setToken(parsed.token);
        setUser(parsed.user);
    }, []);

    const updateUser = useCallback((updatedFields: Partial<SessionUser>) => {
        setUser(prev => prev ? { ...prev, ...updatedFields } : null);
    }, []);

    const clearLocalSession = useCallback(() => {
        updateToken(null);
    }, [updateToken]);

    const checkSetupStatus = useCallback(async (): Promise<boolean> => {
        try {
            const res = await fetch(`${API_URL}/setup/status`);
            if (res.ok) {
                const data = await res.json();
                const req = Boolean(data.setupRequired);
                setSetupRequired(req);
                return req;
            }
        } catch (err) {
            console.error("Failed to check setup status:", err);
        }
        return false;
    }, []);

    useEffect(() => {
        checkSetupStatus();
    }, [checkSetupStatus]);

    // Role recovery if token exists but claims lack role
    useEffect(() => {
        if (token && (!user?.role)) {
            fetch(`${API_URL}/user/profile`, {
                headers: { "Authorization": `Bearer ${token}` },
                credentials: "include"
            }).then(async res => {
                if (res.ok) {
                    const data = await res.json();
                    if (data.role) {
                        setUser(prev => prev ? { ...prev, role: data.role } : null);
                    }
                }
            }).catch(() => {});
        }
    }, [token, user?.role]);

    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === "token" || e.key === null) {
                const current = localStorage.getItem("token");
                const parsed = parseToken(current);
                setToken(parsed.token);
                setUser(parsed.user);
            }
        };

        window.addEventListener("storage", handleStorageChange);
        return () => window.removeEventListener("storage", handleStorageChange);
    }, []);

    const login = useCallback(async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "include",
                body: JSON.stringify({ username, password }),
            });

            if (response.ok) {
                const data = await response.json();
                updateToken(data.token);
                return { success: true };
            }

            const errorText = await response.text().catch(() => "");
            let errorMessage = "Identifiants invalides";
            if (errorText) {
                try {
                    const parsed = JSON.parse(errorText);
                    errorMessage = parsed.message || parsed.error || errorText;
                } catch {
                    errorMessage = errorText;
                }
            } else if (response.statusText) {
                errorMessage = response.statusText;
            }

            return { success: false, error: errorMessage };
        } catch (error) {
            console.error("Login error:", error);
            return {
                success: false,
                error: "Impossible de joindre le serveur. Vérifiez votre connexion."
            };
        }
    }, [updateToken]);

    const register = useCallback(async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const response = await fetch(`${API_URL}/auth/register`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "include",
                body: JSON.stringify({ username, password }),
            });

            if (response.ok) {
                return { success: true };
            }

            const errorText = await response.text().catch(() => "");
            let errorMessage = "Échec de l'inscription";
            if (errorText) {
                try {
                    const parsed = JSON.parse(errorText);
                    errorMessage = parsed.message || parsed.error || errorText;
                } catch {
                    errorMessage = errorText;
                }
            } else if (response.statusText) {
                errorMessage = response.statusText;
            }

            return { success: false, error: errorMessage };
        } catch (error) {
            console.error("Register error:", error);
            return {
                success: false,
                error: "Requête bloquée ou erreur réseau. Vérifiez que le serveur est accessible."
            };
        }
    }, []);

    const logout = useCallback(async (): Promise<boolean> => {
        if (isLoggingOutRef.current) return false;
        isLoggingOutRef.current = true;

        try {
            const headers = new Headers({
                "Content-Type": "application/json"
            });
            if (token) {
                headers.set("Authorization", `Bearer ${token}`);
            }

            await fetch(`${API_URL}/auth/logout`, {
                method: "POST",
                headers,
                credentials: "include",
            }).catch((e) => {
                console.warn("Logout fetch failed:", e);
            });

            clearLocalSession();
            return true;
        } catch (error) {
            console.error("Logout error:", error);
            clearLocalSession();
            return true;
        } finally {
            isLoggingOutRef.current = false;
        }
    }, [token, clearLocalSession]);

    const customFetch = useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
        try {
            const fullUrl = url.startsWith("http://") || url.startsWith("https://")
                ? url
                : `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;

            const headers = new Headers(options.headers || {});
            if (token && !headers.has("Authorization")) {
                headers.set("Authorization", `Bearer ${token}`);
            }

            const response = await window.fetch(fullUrl, {
                ...options,
                headers,
                credentials: "include"
            });

            if (response.status === 401) {
                clearLocalSession();
            }

            return response;
        } catch (error) {
            console.error("Fetch error:", error);
            throw error;
        }
    }, [token, clearLocalSession]);

    const isAdmin = user?.role === 'ROLE_ADMIN';

    const sessionValue = useMemo(() => ({
        token,
        user,
        isAuthenticated: !!token,
        isAdmin,
        setupRequired,
        checkSetupStatus,
        login,
        register,
        logout,
        customFetch,
        updateToken,
        updateUser
    }), [token, user, isAdmin, setupRequired, checkSetupStatus, login, register, logout, customFetch, updateToken, updateUser]);

    return (
        <SessionContext.Provider value={sessionValue}>
            {children}
        </SessionContext.Provider>
    );
}
