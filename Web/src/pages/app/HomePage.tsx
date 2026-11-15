import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faBook,
    faBookOpen,
    faBookmark,
    faHeart,
    faCalendarDays,
    faChevronRight
} from "@fortawesome/free-solid-svg-icons";
import { WrapperHeader } from "../../components/Wrapper/Wrapper.tsx";
import BookSummaryDTO from "../../dto/BookSummary.dto.ts";
import ReadingSessionDTO from "../../dto/ReadingSession.dto.ts";
import useSession from "../../hooks/UseSession.tsx";
import useLanguage from "../../hooks/UseLanguage.tsx";
import ReadingStreakWidget from "../../components/HomeWidgets/ReadingStreakWidget.tsx";

import "./HomePage.scss";

export default function HomePage() {
    const session = useSession();
    const { tr } = useLanguage();

    const [collectionBooks, setCollectionBooks] = useState<BookSummaryDTO[]>([]);
    const [wishlistCount, setWishlistCount] = useState<number>(0);
    const [readingSessions, setReadingSessions] = useState<ReadingSessionDTO[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);

        Promise.all([
            session.customFetch("/user/collection", { method: "GET" })
                .then(async (res) => (res.ok ? await res.json() : []))
                .catch(() => []),
            session.customFetch("/user/wishlist", { method: "GET" })
                .then(async (res) => (res.ok ? await res.json() : []))
                .catch(() => []),
            session.customFetch("/user/readingSessions", { method: "GET" })
                .then(async (res) => (res.ok ? await res.json() : []))
                .catch(() => [])
        ])
            .then(([colData, wishData, sessionsData]) => {
                if (cancelled) return;
                const booksList: BookSummaryDTO[] = Array.isArray(colData)
                    ? colData
                    : Array.isArray(colData?.content)
                        ? colData.content
                        : [];
                setCollectionBooks(booksList);
                setWishlistCount(Array.isArray(wishData) ? wishData.length : 0);
                setReadingSessions(Array.isArray(sessionsData) ? sessionsData : []);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [session]);

    const { readingBooks, unreadBooks, readBooksCount } = useMemo(() => {
        const reading: BookSummaryDTO[] = [];
        const unread: BookSummaryDTO[] = [];
        let readCount = 0;

        for (const book of collectionBooks) {
            const status = (book.readingStatus || "UNREAD").toUpperCase();
            if (status === "READING") {
                reading.push(book);
            } else if (status === "UNREAD") {
                unread.push(book);
            } else if (status === "READ") {
                readCount++;
            }
        }

        return {
            readingBooks: reading,
            unreadBooks: unread,
            readBooksCount: readCount
        };
    }, [collectionBooks]);

    return (
        <div className="home-dashboard">
            <WrapperHeader>
                <div className="home-dashboard__header-title">
                    <h2>{tr("Home", "Accueil")}</h2>
                    <span className="home-dashboard__header-subtitle">
                        {tr("Readings & Progress", "Lectures & Progression")}
                    </span>
                </div>
            </WrapperHeader>

            <div className="home-dashboard__body">
                {/* 1. Stat Cards Strip */}
                <section className="home-stats-strip" aria-label={tr("Summary", "Résumé")}>
                    <Link to="/app/collection" className="home-stat-card home-stat-card--primary">
                        <div className="home-stat-card__icon">
                            <FontAwesomeIcon icon={faBook} />
                        </div>
                        <div className="home-stat-card__content">
                            <span className="home-stat-card__value">
                                {loading ? "—" : collectionBooks.length}
                            </span>
                            <span className="home-stat-card__label">
                                {tr("Collection", "Collection")}
                            </span>
                        </div>
                    </Link>

                    <Link to="/app/collection" className="home-stat-card home-stat-card--secondary">
                        <div className="home-stat-card__icon">
                            <FontAwesomeIcon icon={faBookmark} />
                        </div>
                        <div className="home-stat-card__content">
                            <span className="home-stat-card__value">
                                {loading ? "—" : unreadBooks.length}
                            </span>
                            <span className="home-stat-card__label">
                                {tr("To Read", "PAL")}
                            </span>
                        </div>
                    </Link>

                    <div className="home-stat-card home-stat-card--amber">
                        <div className="home-stat-card__icon">
                            <FontAwesomeIcon icon={faBookOpen} />
                        </div>
                        <div className="home-stat-card__content">
                            <span className="home-stat-card__value">
                                {loading ? "—" : readingBooks.length}
                            </span>
                            <span className="home-stat-card__label">
                                {tr("Reading", "En cours")}
                            </span>
                        </div>
                    </div>

                    <Link to="/app/wishlist" className="home-stat-card home-stat-card--rose">
                        <div className="home-stat-card__icon">
                            <FontAwesomeIcon icon={faHeart} />
                        </div>
                        <div className="home-stat-card__content">
                            <span className="home-stat-card__value">
                                {loading ? "—" : wishlistCount}
                            </span>
                            <span className="home-stat-card__label">
                                {tr("Wishlist", "Souhaits")}
                            </span>
                        </div>
                    </Link>
                </section>

                {/* 2. Série de lecture & Historique de lecture côte à côte */}
                <section className="home-section">
                    <div className="home-streak-history-row">
                        <ReadingStreakWidget
                            sessions={readingSessions}
                            loading={loading}
                        />

                        <Link to="/app/reading-history" className="home-widget home-quick-nav-card">
                            <div className="home-quick-nav-card__left">
                                <div className="home-quick-nav-card__icon">
                                    <FontAwesomeIcon icon={faCalendarDays} />
                                </div>
                                <div className="home-quick-nav-card__text">
                                    <h3>{tr("Reading history", "Historique de lecture")}</h3>
                                    <p>
                                        {loading
                                            ? tr("Loading...", "Chargement...")
                                            : tr(
                                                `${readBooksCount} books read • Browse covers by year`,
                                                `${readBooksCount} livres lus • Consulter les couvertures par année`
                                            )}
                                    </p>
                                </div>
                            </div>
                            <FontAwesomeIcon icon={faChevronRight} className="home-quick-nav-card__arrow" />
                        </Link>
                    </div>
                </section>
            </div>
        </div>
    );
}
