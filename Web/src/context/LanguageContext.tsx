import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import {
    LANGUAGES,
    DEFAULT_LANGUAGE,
    LANGUAGE_STORAGE_KEY,
    setCurrentLanguageInternal,
    translateCategoryName,
    translations,
    type LanguageId,
    type LanguageOption
} from "../i18n";

export interface LanguageContextType {
    language: LanguageId;
    setLanguage: (lang: LanguageId) => void;
    availableLanguages: LanguageOption[];
    locale: string;
    isFr: boolean;
    isEn: boolean;
    tr: (en: string, fr: string) => string;
    t: (key: string, params?: Record<string, string | number>) => string;
    translateCategory: (name?: string | null) => string;
}

// eslint-disable-next-line react-refresh/only-export-components
export const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [language, setLanguageState] = useState<LanguageId>(() => {
        try {
            const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY) as LanguageId | null;
            if (saved && (saved === "en" || saved === "fr")) {
                setCurrentLanguageInternal(saved);
                return saved;
            }
        } catch {
            // Ignore storage access errors
        }
        setCurrentLanguageInternal(DEFAULT_LANGUAGE);
        return DEFAULT_LANGUAGE;
    });

    const setLanguage = useCallback((newLang: LanguageId) => {
        setCurrentLanguageInternal(newLang);
        setLanguageState(newLang);
        try {
            localStorage.setItem(LANGUAGE_STORAGE_KEY, newLang);
        } catch {
            // Ignore storage errors
        }
    }, []);

    useEffect(() => {
        setCurrentLanguageInternal(language);
        document.documentElement.setAttribute("lang", language);
    }, [language]);

    const locale = language === "fr" ? "fr-FR" : "en-US";
    const isFr = language === "fr";
    const isEn = language === "en";

    const tr = useCallback(
        (en: string, fr: string) => (language === "fr" ? fr : en),
        [language]
    );

    const t = useCallback(
        (key: string, params?: Record<string, string | number>) => {
            const dict = translations[language] || translations.en;
            let value = dict[key] ?? translations.en[key] ?? key;
            if (params) {
                for (const [k, v] of Object.entries(params)) {
                    value = value.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
                }
            }
            return value;
        },
        [language]
    );

    const translateCategory = useCallback(
        (name?: string | null) => translateCategoryName(name, language),
        [language]
    );

    return (
        <LanguageContext.Provider
            value={{
                language,
                setLanguage,
                availableLanguages: LANGUAGES,
                locale,
                isFr,
                isEn,
                tr,
                t,
                translateCategory
            }}
        >
            {children}
        </LanguageContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLanguage(): LanguageContextType {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error("useLanguage must be used within a LanguageProvider");
    }
    return context;
}
