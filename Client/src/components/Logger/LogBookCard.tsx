import './LogBookCard.scss';
import { useNavigate } from "react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight, faBook } from "@fortawesome/free-solid-svg-icons";
import BookSummaryDTO from "../../dto/BookSummary.dto.ts";

type Props = {
    book: BookSummaryDTO;
    onClose?: () => void;
};

export default function LogBookCard({ book, onClose }: Props) {
    const navigate = useNavigate();

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        onClose?.();
        navigate(`/app/book/${book.id}`);
    };

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
                <div className="logbook-card__title-row">
                    <h4 className="logbook-card__title">{book.title}</h4>
                    {book.volume !== undefined && (
                        <span className="logbook-card__volume">
                            {book.volume > 0 ? `Tome ${book.volume}` : 'One-shot'}
                        </span>
                    )}
                </div>
                {book.releaseDate && (
                    <span className="logbook-card__date">
                        {new Date(book.releaseDate).toLocaleDateString()}
                    </span>
                )}
            </div>

            <div className="logbook-card__action">
                <span className="logbook-card__arrow">
                    <FontAwesomeIcon icon={faArrowRight} />
                </span>
            </div>
        </li>
    );
}
