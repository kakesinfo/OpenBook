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
    faPenNib,
    faPalette,
    faPaintbrush,
    faBookBookmark,
    faTags,
    faChevronLeft,
    faChevronRight,
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
        window.scrollTo({ top: 0, behavior: "smooth" });
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

    // Author categorization
    const allAuthors = book?.authors || [];
    const dessinateurs = allAuthors.filter(
        (a) => a.type && (a.type.toLowerCase() === "illustrator" || a.type.toLowerCase().includes("dessin") || a.type.toLowerCase().includes("pencil") || a.type.toLowerCase().includes("artist"))
    );
    const coloristes = allAuthors.filter(
        (a) => a.type && (a.type.toLowerCase() === "colorist" || a.type.toLowerCase().includes("color") || a.type.toLowerCase().includes("couleur"))
    );
    const scenaristes = allAuthors.filter(
        (a) => !dessinateurs.includes(a) && !coloristes.includes(a)
    );

    const totalVolumes = book?.series?.totalVolumes
        ? Math.max(book.volume || 1, book.series.totalVolumes)
        : book?.volume;

    const hasPrevious = Boolean(book?.previousBookId);
    const canHavePrevious = Boolean(book?.volume != null && book.volume > 1);
    const showPrevious = hasPrevious || canHavePrevious;

    const hasNext = Boolean(book?.nextBookId);
    const canHaveNext = Boolean(
        book?.volume != null && totalVolumes != null && book.volume < totalVolumes
    );
    const showNext = hasNext || canHaveNext;

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
                        {/* Left column: Cover & Tome Navigation */}
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

                            {/* Navigation précédent / suivant le tome dans la série */}
                            {(showPrevious || showNext) && (
                                <div className="book-page__volume-nav">
                                    {showPrevious && (
                                        hasPrevious ? (
                                            <Link
                                                to={`/app/book/${book.previousBookId}`}
                                                className="book-page__volume-nav-btn book-page__volume-nav-btn--prev"
                                                title={book.previousBook?.title ? `Tome précédent : ${book.previousBook.title}` : "Tome précédent"}
                                            >
                                                <FontAwesomeIcon icon={faChevronLeft} />
                                                <span>Précédent</span>
                                            </Link>
                                        ) : (
                                            <button
                                                type="button"
                                                disabled
                                                className="book-page__volume-nav-btn book-page__volume-nav-btn--disabled book-page__volume-nav-btn--prev"
                                                title="Tome précédent non disponible dans la bibliothèque"
                                            >
                                                <FontAwesomeIcon icon={faChevronLeft} />
                                                <span>Précédent</span>
                                            </button>
                                        )
                                    )}
                                    {showNext && (
                                        hasNext ? (
                                            <Link
                                                to={`/app/book/${book.nextBookId}`}
                                                className="book-page__volume-nav-btn book-page__volume-nav-btn--next"
                                                title={book.nextBook?.title ? `Tome suivant : ${book.nextBook.title}` : "Tome suivant"}
                                            >
                                                <span>Suivant</span>
                                                <FontAwesomeIcon icon={faChevronRight} />
                                            </Link>
                                        ) : (
                                            <button
                                                type="button"
                                                disabled
                                                className="book-page__volume-nav-btn book-page__volume-nav-btn--disabled book-page__volume-nav-btn--next"
                                                title="Tome suivant non disponible dans la bibliothèque"
                                            >
                                                <span>Suivant</span>
                                                <FontAwesomeIcon icon={faChevronRight} />
                                            </button>
                                        )
                                    )}
                                </div>
                            )}
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
                                {book.volume != null && (
                                    <span className="book-page__tag book-page__tag--volume">
                                        Volume {book.volume} sur {Math.max(book.volume, book.series?.totalVolumes || book.volume)}
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
                                    {/* 1. Date de sortie */}
                                    {book.releaseDate && (
                                        <div className="book-page__spec-item">
                                            <span className="book-page__spec-label">
                                                <FontAwesomeIcon icon={faCalendarDays} /> Date de sortie
                                            </span>
                                            <span className="book-page__spec-value">
                                                {new Date(book.releaseDate).toLocaleDateString('fr-FR', {
                                                    day: 'numeric',
                                                    month: 'long',
                                                    year: 'numeric'
                                                })}
                                            </span>
                                        </div>
                                    )}

                                    {/* 2. Scénariste(s) */}
                                    {scenaristes.length > 0 && (
                                        <div className="book-page__spec-item">
                                            <span className="book-page__spec-label">
                                                <FontAwesomeIcon icon={faPenNib} /> Scénariste{scenaristes.length > 1 ? "s" : ""}
                                            </span>
                                            <span className="book-page__spec-value">
                                                {scenaristes.map((a: AuthorSummaryDTO) => `${a.firstname} ${a.lastname}`).join(", ")}
                                            </span>
                                        </div>
                                    )}

                                    {/* 3. Dessinateur(s) (s'il y en a) */}
                                    {dessinateurs.length > 0 && (
                                        <div className="book-page__spec-item">
                                            <span className="book-page__spec-label">
                                                <FontAwesomeIcon icon={faPalette} /> Dessinateur{dessinateurs.length > 1 ? "s" : ""}
                                            </span>
                                            <span className="book-page__spec-value">
                                                {dessinateurs.map((a: AuthorSummaryDTO) => `${a.firstname} ${a.lastname}`).join(", ")}
                                            </span>
                                        </div>
                                    )}

                                    {/* 4. Coloriste(s) (s'il y en a) */}
                                    {coloristes.length > 0 && (
                                        <div className="book-page__spec-item">
                                            <span className="book-page__spec-label">
                                                <FontAwesomeIcon icon={faPaintbrush} /> Coloriste{coloristes.length > 1 ? "s" : ""}
                                            </span>
                                            <span className="book-page__spec-value">
                                                {coloristes.map((a: AuthorSummaryDTO) => `${a.firstname} ${a.lastname}`).join(", ")}
                                            </span>
                                        </div>
                                    )}

                                    {/* 5. ISBN / EAN */}
                                    {book.isbn && (
                                        <div className="book-page__spec-item">
                                            <span className="book-page__spec-label">
                                                <FontAwesomeIcon icon={faBarcode} /> ISBN / EAN
                                            </span>
                                            <span className="book-page__spec-value">{book.isbn}</span>
                                        </div>
                                    )}

                                    {/* 6. Dimensions */}
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

                                    {/* 7. Poids */}
                                    {book.weight ? (
                                        <div className="book-page__spec-item">
                                            <span className="book-page__spec-label">
                                                <FontAwesomeIcon icon={faWeightHanging} /> Poids
                                            </span>
                                            <span className="book-page__spec-value">{book.weight} g</span>
                                        </div>
                                    ) : null}

                                    {/* 8. Pages */}
                                    {book.pageCount ? (
                                        <div className="book-page__spec-item">
                                            <span className="book-page__spec-label">
                                                <FontAwesomeIcon icon={faFileLines} /> Pages
                                            </span>
                                            <span className="book-page__spec-value">{book.pageCount} pages</span>
                                        </div>
                                    ) : null}

                                    {/* 9. Type (cartonné, relié, souple, etc.) */}
                                    {book.type && (
                                        <div className="book-page__spec-item">
                                            <span className="book-page__spec-label">
                                                <FontAwesomeIcon icon={faBookBookmark} /> Type
                                            </span>
                                            <span className="book-page__spec-value">{book.type}</span>
                                        </div>
                                    )}

                                    {/* 10. Thèmes (justice, gotham, enquête, aventure, scifi, etc.) */}
                                    {book.themes && book.themes.length > 0 && (
                                        <div className="book-page__spec-item book-page__spec-item--themes">
                                            <span className="book-page__spec-label">
                                                <FontAwesomeIcon icon={faTags} /> Thèmes
                                            </span>
                                            <div className="book-page__themes-list">
                                                {book.themes.map((theme: string) => (
                                                    <span key={theme} className="book-page__theme-pill">
                                                        {theme}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Prix */}
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
