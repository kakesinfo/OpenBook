import { createContext, useContext } from "react";

export interface SessionUser {
    email?: string;
    username?: string;
    avatar?: string;
    sub?: string;
    exp?: number;
}

export interface SessionContextType {
    token: string | null;
    user: SessionUser | null;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    register: (username: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => Promise<boolean>;
    customFetch: (url: string, options?: RequestInit) => Promise<Response>;
    updateToken: (newToken: string | null) => void;
    updateUser: (updatedFields: Partial<SessionUser>) => void;
}

export const SessionContext = createContext<SessionContextType | null>(null);

export function useSessionContext(): SessionContextType {
    const context = useContext(SessionContext);
    if (!context) {
        throw new Error("useSession must be used within a SessionProvider");
    }
    return context;
}
