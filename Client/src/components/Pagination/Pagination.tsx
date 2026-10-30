import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faChevronLeft,
    faChevronRight,
    faAnglesLeft,
    faAnglesRight
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
                    <div className="pagination__size-selector">
                        <span>Par page :</span>
                        <select
                            value={pageSize}
                            onChange={(e) => onPageSizeChange(Number(e.target.value))}
                            aria-label="Nombre d'éléments par page"
                        >
                            {pageSizeOptions.map((opt) => (
                                <option key={opt} value={opt}>
                                    {opt === 0 ? "Tous" : opt}
                                </option>
                            ))}
                        </select>
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
