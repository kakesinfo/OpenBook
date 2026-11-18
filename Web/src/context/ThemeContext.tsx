import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { THEMES, DEFAULT_THEME, type ThemeId, type ThemeOption } from "../themes";

const STORAGE_KEY = "yal_theme";

export interface ThemeContextType {
    theme: ThemeId;
    setTheme: (theme: ThemeId) => void;
    availableThemes: ThemeOption[];
}

// eslint-disable-next-line react-refresh/only-export-components
export const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<ThemeId>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
            if (saved && (saved === "default" || saved === "beige")) {
                return saved;
            }
        } catch {
            // Ignore storage access errors
        }
        return DEFAULT_THEME;
    });

    const setTheme = (newTheme: ThemeId) => {
        setThemeState(newTheme);
        try {
            localStorage.setItem(STORAGE_KEY, newTheme);
        } catch {
            // Ignore storage errors
        }
    };

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
        document.body.setAttribute("data-theme", theme);
    }, [theme]);

    return (
        <ThemeContext.Provider value={{ theme, setTheme, availableThemes: THEMES }}>
            {children}
        </ThemeContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextType {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
}
