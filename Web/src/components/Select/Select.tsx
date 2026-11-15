import { useState, useRef, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faChevronDown,
    faCheck,
    faLayerGroup,
    faRotateLeft,
    faMagnifyingGlass,
    faPlus,
    faXmark,
    faBolt,
    faBook,
    faFire,
    faBookOpen,
    faBookBookmark,
    faPalette,
    faTabletScreenButton,
    type IconDefinition
} from "@fortawesome/free-solid-svg-icons";
import useLanguage from "../../hooks/UseLanguage.tsx";
import "./Select.scss";

export interface CategoryOption {
    id: string;
    label: string;
    icon?: IconDefinition;
}

export type SelectOption =
    | string
    | { id?: string; value?: string; label: string; icon?: IconDefinition };

export type SearchableSelectOption = SelectOption;

export const DEFAULT_APP_CATEGORIES: CategoryOption[] = [
    { id: "Comics", label: "Comics", icon: faBolt },
    { id: "Bande dessinée", label: "Bande dessinée", icon: faBook },
    { id: "Manga", label: "Manga", icon: faFire },
    { id: "Roman Graphique", label: "Roman Graphique", icon: faBookOpen },
    { id: "Roman", label: "Roman", icon: faBookBookmark },
    { id: "Beau-livre", label: "Beau-livre", icon: faPalette },
    { id: "E-book", label: "E-book", icon: faTabletScreenButton }
];

export function bookMatchesCategories(
    book: { category?: string | null; type?: string | null },
    selectedCategories: string[]
): boolean {
    if (selectedCategories.length === 0) return true;

    const bookCat = (book.category || "").trim().toLowerCase();
    const bookType = (book.type || "").trim().toLowerCase();

    return selectedCategories.some((selected) => {
        const sel = selected.trim().toLowerCase();
        if (bookCat === sel || bookType === sel) return true;

        if (sel === "bande dessinée" || sel === "bande dessinee" || sel === "bd") {
            return (
                bookCat.includes("bande") ||
                bookCat.includes("bd") ||
                bookType.includes("bande") ||
                bookType.includes("bd") ||
                bookType.includes("cartonné") ||
                bookType.includes("cartonne") ||
                bookType.includes("souple")
            );
        }
        if (sel === "comics") {
            return bookCat.includes("comic") || bookType.includes("comic");
        }
        if (sel === "manga") {
            return bookCat.includes("manga") || bookType.includes("manga");
        }
        if (sel === "roman graphique") {
            return bookCat.includes("roman graphique") || bookType.includes("roman graphique");
        }
        if (sel === "roman") {
            const isRomanCat = bookCat.includes("roman") && !bookCat.includes("graphique");
            const isRomanType = bookType.includes("roman") && !bookType.includes("graphique");
            return isRomanCat || isRomanType;
        }
        if (sel === "beau-livre" || sel === "beau livre") {
            return (
                bookCat.includes("beau-livre") ||
                bookCat.includes("beau livre") ||
                bookType.includes("beau-livre") ||
                bookType.includes("beau livre")
            );
        }
        if (sel === "e-book" || sel === "ebook" || sel === "e book") {
            return (
                bookCat.includes("e-book") ||
                bookCat.includes("ebook") ||
                bookCat.includes("e book") ||
                bookType.includes("e-book") ||
                bookType.includes("ebook") ||
                bookType.includes("e book")
            );
        }

        return bookCat.includes(sel) || bookType.includes(sel);
    });
}

interface NormalizedOption {
    id: string;
    label: string;
    icon?: IconDefinition;
}

function normalizeOption(opt: SelectOption): NormalizedOption {
    if (typeof opt === "string") {
        return { id: opt, label: opt };
    }
    return {
        id: opt.id ?? opt.value ?? opt.label,
        label: opt.label,
        icon: opt.icon
    };
}

export interface SelectProps {
    options: SelectOption[];
    multiple?: boolean;
    value?: string;
    selected?: string[];
    onChange: (value: any) => void;
    allLabel?: string;
    placeholder?: string;
    emptyLabel?: string;
    openDirection?: "down" | "up";
    allowCustom?: boolean;
    allowEmpty?: boolean;
    searchable?: boolean;
    translateOptions?: boolean;
    icon?: IconDefinition;
    id?: string;
    className?: string;
}

