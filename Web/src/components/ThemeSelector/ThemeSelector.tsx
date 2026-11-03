import { useTheme } from "../../context/ThemeContext.tsx";
import useLanguage from "../../hooks/UseLanguage.tsx";
import { enqueueSnackbar } from "notistack";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck } from "@fortawesome/free-solid-svg-icons";
import "./ThemeSelector.scss";

export default function ThemeSelector() {
    const { theme, setTheme, availableThemes } = useTheme();
    const { tr } = useLanguage();

    const getThemeName = (id: string, fallback: string) => {
        if (id === "default") return tr("Dark Emerald (Default)", "Sombre Émeraude (Défaut)");
        if (id === "beige") return tr("Beige Paper", "Papier Beige");
        return fallback;
    };

    const getThemeDesc = (id: string, fallback: string) => {
        if (id === "default") return tr("Modern dark theme with emerald accents", "Thème sombre moderne avec des accents émeraude");
        if (id === "beige") return tr("Vintage book and soft paper atmosphere with beige and amber tones", "Ambiance livre ancien et papier doux aux tons beiges et ambrés");
        return fallback;
    };

    const handleSelectTheme = (themeId: typeof theme) => {
        if (themeId === theme) return;
        setTheme(themeId);
        const selected = availableThemes.find((t) => t.id === themeId);
        const label = getThemeName(themeId, selected?.name || themeId);
        enqueueSnackbar(
            tr(`Theme "${label}" activated`, `Thème "${label}" activé`),
            {
                variant: "success",
                autoHideDuration: 2000,
            }
        );
    };

    return (
        <div className="theme-selector">
            <div className="theme-selector__grid">
                {availableThemes.map((option) => {
                    const isActive = option.id === theme;
                    return (
                        <button
                            key={option.id}
                            type="button"
                            className={`theme-card ${isActive ? "theme-card--active" : ""}`}
                            onClick={() => handleSelectTheme(option.id)}
                            aria-pressed={isActive}
                        >
                            <div
                                className="theme-card__preview"
                                style={{ backgroundColor: option.colors.bg }}
                            >
                                <div
                                    className="theme-card__preview-surface"
                                    style={{
                                        backgroundColor: option.colors.surface,
                                        borderColor: option.colors.accent,
                                    }}
                                >
                                    <div
                                        className="theme-card__preview-badge"
                                        style={{ backgroundColor: option.colors.accent }}
                                    />
                                    <div
                                        className="theme-card__preview-line"
                                        style={{ backgroundColor: option.colors.text }}
                                    />
                                    <div
                                        className="theme-card__preview-line theme-card__preview-line--short"
                                        style={{ backgroundColor: option.colors.text, opacity: 0.6 }}
                                    />
                                </div>
                            </div>

                            <div className="theme-card__info">
                                <div className="theme-card__header">
                                    <span className="theme-card__name">{getThemeName(option.id, option.name)}</span>
                                    {isActive && (
                                        <span className="theme-card__badge">
                                            <FontAwesomeIcon icon={faCheck} /> {tr("Active", "Actif")}
                                        </span>
                                    )}
                                </div>
                                <p className="theme-card__desc">{getThemeDesc(option.id, option.description)}</p>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
