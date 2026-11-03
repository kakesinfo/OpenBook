import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../../context/LanguageContext.tsx";
import { enqueueSnackbar } from "notistack";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faChevronDown, faGlobe } from "@fortawesome/free-solid-svg-icons";
import "./LanguageSelector.scss";

export default function LanguageSelector() {
    const { language, setLanguage, availableLanguages, tr } = useLanguage();
    const [open, setOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [open]);

    const handleSelectLanguage = (langId: typeof language) => {
        setOpen(false);
        if (langId === language) return;
        setLanguage(langId);
        enqueueSnackbar(
            langId === "fr"
                ? "Langue changée en Français"
                : "Language changed to English",
            {
                variant: "success",
                autoHideDuration: 2000
            }
        );
    };

    const getOptionLabel = (id: typeof language) =>
        id === "en"
            ? tr("English", "Anglais")
            : tr("French", "Français");

    return (
        <div className="language-selector">
            <label className="language-selector__label" htmlFor="settings-language-select">
                {tr("Display language", "Langue d'affichage")}
            </label>

            <div className="language-selector__dropdown" ref={dropdownRef}>
                <button
                    id="settings-language-select"
                    type="button"
                    className={`language-selector__trigger ${open ? "is-open" : ""}`}
                    onClick={() => setOpen((prev) => !prev)}
                    aria-haspopup="listbox"
                    aria-expanded={open}
                >
                    <span className="language-selector__trigger-left">
                        <FontAwesomeIcon icon={faGlobe} className="language-selector__globe" />
                        <span className="language-selector__code">{language.toUpperCase()}</span>
                        <span className="language-selector__text">{getOptionLabel(language)}</span>
                    </span>
                    <FontAwesomeIcon
                        icon={faChevronDown}
                        className={`language-selector__chevron ${open ? "is-open" : ""}`}
                    />
                </button>

                {open && (
                    <div className="language-selector__menu" role="listbox">
                        {availableLanguages.map((option) => {
                            const isSelected = option.id === language;
                            return (
                                <button
                                    key={option.id}
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    className={`language-selector__option ${isSelected ? "is-selected" : ""}`}
                                    onClick={() => handleSelectLanguage(option.id)}
                                >
                                    <span className="language-selector__option-left">
                                        <span className="language-selector__code">{option.code}</span>
                                        <span>{getOptionLabel(option.id)}</span>
                                    </span>
                                    {isSelected && (
                                        <FontAwesomeIcon
                                            icon={faCheck}
                                            className="language-selector__option-check"
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
