import { ReactNode } from "react";
import { Link } from "react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendarDays } from "@fortawesome/free-solid-svg-icons";
import BookSummaryDTO from "../../dto/BookSummary.dto.ts";
import AsyncCoverImage from "../AsyncCoverImage/AsyncCoverImage.tsx";
import useLanguage from "../../hooks/UseLanguage.tsx";
import "./BookCard.scss";

interface BookCardProps {
    book: BookSummaryDTO;
    actions?: ReactNode;
    statusBadge?: ReactNode;
    badgeText?: string;
    showReleaseDate?: boolean;
    className?: string;
}

function formatReleaseDate(dateStr: string | undefined, locale: string): string | null {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date.toLocaleDateString(locale, {
        day: "numeric",
        month: "long",
        year: "numeric"
    });
}

export default function BookCard({
    book,
    actions,
    statusBadge,
    badgeText,
    showReleaseDate = false,
    className = ""
}: BookCardProps) {
    const { locale, tr } = useLanguage();
    const releaseDate = showReleaseDate ? formatReleaseDate(book.releaseDate, locale) : null;

    return (
        <div className={`book-card ${className}`.trim()}>
            <div className="book-card__cover-wrapper">
                <Link to={`/app/book/${book.id}`} className="book-card__cover-link">
                    <AsyncCoverImage
                        src={book.coverUrl}
                        alt={tr(`Cover of ${book.title}`, `Couverture de ${book.title}`)}
                        title={book.title}
                    />
                </Link>

                {statusBadge}
                {badgeText && <span className="book-card__badge">{badgeText}</span>}
                {actions && <div className="book-card__actions">{actions}</div>}
            </div>

            <div className="book-card__info">
                <Link to={`/app/book/${book.id}`} className="book-card__title" title={book.title}>
                    {book.title}
                </Link>
                {book.seriesName && (
                    <span className="book-card__series" title={book.seriesName}>
                        {book.seriesName}
                    </span>
                )}
                {releaseDate && (
                    <span className="book-card__release-date">
                        <FontAwesomeIcon icon={faCalendarDays} />
                        <span>{releaseDate}</span>
                    </span>
                )}
            </div>
        </div>
    );
}
