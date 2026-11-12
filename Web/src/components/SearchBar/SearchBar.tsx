import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faXmark } from "@fortawesome/free-solid-svg-icons";
import "./SearchBar.scss";

interface SearchBarProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    clearLabel?: string;
    className?: string;
}

export default function SearchBar({
    value,
    onChange,
    placeholder = "Rechercher...",
    clearLabel = "Effacer la recherche",
    className = ""
}: SearchBarProps) {
    return (
        <div className={`shared-search-bar ${className}`.trim()}>
            <FontAwesomeIcon icon={faMagnifyingGlass} />
            <input
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
            {value && (
                <button
                    type="button"
                    className="shared-search-bar__clear"
                    onClick={() => onChange("")}
                    aria-label={clearLabel}
                >
                    <FontAwesomeIcon icon={faXmark} />
                </button>
            )}
        </div>
    );
}
