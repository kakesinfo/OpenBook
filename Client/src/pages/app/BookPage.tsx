import { useParams, Link } from "react-router";
import { ReactNode, useEffect, useState } from "react";
import BookDTO, { AuthorSummaryDTO } from "../../dto/Book.dto";
import useSession, { SessionContextType } from "../../hooks/UseSession.tsx";
import { getSeriesStatusLabel } from "../../dto/Series.dto.ts";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faArrowLeft,
    faBook,
    faHeart,
    faPlus,
    faCheck,
    faCalendarDays,
    faBarcode,
    faRulerCombined,
    faWeightHanging,
    faFileLines,
    faTag,
    IconDefinition
} from "@fortawesome/free-solid-svg-icons";

import "./BookPage.scss";
import { WrapperHeader } from "../../components/Wrapper/Wrapper.tsx";

function ChangeBookStatusButton({
    status,
    setStatus,
    newStatus,
    children,
    bookId,
    session,
    icon
}: {
    status: string | null;
    setStatus: (s: string | null) => void;
    newStatus: string;
    children: ReactNode;
    bookId?: string;
    session?: SessionContextType;
    icon?: IconDefinition;
}) {
    const [processing, setProcessing] = useState(false);
    const isCurrent = status === newStatus;

    const handleClick = async () => {
        if (!newStatus || !bookId || !session || processing) return;
        setProcessing(true);
        try {
            if (isCurrent) {
                // Retirer le livre
                const url = `/user/removeBook/${encodeURIComponent(bookId)}`;
                const response = await session.customFetch(url, { method: "DELETE" });
                if (response.ok) setStatus(null);
            } else {
                // Ajouter / changer le statut
                const url = `/user/addBook/${encodeURIComponent(bookId)}/${encodeURIComponent(newStatus)}`;
                const response = await session.customFetch(url, { method: "POST" });
                if (response.ok) setStatus(newStatus);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <button
            type="button"
            className={`book-action-btn ${isCurrent ? 'book-action-btn--active' : ''}`}
            onClick={handleClick}
            disabled={processing}
        >
            <FontAwesomeIcon icon={isCurrent ? faCheck : (icon || faPlus)} />
            <span>{children}</span>
        </button>
    );
}

export default function BookPage() {
    const { id } = useParams<{ id?: string }>();
    const session = useSession();

    const [book, setBook] = useState<BookDTO | null>(null);
    const [bookStatus, setBookStatus] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;

        setLoading(true);
        setError(null);
        setBook(null);
        setBookStatus(null);

        const fetchUrl = `/books/${encodeURIComponent(id)}?withCollection=0&withEditor=0&withAuthors=1&withStatus=1`;
        session.customFetch(fetchUrl, {
            method: "GET",
        }).then(async (response) => {
            if (response.ok) {
                const data = await response.json();
                setBook(data);
                setBookStatus(data.status);
            } else {
                const errorText = await response.text();
                setError(`Erreur ${response.status}: ${errorText}`);
            }
        }).catch((err) => {
            setError(`Erreur de connexion: ${err.message}`);
        }).finally(() => {
            setLoading(false);
        });
    }, [id, session]);

    return (
        <div className="book-page">
            <WrapperHeader>
                <div className="book-page__header-nav">
                    <Link to="/app/home" className="book-page__back-link">
                        <FontAwesomeIcon icon={faArrowLeft} />
                        <span>Retour</span>
                    </Link>
                </div>
            </WrapperHeader>

            <div className="book-page__content">
                {loading && (
                    <div className="book-page__state">
                        <p>Chargement des détails de l'ouvrage...</p>
                    </div>
                )}

                {error && (
                    <div className="book-page__state book-page__state--error">
                        <p>{error}</p>
                    </div>
                )}

                {book && (
                    <div className="book-page__grid">
                        {/* Left column: Cover */}
                        <div className="book-page__cover-col">
                            <div className="book-page__cover-wrapper">
                                {book.coverUrl ? (
                                    <img
                                        src={book.coverUrl}
                                        alt={`Couverture de ${book.title}`}
                                        className="book-page__cover"
                                    />
                                ) : (
                                    <div className="book-page__cover-fallback">
                                        <FontAwesomeIcon icon={faBook} />
                                        <span>{book.title}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right column: Info & Actions */}
                        <div className="book-page__details-col">
                            {/* Badges */}
                            <div className="book-page__tags">
                                {book.series?.status && (
                                    <span className="book-page__tag book-page__tag--status">
                                        {getSeriesStatusLabel(book.series.status)}
                                    </span>
                                )}
                                {book.series?.totalVolumes && (
                                    <span className="book-page__tag book-page__tag--volume">
                                        Volume {book.volume} sur {book.series.totalVolumes}
                                    </span>
                                )}
                                {book.series?.category && (
                                    <span className="book-page__tag book-page__tag--category">
                                        {book.series.category}
                                    </span>
                                )}
                            </div>

                            {/* Titles */}
                            <div className="book-page__headings">
                                {book.series?.name && (
                                    <h2 className="book-page__series-title">{book.series.name}</h2>
                                )}
                                <h1 className="book-page__title">{book.title}</h1>

                                {book.authors && book.authors.length > 0 && (
                                    <p className="book-page__authors">
                                        Par {book.authors.map((a: AuthorSummaryDTO) => `${a.firstname} ${a.lastname}`).join(", ")}
                                    </p>
                                )}
                            </div>

                            {/* Description */}
                            {book.description && (
                                <div className="book-page__description">
                                    <p>{book.description}</p>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="book-page__actions">
                                {bookStatus !== "OWNED" && (
                                    <ChangeBookStatusButton
                                        status={bookStatus}
                                        setStatus={setBookStatus}
                                        newStatus="WISHLISTED"
                                        bookId={id}
                                        session={session}
                                        icon={faHeart}
                                    >
                                        {bookStatus === "WISHLISTED" ? "Dans les souhaits" : "Liste de souhaits"}
                                    </ChangeBookStatusButton>
                                )}

                                {bookStatus !== "WISHLISTED" && (
                                    <ChangeBookStatusButton
                                        status={bookStatus}
                                        setStatus={setBookStatus}
                                        newStatus="OWNED"
                                        bookId={id}
                                        session={session}
                                        icon={faBook}
                                    >
                                        {bookStatus === "OWNED" ? "Dans la collection" : "Ajouter à la collection"}
                                    </ChangeBookStatusButton>
                                )}
                            </div>

                            {/* Technical Details Card */}
                            <div className="book-page__specs-card">
                                <h3 className="book-page__specs-title">Détails techniques</h3>
                                <div className="book-page__specs-list">
                                    {book.releaseDate && (
                                        <div className="book-page__spec-item">
                                            <span className="book-page__spec-label">
                                                <FontAwesomeIcon icon={faCalendarDays} /> Date de sortie
                                            </span>
                                            <span className="book-page__spec-value">
                                                {new Date(book.releaseDate).toLocaleDateString()}
                                            </span>
                                        </div>
                                    )}

                                    {book.isbn && (
                                        <div className="book-page__spec-item">
                                            <span className="book-page__spec-label">
                                                <FontAwesomeIcon icon={faBarcode} /> ISBN
                                            </span>
                                            <span className="book-page__spec-value">{book.isbn}</span>
                                        </div>
                                    )}

                                    {(book.length || book.height || book.thickness) ? (
                                        <div className="book-page__spec-item">
                                            <span className="book-page__spec-label">
                                                <FontAwesomeIcon icon={faRulerCombined} /> Dimensions
                                            </span>
                                            <span className="book-page__spec-value">
                                                {book.length || 0} × {book.height || 0} × {book.thickness || 0} mm
                                            </span>
                                        </div>
                                    ) : null}

                                    {book.weight ? (
                                        <div className="book-page__spec-item">
                                            <span className="book-page__spec-label">
                                                <FontAwesomeIcon icon={faWeightHanging} /> Poids
                                            </span>
                                            <span className="book-page__spec-value">{book.weight} g</span>
                                        </div>
                                    ) : null}

                                    {book.pageCount ? (
                                        <div className="book-page__spec-item">
                                            <span className="book-page__spec-label">
                                                <FontAwesomeIcon icon={faFileLines} /> Pages
                                            </span>
                                            <span className="book-page__spec-value">{book.pageCount}</span>
                                        </div>
                                    ) : null}

                                    {book.price ? (
                                        <div className="book-page__spec-item">
                                            <span className="book-page__spec-label">
                                                <FontAwesomeIcon icon={faTag} /> Prix
                                            </span>
                                            <span className="book-page__spec-value">{book.price} €</span>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
