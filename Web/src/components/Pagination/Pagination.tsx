import { useState, useRef, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faChevronLeft,
    faChevronRight,
    faAnglesLeft,
    faAnglesRight,
    faChevronDown,
    faCheck
} from "@fortawesome/free-solid-svg-icons";
import "./Pagination.scss";

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    totalItems?: number;
    startIndex?: number;
    endIndex?: number;
    pageSize?: number;
    onPageSizeChange?: (size: number) => void;
    pageSizeOptions?: number[];
    itemLabel?: string;
}

function getPaginationItems(current: number, total: number): (number | string)[] {
    if (total <= 7) {
        return Array.from({ length: total }, (_, i) => i + 1);
    }
    if (current <= 3) {
        return [1, 2, 3, 4, "ellipsis-next", total];
    }
    if (current >= total - 2) {
        return [1, "ellipsis-prev", total - 3, total - 2, total - 1, total];
    }
    return [1, "ellipsis-prev", current - 1, current, current + 1, "ellipsis-next", total];
}

export default function Pagination({
    currentPage,
    totalPages,
    onPageChange,
    totalItems,
    startIndex = 0,
    endIndex = 0,
    pageSize,
    onPageSizeChange,
    pageSizeOptions = [20, 50, 100],
    itemLabel = "livres"
}: PaginationProps) {
    const [sizeMenuOpen, setSizeMenuOpen] = useState(false);
    const sizeDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (sizeDropdownRef.current && !sizeDropdownRef.current.contains(e.target as Node)) {
                setSizeMenuOpen(false);
            }
        }
        if (sizeMenuOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [sizeMenuOpen]);

    if (!totalItems || totalItems === 0 || totalPages === 0) {
        return null;
    }

    const pages = getPaginationItems(currentPage, totalPages);

    return (
        <nav className="pagination" aria-label="Pagination">
            <div className="pagination__info">
                {totalItems !== undefined && (
                    <span className="pagination__count">
                        Affichage de <strong>{totalItems === 0 ? 0 : startIndex + 1}</strong> à{" "}
                        <strong>{endIndex}</strong> sur <strong>{totalItems.toLocaleString("fr-FR")}</strong> {itemLabel}
                    </span>
                )}

                {pageSize !== undefined && pageSize !== null && onPageSizeChange && (
                    <div
                        ref={sizeDropdownRef}
                        className={`pagination__size-dropdown ${sizeMenuOpen ? "is-open" : ""}`}
                    >
                        <button
                            type="button"
                            className="pagination__size-trigger"
                            onClick={() => setSizeMenuOpen((prev) => !prev)}
                            aria-haspopup="listbox"
                            aria-expanded={sizeMenuOpen}
                            aria-label="Nombre d'éléments par page"
                        >
                            <span className="pagination__size-label">Par page :</span>
                            <span className="pagination__size-value">
                                {pageSize === 0 ? "Tous" : pageSize}
                            </span>
                            <FontAwesomeIcon
                                icon={faChevronDown}
                                className={`pagination__size-chevron ${sizeMenuOpen ? "is-open" : ""}`}
                            />
                        </button>

                        {sizeMenuOpen && (
                            <div className="pagination__size-menu" role="listbox">
                                {pageSizeOptions.map((opt) => {
                                    const isSelected = opt === pageSize;
                                    return (
                                        <button
                                            key={opt}
                                            type="button"
                                            role="option"
                                            aria-selected={isSelected}
                                            className={`pagination__size-option ${isSelected ? "is-selected" : ""}`}
                                            onClick={() => {
                                                onPageSizeChange(opt);
                                                setSizeMenuOpen(false);
                                            }}
                                        >
                                            <span>{opt === 0 ? "Tous" : opt}</span>
                                            {isSelected && (
                                                <FontAwesomeIcon icon={faCheck} className="pagination__size-check" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {totalPages > 1 && (
                <div className="pagination__controls">
                    {/* Première page */}
                    <button
                        type="button"
                        className="pagination__btn pagination__btn--nav"
                        onClick={() => onPageChange(1)}
                        disabled={currentPage <= 1}
                        title="Première page"
                        aria-label="Première page"
                    >
                        <FontAwesomeIcon icon={faAnglesLeft} />
                    </button>

                    {/* Page précédente */}
                    <button
                        type="button"
                        className="pagination__btn pagination__btn--nav"
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage <= 1}
                        title="Page précédente"
                        aria-label="Page précédente"
                    >
                        <FontAwesomeIcon icon={faChevronLeft} />
                    </button>

                    {/* Numéros de page */}
                    <div className="pagination__pages">
                        {pages.map((p, idx) => {
                            if (typeof p === "string") {
                                return (
                                    <span key={`ellipsis-${idx}`} className="pagination__ellipsis" aria-hidden="true">
                                        &hellip;
                                    </span>
                                );
                            }

                            const isCurrent = p === currentPage;
                            return (
                                <button
                                    key={p}
                                    type="button"
                                    className={`pagination__btn pagination__btn--page ${isCurrent ? "is-active" : ""}`}
                                    onClick={() => onPageChange(p)}
                                    aria-current={isCurrent ? "page" : undefined}
                                    aria-label={`Page ${p}`}
                                >
                                    {p}
                                </button>
                            );
                        })}
                    </div>

                    {/* Page suivante */}
                    <button
                        type="button"
                        className="pagination__btn pagination__btn--nav"
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage >= totalPages}
                        title="Page suivante"
                        aria-label="Page suivante"
                    >
                        <FontAwesomeIcon icon={faChevronRight} />
                    </button>

                    {/* Dernière page */}
                    <button
                        type="button"
                        className="pagination__btn pagination__btn--nav"
                        onClick={() => onPageChange(totalPages)}
                        disabled={currentPage >= totalPages}
                        title="Dernière page"
                        aria-label="Dernière page"
                    >
                        <FontAwesomeIcon icon={faAnglesRight} />
                    </button>
                </div>
            )}
        </nav>
    );
}
