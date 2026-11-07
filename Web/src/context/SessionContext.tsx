import { createContext, useContext } from "react";

export interface SessionUser {
    username?: string;
    avatar?: string;
    sub?: string;
    exp?: number;
    role?: string;
    mustChangePassword?: boolean;
    blocked?: boolean;
}

export interface SessionContextType {
    token: string | null;
    user: SessionUser | null;
    isAuthenticated: boolean;
    isAdmin: boolean;
    setupRequired: boolean | null;
    checkSetupStatus: () => Promise<boolean>;
    login: (username: string, password: string) => Promise<{ success: boolean; error?: string; mustChangePassword?: boolean }>;
    register: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
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
