import './LogBookCard.scss';
import { useNavigate } from "react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight, faBook, faCalendarDays } from "@fortawesome/free-solid-svg-icons";
import BookSummaryDTO from "../../dto/BookSummary.dto.ts";
import useLanguage from "../../hooks/UseLanguage.tsx";

type Props = {
    book: BookSummaryDTO;
    onClose?: () => void;
};

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

export default function LogBookCard({ book, onClose }: Props) {
    const navigate = useNavigate();
    const { locale, tr } = useLanguage();

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        onClose?.();
        navigate(`/app/book/${book.id}`);
    };

    const releaseDateFormatted = formatReleaseDate(book.releaseDate, locale);

    return (
        <li className="logbook-card" onClick={handleClick}>
            <div className="logbook-card__thumbnail">
                {book.coverUrl ? (
                    <img src={book.coverUrl} alt={book.title} loading="lazy" decoding="async" />
                ) : (
                    <FontAwesomeIcon icon={faBook} />
                )}
            </div>

            <div className="logbook-card__content">
                {book.seriesName && (
                    <span className="logbook-card__series">
                        {book.seriesName}
                    </span>
                )}
                <h4 className="logbook-card__title" title={book.title}>
                    {book.title}
                </h4>
                <div className="logbook-card__meta">
                    {book.volume !== undefined && book.volume !== null && (
                        <span className="logbook-card__volume">
                            {book.volume > 0 ? `${tr("Volume", "Tome")} ${book.volume}` : 'One-shot'}
                        </span>
                    )}
                    {releaseDateFormatted && (
                        <span className="logbook-card__date">
                            <FontAwesomeIcon icon={faCalendarDays} style={{ fontSize: "0.7rem", opacity: 0.7 }} />
                            <span>{releaseDateFormatted}</span>
                        </span>
                    )}
                </div>
            </div>

            <div className="logbook-card__action">
                <span className="logbook-card__arrow">
                    <FontAwesomeIcon icon={faArrowRight} />
                </span>
            </div>
        </li>
    );
}
