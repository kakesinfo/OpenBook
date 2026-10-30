import { useState, useRef, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faXmark, faCheck, faPlus } from "@fortawesome/free-solid-svg-icons";

interface Props {
    value: string;
    onChange: (val: string) => void;
    options: string[];
    placeholder?: string;
    emptyLabel?: string;
    openDirection?: "down" | "up";
    allowCustom?: boolean;
}

export default function SearchableSelect({
    value,
    onChange,
    options,
    placeholder = "Sélectionner...",
    emptyLabel = "-- Aucun --",
    openDirection = "down",
    allowCustom = true
}: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [isFiltering, setIsFiltering] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setIsFiltering(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const normalizedQuery = isFiltering ? value.trim().toLowerCase() : "";
    const filteredOptions = normalizedQuery
        ? options.filter((opt) => opt.toLowerCase().includes(normalizedQuery))
        : options;

    const isNoneQuery =
        normalizedQuery !== "" &&
        ("aucun".includes(normalizedQuery) ||
            "aucune".includes(normalizedQuery) ||
            emptyLabel.toLowerCase().includes(normalizedQuery));

    const showEmptyOption = !isFiltering || normalizedQuery === "" || isNoneQuery;

    const exactMatchExists = options.some(
        (opt) => opt.toLowerCase() === value.trim().toLowerCase()
    ) || ["aucun", "aucune"].includes(value.trim().toLowerCase());

    const handleSelectOption = (opt: string) => {
        onChange(opt);
        setIsOpen(false);
        setIsFiltering(false);
    };

    return (
        <div className="searchable-select" ref={containerRef}>
            <div className={`searchable-select__control ${isOpen ? "searchable-select__control--open" : ""}`}>
                <input
                    type="text"
                    value={value}
                    placeholder={placeholder}
                    onFocus={() => {
                        setIsOpen(true);
                        setIsFiltering(false);
                    }}
                    onClick={() => {
                        if (!isOpen) {
                            setIsOpen(true);
                            setIsFiltering(false);
                        }
                    }}
                    onChange={(e) => {
                        onChange(e.target.value);
                        setIsFiltering(true);
                        setIsOpen(true);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Escape") {
                            setIsOpen(false);
                            setIsFiltering(false);
                        } else if (e.key === "Enter" && isOpen) {
                            e.preventDefault();
                            if (filteredOptions.length === 1) {
                                handleSelectOption(filteredOptions[0]);
                            } else {
                                setIsOpen(false);
                                setIsFiltering(false);
                            }
                        }
                    }}
                />
                <div className="searchable-select__actions">
                    {value && (
                        <button
                            type="button"
                            className="searchable-select__clear-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                onChange("");
                                setIsFiltering(false);
                                setIsOpen(true);
                            }}
                            title="Effacer"
                            aria-label="Effacer"
                        >
                            <FontAwesomeIcon icon={faXmark} />
                        </button>
                    )}
                    <button
                        type="button"
                        className={`searchable-select__toggle-btn ${isOpen ? "searchable-select__toggle-btn--open" : ""}`}
                        onClick={() => {
                            const next = !isOpen;
                            setIsOpen(next);
                            if (next) setIsFiltering(false);
                        }}
                        tabIndex={-1}
                        aria-label="Ouvrir la liste"
                    >
                        <FontAwesomeIcon icon={faChevronDown} />
                    </button>
                </div>
            </div>

            {isOpen && (
                <div className={`searchable-select__menu ${openDirection === "up" ? "searchable-select__menu--up" : ""}`}>
                    {showEmptyOption && (
                        <button
                            type="button"
                            className={`searchable-select__option searchable-select__option--clear ${value.trim() === "" ? "searchable-select__option--selected" : ""}`}
                            onClick={() => handleSelectOption("")}
                        >
                            <span>{emptyLabel}</span>
                            {value.trim() === "" && <FontAwesomeIcon icon={faCheck} className="searchable-select__check" />}
                        </button>
                    )}

                    {allowCustom && value.trim() !== "" && !exactMatchExists && (
                        <button
                            type="button"
                            className="searchable-select__option searchable-select__option--create"
                            onClick={() => handleSelectOption(value.trim())}
                        >
                            <FontAwesomeIcon icon={faPlus} />
                            <span>Utiliser « {value.trim()} »</span>
                        </button>
                    )}

                    {filteredOptions.length > 0 ? (
                        filteredOptions.map((opt) => {
                            const isSelected = opt.toLowerCase() === value.trim().toLowerCase();
                            return (
                                <button
                                    type="button"
                                    key={opt}
                                    className={`searchable-select__option ${isSelected ? "searchable-select__option--selected" : ""}`}
                                    onClick={() => handleSelectOption(opt)}
                                >
                                    <span>{opt}</span>
                                    {isSelected && <FontAwesomeIcon icon={faCheck} className="searchable-select__check" />}
                                </button>
                            );
                        })
                    ) : (
                        !allowCustom && (
                            <div className="searchable-select__empty">
                                Aucun résultat
                            </div>
                        )
                    )}
                </div>
            )}
        </div>
    );
}
