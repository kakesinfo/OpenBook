import BookSummaryDTO from "../../dto/BookSummary.dto.ts";
import "./BookList.scss";
import { Link } from "react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBook } from "@fortawesome/free-solid-svg-icons";

function getStatusBadge(book: BookSummaryDTO) {
    if (book.status === "FOR_SALE") {
        return <span className="booklist-card__status-badge is-for-sale">À vendre</span>;
    }
    const rStatus = (book.readingStatus || "").toUpperCase();
    if (rStatus === "READ" || rStatus === "LU") {
        return <span className="booklist-card__status-badge is-read">Lu</span>;
    }
    if (rStatus === "TO_READ" || rStatus === "A_LIRE" || rStatus === "PILE_A_LIRE") {
        return <span className="booklist-card__status-badge is-toread">À lire</span>;
    }
    if (rStatus === "READING" || rStatus === "EN_COURS") {
        return <span className="booklist-card__status-badge is-reading">En cours</span>;
    }
    if (rStatus === "ABANDONED" || rStatus === "ABANDONNE") {
        return <span className="booklist-card__status-badge is-abandoned">Abandonné</span>;
    }
    return null;
}

export default function BookList({ books }: { books: BookSummaryDTO[] }) {
    if (!books || books.length === 0) {
        return (
            <div className="booklist-empty">
                <div className="booklist-empty__icon">
                    <FontAwesomeIcon icon={faBook} />
                </div>
                <h3>Aucun livre disponible</h3>
                <p>Aucun ouvrage ne correspond à votre sélection pour le moment.</p>
            </div>
        );
    }

    return (
        <div className="booklist">
            {books.map((book) => (
                <Link to={`/app/book/${book.id}`} className="booklist-card" key={book.id}>
                    <div className="booklist-card__cover-wrapper">
                        {book.coverUrl ? (
                            <img
                                className="booklist-card__cover"
                                src={book.coverUrl}
                                alt={`Couverture de ${book.title}`}
                                loading="lazy"
                                decoding="async"
                            />
                        ) : (
                            <div className="booklist-card__cover-fallback">
                                <FontAwesomeIcon icon={faBook} />
                                <span>{book.title}</span>
                            </div>
                        )}

                        {/* Status Badge top-left */}
                        {getStatusBadge(book)}

                        {/* Volume Badge top-right */}
                        <span className="booklist-card__badge">
                            {book.volume > 0 ? `Vol. ${book.volume}` : `Unique`}
                        </span>
                    </div>

                    <div className="booklist-card__info">
                        <h3 className="booklist-card__title" title={book.title}>
                            {book.title}
                        </h3>
                        <p className="booklist-card__subtitle">
                            {book.volume > 0 ? `Tome ${book.volume}` : `Tome unique`}
                        </p>
                    </div>
                </Link>
            ))}
        </div>
    );
}
