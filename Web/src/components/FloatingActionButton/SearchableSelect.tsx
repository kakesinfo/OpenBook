import { useState, useRef, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faXmark, faCheck, faPlus } from "@fortawesome/free-solid-svg-icons";
import useLanguage from "../../hooks/UseLanguage.tsx";
import "./SearchableSelect.scss";

export type SearchableSelectOption = string | { label: string; value: string };

interface Props {
    value: string;
    onChange: (val: string) => void;
    options: SearchableSelectOption[];
    placeholder?: string;
    emptyLabel?: string;
    openDirection?: "down" | "up";
    allowCustom?: boolean;
    allowEmpty?: boolean;
    searchable?: boolean;
    id?: string;
    className?: string;
}

export default function SearchableSelect({
    value,
    onChange,
    options,
    placeholder,
    emptyLabel,
    openDirection = "down",
    allowCustom = true,
    allowEmpty = true,
    searchable = true,
    id,
    className = ""
}: Props) {
    const { tr } = useLanguage();
    const resolvedPlaceholder = placeholder && placeholder !== "Sélectionner..." ? placeholder : tr("Select...", "Sélectionner...");
    const resolvedEmptyLabel = emptyLabel && emptyLabel !== "-- Aucun --" ? emptyLabel : tr("-- None --", "-- Aucun --");
    const [isOpen, setIsOpen] = useState(false);
    const [isFiltering, setIsFiltering] = useState(false);
    const [filterQuery, setFilterQuery] = useState("");
    const containerRef = useRef<HTMLDivElement | null>(null);

    const getOptionValue = (opt: SearchableSelectOption): string =>
        typeof opt === "string" ? opt : opt.value;

    const getOptionLabel = (opt: SearchableSelectOption): string =>
        typeof opt === "string" ? opt : opt.label;

    const selectedOption = options.find((opt) => getOptionValue(opt) === value);
    const selectedLabel = selectedOption ? getOptionLabel(selectedOption) : value;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setIsFiltering(false);
                setFilterQuery("");
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const normalizedQuery = isFiltering ? filterQuery.trim().toLowerCase() : "";
    const filteredOptions = normalizedQuery
        ? options.filter((opt) => getOptionLabel(opt).toLowerCase().includes(normalizedQuery))
        : options;

    const isNoneQuery =
        normalizedQuery !== "" &&
        ("aucun".includes(normalizedQuery) ||
            "aucune".includes(normalizedQuery) ||
            "none".includes(normalizedQuery) ||
            resolvedEmptyLabel.toLowerCase().includes(normalizedQuery));

    const showEmptyOption = allowEmpty && (!isFiltering || normalizedQuery === "" || isNoneQuery);

    const exactMatchExists = options.some(
        (opt) =>
            getOptionLabel(opt).toLowerCase() === normalizedQuery ||
            getOptionValue(opt).toLowerCase() === normalizedQuery
    ) || ["aucun", "aucune", "none"].includes(normalizedQuery);

    const handleSelectOption = (opt: SearchableSelectOption | "") => {
        const nextVal = opt === "" ? "" : getOptionValue(opt);
        onChange(nextVal);
        setIsOpen(false);
        setIsFiltering(false);
        setFilterQuery("");
    };

    const toggleOpen = () => {
        setIsOpen((prev) => {
            const next = !prev;
            if (!next) {
                setIsFiltering(false);
                setFilterQuery("");
            }
            return next;
        });
    };

    const displayValue = isFiltering ? filterQuery : selectedLabel;

    return (
        <div className={`searchable-select ${className}`.trim()} ref={containerRef}>
            <div className={`searchable-select__control ${isOpen ? "searchable-select__control--open" : ""}`}>
                {searchable ? (
                    <input
                        id={id}
                        type="text"
                        value={displayValue}
                        placeholder={resolvedPlaceholder}
                        onClick={() => {
                            if (!isOpen) {
                                setIsOpen(true);
                                setIsFiltering(false);
                                setFilterQuery("");
                            }
                        }}
                        onFocus={() => {
                            setIsOpen(true);
                            setIsFiltering(false);
                        }}
                        onChange={(e) => {
                            setFilterQuery(e.target.value);
                            setIsFiltering(true);
                            setIsOpen(true);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "Escape") {
                                setIsOpen(false);
                                setIsFiltering(false);
                                setFilterQuery("");
                            } else if (e.key === "Enter" && isOpen) {
                                e.preventDefault();
                                if (filteredOptions.length === 1) {
                                    handleSelectOption(filteredOptions[0]);
                                } else {
                                    setIsOpen(false);
                                    setIsFiltering(false);
                                    setFilterQuery("");
                                }
                            }
                        }}
                    />
                ) : (
                    <button
                        id={id}
                        type="button"
                        className={`searchable-select__trigger ${!displayValue ? "searchable-select__trigger--placeholder" : ""}`}
                        onClick={toggleOpen}
                        aria-haspopup="listbox"
                        aria-expanded={isOpen}
                        onKeyDown={(e) => {
                            if (e.key === "Escape") {
                                setIsOpen(false);
                            } else if (e.key === " " || e.key === "Enter" || e.key === "ArrowDown") {
                                e.preventDefault();
                                setIsOpen(true);
                            }
                        }}
                    >
                        <span>{displayValue || resolvedPlaceholder}</span>
                    </button>
                )}

                <div className="searchable-select__actions">
                    {value && allowEmpty && (
                        <button
                            type="button"
                            className="searchable-select__clear-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                onChange("");
                                setIsFiltering(false);
                                setFilterQuery("");
                                setIsOpen(true);
                            }}
                            title={tr("Clear", "Effacer")}
                            aria-label={tr("Clear", "Effacer")}
                        >
                            <FontAwesomeIcon icon={faXmark} />
                        </button>
                    )}
                    <button
                        type="button"
                        className={`searchable-select__toggle-btn ${isOpen ? "searchable-select__toggle-btn--open" : ""}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleOpen();
                        }}
                        tabIndex={-1}
                        aria-label={tr("Open list", "Ouvrir la liste")}
                    >
                        <FontAwesomeIcon icon={faChevronDown} />
                    </button>
                </div>
            </div>

            {isOpen && (
                <div className={`searchable-select__menu ${openDirection === "up" ? "searchable-select__menu--up" : ""}`} role="listbox">
                    {showEmptyOption && (
                        <button
                            type="button"
                            role="option"
                            aria-selected={value.trim() === ""}
                            className={`searchable-select__option searchable-select__option--clear ${value.trim() === "" ? "searchable-select__option--selected" : ""}`}
                            onClick={() => handleSelectOption("")}
                        >
                            <span>{resolvedEmptyLabel}</span>
                            {value.trim() === "" && <FontAwesomeIcon icon={faCheck} className="searchable-select__check" />}
                        </button>
                    )}

                    {allowCustom && filterQuery.trim() !== "" && !exactMatchExists && (
                        <button
                            type="button"
                            className="searchable-select__option searchable-select__option--create"
                            onClick={() => handleSelectOption(filterQuery.trim())}
                        >
                            <FontAwesomeIcon icon={faPlus} />
                            <span>{tr(`Use "${filterQuery.trim()}"`, `Utiliser « ${filterQuery.trim()} »`)}</span>
                        </button>
                    )}

                    {filteredOptions.length > 0 ? (
                        filteredOptions.map((opt) => {
                            const optVal = getOptionValue(opt);
                            const optLabel = getOptionLabel(opt);
                            const isSelected = optVal.toLowerCase() === value.trim().toLowerCase();
                            return (
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    key={optVal}
                                    className={`searchable-select__option ${isSelected ? "searchable-select__option--selected" : ""}`}
                                    onClick={() => handleSelectOption(opt)}
                                >
                                    <span>{optLabel}</span>
                                    {isSelected && <FontAwesomeIcon icon={faCheck} className="searchable-select__check" />}
                                </button>
                            );
                        })
                    ) : (
                        !allowCustom && (
                            <div className="searchable-select__empty">
                                {tr("No results", "Aucun résultat")}
                            </div>
                        )
                    )}
                </div>
            )}
        </div>
    );
}
