import BookSummaryDTO from "../../dto/BookSummary.dto.ts";
import "./BookList.scss";
import { Link } from "react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBook } from "@fortawesome/free-solid-svg-icons";

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
