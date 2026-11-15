export type LanguageId = "en" | "fr";

export interface LanguageOption {
    id: LanguageId;
    name: string;
    nativeName: string;
    code: string;
    description: {
        en: string;
        fr: string;
    };
}

export const DEFAULT_LANGUAGE: LanguageId = "en";
export const LANGUAGE_STORAGE_KEY = "yal_language";

export const LANGUAGES: LanguageOption[] = [
    {
        id: "en",
        name: "English (Default)",
        nativeName: "English",
        code: "EN",
        description: {
            en: "English interface across the entire application (Default)",
            fr: "Interface en anglais sur l'ensemble de l'application (Par défaut)"
        }
    },
    {
        id: "fr",
        name: "French",
        nativeName: "Français",
        code: "FR",
        description: {
            en: "French interface across the entire application",
            fr: "Interface en français sur l'ensemble de l'application"
        }
    }
];

let currentLanguageState: LanguageId = (() => {
    try {
        const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (saved === "en" || saved === "fr") {
            return saved;
        }
    } catch {
        // Ignore storage errors
    }
    return DEFAULT_LANGUAGE;
})();

export function getCurrentLanguage(): LanguageId {
    return currentLanguageState;
}

export function setCurrentLanguageInternal(lang: LanguageId): void {
    currentLanguageState = lang;
}

export function getCurrentLocale(lang: LanguageId = currentLanguageState): string {
    return lang === "fr" ? "fr-FR" : "en-US";
}

export function trStatic(en: string, fr: string, lang: LanguageId = currentLanguageState): string {
    return lang === "fr" ? fr : en;
}

export function translateCategoryName(name?: string | null, lang: LanguageId = currentLanguageState): string {
    if (!name) return "";
    if (lang === "fr") return name;
    const lower = name.trim().toLowerCase();
    switch (lower) {
        case "bande dessinée":
        case "bande dessinee":
        case "bd":
            return "Comics / BD";
        case "roman graphique":
            return "Graphic Novel";
        case "roman":
            return "Novel";
        case "beau-livre":
        case "beau livre":
            return "Artbook";
        case "comics":
            return "Comics";
        case "manga":
            return "Manga";
        case "e-book":
        case "ebook":
        case "e book":
            return "E-book";
        default:
            return name;
    }
}

export const translations: Record<LanguageId, Record<string, string>> = {
    en: {
        "nav.search": "Search in DB",
        "nav.searchDialog": "Search in database",
        "nav.news": "New Releases",
        "nav.library": "Library",
        "nav.myBooks": "My Books",
        "nav.mySeries": "My Series",
        "nav.mySales": "My Sales",
        "nav.notes": "Notes",
        "nav.glossary": "Glossary",
        "nav.wishlist": "Wishlist",
        "nav.planning": "Release Schedule",
        "nav.statistics": "Statistics",
        "nav.statsShort": "Stats",
        "nav.indexation": "Indexation",
        "nav.maintenance": "Maintenance",
        "nav.backups": "Backups",
        "nav.backupsShort": "Backups",
        "nav.deletedBooks": "Deleted Books",
        "nav.deletedShort": "Deleted",
        "nav.users": "Users",
        "nav.usersShort": "Users",
        "nav.configuration": "Configuration",
        "nav.configShort": "Config",
        "nav.adminBadge": "Administration",
        "nav.roleAdmin": "Administrator",
        "nav.roleReader": "Reader",
        "nav.accountSettings": "Account settings",
        "nav.settings": "Settings",
        "logout.label": "Log out",
        "logout.loading": "Logging out...",
        "logout.error": "An error occurred while logging out"
    },
    fr: {
        "nav.search": "Rechercher en BDD",
        "nav.searchDialog": "Rechercher en base de données",
        "nav.news": "Nouveautés",
        "nav.library": "Bibliothèque",
        "nav.myBooks": "Mes Albums",
        "nav.mySeries": "Mes Séries",
        "nav.mySales": "Mes Ventes",
        "nav.notes": "Notes",
        "nav.glossary": "Glossaire",
        "nav.wishlist": "Souhaits",
        "nav.planning": "Planning",
        "nav.statistics": "Statistiques",
        "nav.statsShort": "Stats",
        "nav.indexation": "Indexation",
        "nav.maintenance": "Maintenance",
        "nav.backups": "Sauvegardes",
        "nav.backupsShort": "Sauvegardes",
        "nav.deletedBooks": "Livres supprimés",
        "nav.deletedShort": "Supprimés",
        "nav.users": "Utilisateurs",
        "nav.usersShort": "Utilisateurs",
        "nav.configuration": "Configuration",
        "nav.configShort": "Config",
        "nav.adminBadge": "Administration",
        "nav.roleAdmin": "Administrateur",
        "nav.roleReader": "Lecteur",
        "nav.accountSettings": "Paramètres de votre compte",
        "nav.settings": "Paramètres",
        "logout.label": "Déconnexion",
        "logout.loading": "Déconnexion...",
        "logout.error": "Une erreur est survenue lors de la déconnexion"
    }
};
