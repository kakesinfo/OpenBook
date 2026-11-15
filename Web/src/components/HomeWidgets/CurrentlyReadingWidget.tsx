import { Link } from "react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faBookOpen,
    faClock,
    faArrowRight
} from "@fortawesome/free-solid-svg-icons";
import BookSummaryDTO from "../../dto/BookSummary.dto.ts";
import ReadingSessionDTO from "../../dto/ReadingSession.dto.ts";
import AsyncCoverImage from "../AsyncCoverImage/AsyncCoverImage.tsx";
import useLanguage from "../../hooks/UseLanguage.tsx";
import { formatDurationSeconds, getSessionTotalSeconds } from "./readingUtils.ts";

interface CurrentlyReadingWidgetProps {
    books: BookSummaryDTO[];
    sessions: ReadingSessionDTO[];
    loading?: boolean;
}

export default function CurrentlyReadingWidget({
    books,
    sessions,
    loading = false
}: CurrentlyReadingWidgetProps) {
    const { tr } = useLanguage();

    const getBookStats = (bookId: string) => {
        const numericId = Number(bookId);
        const bookSessions = sessions.filter((s) => s.bookId === numericId);
        let latestPage = 0;
        let totalSeconds = 0;
        let latestTs = 0;

        for (const s of bookSessions) {
            totalSeconds += getSessionTotalSeconds(s);
            if ((s.createdAt || 0) >= latestTs) {
                latestTs = s.createdAt || 0;
                latestPage = s.currentPage || 0;
            }
        }
        return { latestPage, totalSeconds };
    };

    if (loading) {
        return (
            <div className="home-widget home-reading-empty">
                <span style={{ color: "var(--text-muted)" }}>
                    {tr("Loading currently reading books...", "Chargement des lectures en cours...")}
                </span>
            </div>
        );
    }

    if (books.length === 0) {
        return (
            <div className="home-widget home-reading-empty">
                <div className="home-reading-empty__icon">
                    <FontAwesomeIcon icon={faBookOpen} />
                </div>
                <div className="home-reading-empty__content">
                    <h3>{tr("No books currently being read", "Aucune lecture en cours")}</h3>
                    <p>
                        {tr(
                            "Set a book's status to « Reading » from your library to follow your progress here.",
                            "Passez un livre au statut « En cours » depuis votre bibliothèque pour suivre vos progrès ici."
                        )}
                    </p>
                </div>
                <Link to="/app/collection" className="home-btn home-btn--primary">
                    <span>{tr("Open my library", "Ouvrir ma bibliothèque")}</span>
                    <FontAwesomeIcon icon={faArrowRight} />
                </Link>
            </div>
        );
    }

    return (
        <div className="home-reading-grid">
            {books.map((book) => {
                const stats = getBookStats(book.id);
                const totalPages = book.pageCount || 0;
                const progressPct = totalPages > 0
                    ? Math.min(100, Math.round((stats.latestPage / totalPages) * 100))
                    : null;

                return (
                    <div key={book.id} className="home-widget home-reading-card">
                        <Link to={`/app/book/${book.id}`} className="home-reading-card__cover">
                            <AsyncCoverImage
                                src={book.coverUrl}
                                alt={book.title}
                                title={book.title}
                            />
                            {book.volume > 0 && (
                                <span className="home-reading-card__vol">#{book.volume}</span>
                            )}
                        </Link>

                        <div className="home-reading-card__body">
                            <div className="home-reading-card__top">
                                <Link to={`/app/book/${book.id}`} className="home-reading-card__title">
                                    {book.title}
                                </Link>
                                {(book.seriesName || book.author) && (
                                    <span className="home-reading-card__subtitle">
                                        {[book.seriesName, book.author].filter(Boolean).join(" • ")}
                                    </span>
                                )}
                            </div>

                            <div className="home-reading-card__progress-block">
                                <div className="home-reading-card__progress-meta">
                                    <span>
                                        {totalPages > 0
                                            ? `p. ${stats.latestPage} / ${totalPages}`
                                            : stats.latestPage > 0
                                                ? `p. ${stats.latestPage}`
                                                : tr("In progress", "En cours")}
                                    </span>
                                    {progressPct !== null && (
                                        <span className="home-reading-card__pct">{progressPct}%</span>
                                    )}
                                </div>
                                {progressPct !== null && (
                                    <div className="home-reading-card__bar">
                                        <div
                                            className="home-reading-card__bar-fill"
                                            style={{ width: `${progressPct}%` }}
                                        />
                                    </div>
                                )}
                                {stats.totalSeconds > 0 && (
                                    <div className="home-reading-card__time">
                                        <FontAwesomeIcon icon={faClock} />
                                        <span>{formatDurationSeconds(stats.totalSeconds)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
