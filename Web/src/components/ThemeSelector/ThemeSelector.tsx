import { useTheme } from "../../context/ThemeContext.tsx";
import { enqueueSnackbar } from "notistack";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck } from "@fortawesome/free-solid-svg-icons";
import "./ThemeSelector.scss";

export default function ThemeSelector() {
    const { theme, setTheme, availableThemes } = useTheme();

    const handleSelectTheme = (themeId: typeof theme) => {
        if (themeId === theme) return;
        setTheme(themeId);
        const selected = availableThemes.find((t) => t.id === themeId);
        enqueueSnackbar(`Thème "${selected?.name || themeId}" activé`, {
            variant: "success",
            autoHideDuration: 2000,
        });
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
                                    <span className="theme-card__name">{option.name}</span>
                                    {isActive && (
                                        <span className="theme-card__badge">
                                            <FontAwesomeIcon icon={faCheck} /> Actif
                                        </span>
                                    )}
                                </div>
                                <p className="theme-card__desc">{option.description}</p>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
