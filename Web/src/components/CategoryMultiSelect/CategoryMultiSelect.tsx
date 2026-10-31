import { useState, useRef, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faChevronDown,
    faCheck,
    faLayerGroup,
    faRotateLeft,
    faBolt,
    faBook,
    faFire,
    faBookOpen,
    faBookBookmark,
    faPalette,
    IconDefinition
} from "@fortawesome/free-solid-svg-icons";
import "./CategoryMultiSelect.scss";

export interface CategoryOption {
    id: string;
    label: string;
    icon?: IconDefinition;
}

export const DEFAULT_APP_CATEGORIES: CategoryOption[] = [
    { id: "Comics", label: "Comics", icon: faBolt },
    { id: "Bande dessinée", label: "Bande dessinée", icon: faBook },
    { id: "Manga", label: "Manga", icon: faFire },
    { id: "Roman Graphique", label: "Roman Graphique", icon: faBookOpen },
    { id: "Roman", label: "Roman", icon: faBookBookmark },
    { id: "Beau-livre", label: "Beau-livre", icon: faPalette },
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

        return bookCat.includes(sel) || bookType.includes(sel);
    });
}

interface CategoryMultiSelectProps {
    options: CategoryOption[];
    selected: string[];
    onChange: (selected: string[]) => void;
    allLabel?: string;
    placeholder?: string;
    className?: string;
}

export default function CategoryMultiSelect({
    options,
    selected,
    onChange,
    allLabel = "Toutes les catégories",
    placeholder = "Catégories",
    className = ""
}: CategoryMultiSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, []);

    const isAllSelected = selected.length === 0 || selected.length === options.length;

    const handleToggle = (id: string) => {
        if (isAllSelected) {
            // Isolates the clicked option when previously all were active
            onChange([id]);
        } else if (selected.includes(id)) {
            const next = selected.filter((item) => item !== id);
            onChange(next.length === 0 ? [] : next);
        } else {
            const next = [...selected, id];
            if (next.length === options.length) {
                onChange([]);
            } else {
                onChange(next);
            }
        }
    };

    const handleSelectAll = () => {
        onChange([]);
    };

    const getTriggerLabel = () => {
        if (isAllSelected) {
            return allLabel;
        }
        if (selected.length === 1) {
            const opt = options.find((o) => o.id === selected[0]);
            return opt ? opt.label : selected[0];
        }
        if (selected.length === 2) {
            const labels = selected
                .map((id) => options.find((o) => o.id === id)?.label || id)
                .join(", ");
            if (labels.length <= 18) return labels;
        }
        return `${selected.length} sélectionné${selected.length > 1 ? "s" : ""}`;
    };

    return (
        <div className={`category-multiselect ${isOpen ? "category-multiselect--open" : ""} ${className}`} ref={containerRef}>
            <button
                type="button"
                className={`category-multiselect__trigger ${!isAllSelected ? "category-multiselect__trigger--filtered" : ""}`}
                onClick={() => setIsOpen((prev) => !prev)}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <FontAwesomeIcon icon={faLayerGroup} className="category-multiselect__icon-left" />
                <span className="category-multiselect__label" title={getTriggerLabel()}>
                    {getTriggerLabel()}
                </span>
                {!isAllSelected && selected.length > 0 && (
                    <span className="category-multiselect__badge">
                        {selected.length}
                    </span>
                )}
                <FontAwesomeIcon
                    icon={faChevronDown}
                    className={`category-multiselect__chevron ${isOpen ? "is-open" : ""}`}
                />
            </button>

            {isOpen && (
                <div className="category-multiselect__dropdown" role="listbox">
                    <div className="category-multiselect__header">
                        <span className="category-multiselect__header-title">{placeholder}</span>
                        {!isAllSelected && (
                            <button
                                type="button"
                                className="category-multiselect__reset-btn"
                                onClick={handleSelectAll}
                                title="Afficher toutes les catégories"
                            >
                                <FontAwesomeIcon icon={faRotateLeft} />
                                <span>Tout afficher</span>
                            </button>
                        )}
                    </div>

                    <div
                        className={`category-multiselect__option category-multiselect__option--all ${isAllSelected ? "is-selected" : ""}`}
                        onClick={handleSelectAll}
                        role="option"
                        aria-selected={isAllSelected}
                    >
                        <div className={`category-multiselect__checkbox ${isAllSelected ? "is-checked" : ""}`}>
                            {isAllSelected && <FontAwesomeIcon icon={faCheck} />}
                        </div>
                        <FontAwesomeIcon icon={faLayerGroup} className="category-multiselect__option-icon" />
                        <span className="category-multiselect__option-label">{allLabel}</span>
                    </div>

                    <div className="category-multiselect__divider" />

                    <div className="category-multiselect__list">
                        {options.map((option) => {
                            const isChecked = !isAllSelected && selected.includes(option.id);

                            return (
                                <div
                                    key={option.id}
                                    className={`category-multiselect__option ${isChecked ? "is-selected" : ""}`}
                                    onClick={() => handleToggle(option.id)}
                                    role="option"
                                    aria-selected={isChecked}
                                >
                                    <div className={`category-multiselect__checkbox ${isChecked ? "is-checked" : ""}`}>
                                        {isChecked && <FontAwesomeIcon icon={faCheck} />}
                                    </div>
                                    {option.icon && (
                                        <FontAwesomeIcon
                                            icon={option.icon}
                                            className="category-multiselect__option-icon"
                                        />
                                    )}
                                    <span className="category-multiselect__option-label">
                                        {option.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