export default function Select({
    options,
    multiple,
    value,
    selected,
    onChange,
    allLabel,
    placeholder,
    emptyLabel,
    openDirection = "down",
    allowCustom = false,
    allowEmpty = false,
    searchable = false,
    translateOptions = false,
    icon,
    id,
    className = ""
}: SelectProps) {
    const { tr, translateCategory } = useLanguage();
    const isMultiple = multiple ?? Array.isArray(selected);
    const selectedList = isMultiple
        ? (selected ?? [])
        : (value !== undefined && value !== "" ? [value] : []);

    const resolvedAllLabel = allLabel && allLabel !== "Toutes les catégories"
        ? allLabel
        : tr("All categories", "Toutes les catégories");
    const resolvedPlaceholder = placeholder && placeholder !== "Catégories" && placeholder !== "Sélectionner..."
        ? placeholder
        : isMultiple
            ? tr("Categories", "Catégories")
            : tr("Select...", "Sélectionner...");
    const resolvedEmptyLabel = emptyLabel && emptyLabel !== "-- Aucun --"
        ? emptyLabel
        : tr("-- None --", "-- Aucun --");

    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const containerRef = useRef<HTMLDivElement | null>(null);
    const searchInputRef = useRef<HTMLInputElement | null>(null);

    const normalizedOptions = options.map(normalizeOption);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchQuery("");
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsOpen(false);
                setSearchQuery("");
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, []);

    useEffect(() => {
        if (isOpen && searchable) {
            setTimeout(() => searchInputRef.current?.focus(), 0);
        }
    }, [isOpen, searchable]);

    const formatLabel = (lbl: string) => (translateOptions ? translateCategory(lbl) : lbl);

    const isAllSelected = isMultiple && (selectedList.length === 0 || selectedList.length === normalizedOptions.length);

    const handleToggle = (optId: string) => {
        if (!isMultiple) {
            onChange(optId);
            setIsOpen(false);
            setSearchQuery("");
            return;
        }
        if (isAllSelected) {
            onChange([optId]);
        } else if (selectedList.includes(optId)) {
            const next = selectedList.filter((item) => item !== optId);
            onChange(next.length === 0 ? [] : next);
        } else {
            const next = [...selectedList, optId];
            onChange(next.length === normalizedOptions.length ? [] : next);
        }
    };

    const handleSelectAll = () => {
        onChange([]);
    };

    const handleClearSingle = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange("");
    };

    const getTriggerLabel = () => {
        if (!isMultiple) {
            if (!value) return resolvedPlaceholder;
            const opt = normalizedOptions.find((o) => o.id === value);
            return opt ? formatLabel(opt.label) : value;
        }
        if (isAllSelected) {
            return resolvedAllLabel;
        }
        if (selectedList.length === 1) {
            const opt = normalizedOptions.find((o) => o.id === selectedList[0]);
            return formatLabel(opt ? opt.label : selectedList[0]);
        }
        if (selectedList.length === 2) {
            const labels = selectedList
                .map((itemId) => formatLabel(normalizedOptions.find((o) => o.id === itemId)?.label || itemId))
                .join(", ");
            if (labels.length <= 18) return labels;
        }
        return tr(
            `${selectedList.length} selected`,
            `${selectedList.length} sélectionné${selectedList.length > 1 ? "s" : ""}`
        );
    };

    const normalizedQuery = searchable ? searchQuery.trim().toLowerCase() : "";
    const filteredOptions = normalizedQuery
        ? normalizedOptions.filter((opt) => formatLabel(opt.label).toLowerCase().includes(normalizedQuery))
        : normalizedOptions;

    const showEmptyOption = !isMultiple && allowEmpty && (
        normalizedQuery === "" ||
        resolvedEmptyLabel.toLowerCase().includes(normalizedQuery) ||
        "aucun".includes(normalizedQuery) ||
        "none".includes(normalizedQuery)
    );

    const exactMatchExists = normalizedOptions.some(
        (opt) =>
            opt.label.toLowerCase() === normalizedQuery ||
            opt.id.toLowerCase() === normalizedQuery
    );

    const triggerIcon = icon ?? (isMultiple ? faLayerGroup : undefined);
    const isFiltered = isMultiple && !isAllSelected;

    return (
        <div
            className={`yal-select ${isOpen ? "yal-select--open" : ""} ${!isMultiple ? "yal-select--block" : ""} ${className}`.trim()}
            ref={containerRef}
        >
            <button
                id={id}
                type="button"
                className={`yal-select__trigger ${isFiltered ? "yal-select__trigger--filtered" : ""}`}
                onClick={() => {
                    setIsOpen((prev) => !prev);
                    if (isOpen) setSearchQuery("");
                }}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                {triggerIcon && (
                    <FontAwesomeIcon icon={triggerIcon} className="yal-select__icon-left" />
                )}
                <span className="yal-select__label" title={getTriggerLabel()}>
                    {getTriggerLabel()}
                </span>
                {isMultiple && !isAllSelected && selectedList.length > 0 && (
                    <span className="yal-select__badge">{selectedList.length}</span>
                )}
                {!isMultiple && allowEmpty && value && (
                    <span
                        role="button"
                        tabIndex={-1}
                        className="yal-select__clear-btn"
                        onClick={handleClearSingle}
                        aria-label={tr("Clear", "Effacer")}
                    >
                        <FontAwesomeIcon icon={faXmark} />
                    </span>
                )}
                <FontAwesomeIcon
                    icon={faChevronDown}
                    className={`yal-select__chevron ${isOpen ? "is-open" : ""}`}
                />
            </button>

            {isOpen && (
                <div
                    className={`yal-select__dropdown ${openDirection === "up" ? "yal-select__dropdown--up" : ""}`}
                    role="listbox"
                >
                    <div className="yal-select__header">
                        <span className="yal-select__header-title">{resolvedPlaceholder}</span>
                        {isMultiple && !isAllSelected && (
                            <button
                                type="button"
                                className="yal-select__reset-btn"
                                onClick={handleSelectAll}
                                title={tr("Show all categories", "Afficher toutes les catégories")}
                            >
                                <FontAwesomeIcon icon={faRotateLeft} />
                                <span>{tr("Show all", "Tout afficher")}</span>
                            </button>
                        )}
                    </div>

                    {searchable && (
                        <div className="yal-select__search">
                            <FontAwesomeIcon icon={faMagnifyingGlass} />
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={tr("Search...", "Rechercher...")}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && allowCustom && searchQuery.trim() && !exactMatchExists) {
                                        e.preventDefault();
                                        handleToggle(searchQuery.trim());
                                    }
                                }}
                            />
                        </div>
                    )}

                    {isMultiple && (
                        <>
                            <div
                                className={`yal-select__option yal-select__option--all ${isAllSelected ? "is-selected" : ""}`}
                                onClick={handleSelectAll}
                                role="option"
                                aria-selected={isAllSelected}
                            >
                                <div className={`yal-select__checkbox ${isAllSelected ? "is-checked" : ""}`}>
                                    {isAllSelected && <FontAwesomeIcon icon={faCheck} />}
                                </div>
                                <FontAwesomeIcon icon={triggerIcon ?? faLayerGroup} className="yal-select__option-icon" />
                                <span className="yal-select__option-label">{resolvedAllLabel}</span>
                            </div>

                            <div className="yal-select__divider" />
                        </>
                    )}

                    <div className="yal-select__list">
                        {showEmptyOption && (
                            <div
                                className={`yal-select__option ${!value ? "is-selected" : ""}`}
                                onClick={() => handleToggle("")}
                                role="option"
                                aria-selected={!value}
                            >
                                <div className={`yal-select__checkbox ${!value ? "is-checked" : ""}`}>
                                    {!value && <FontAwesomeIcon icon={faCheck} />}
                                </div>
                                <span className="yal-select__option-label">{resolvedEmptyLabel}</span>
                            </div>
                        )}

                        {filteredOptions.map((option) => {
                            const isChecked = isMultiple
                                ? (!isAllSelected && selectedList.includes(option.id))
                                : value === option.id;

                            return (
                                <div
                                    key={option.id}
                                    className={`yal-select__option ${isChecked ? "is-selected" : ""}`}
                                    onClick={() => handleToggle(option.id)}
                                    role="option"
                                    aria-selected={isChecked}
                                >
                                    <div className={`yal-select__checkbox ${isChecked ? "is-checked" : ""}`}>
                                        {isChecked && <FontAwesomeIcon icon={faCheck} />}
                                    </div>
                                    {option.icon && (
                                        <FontAwesomeIcon
                                            icon={option.icon}
                                            className="yal-select__option-icon"
                                        />
                                    )}
                                    <span className="yal-select__option-label">
                                        {formatLabel(option.label)}
                                    </span>
                                </div>
                            );
                        })}

                        {!isMultiple && allowCustom && normalizedQuery !== "" && !exactMatchExists && (
                            <div
                                className="yal-select__option yal-select__option--create"
                                onClick={() => handleToggle(searchQuery.trim())}
                                role="option"
                                aria-selected={false}
                            >
                                <FontAwesomeIcon icon={faPlus} className="yal-select__option-icon" />
                                <span className="yal-select__option-label">
                                    {tr(`Use "${searchQuery.trim()}"`, `Utiliser "${searchQuery.trim()}"`)}
                                </span>
                            </div>
                        )}

                        {filteredOptions.length === 0 && !showEmptyOption && !(allowCustom && normalizedQuery !== "") && (
                            <div className="yal-select__empty">
                                {tr("No results", "Aucun résultat")}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
