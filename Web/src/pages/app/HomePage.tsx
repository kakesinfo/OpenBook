import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faBook,
    faBookOpen,
    faBookmark,
    faHeart,
    faCalendarDays,
    faChevronRight,
    faNoteSticky,
    faSpellCheck
} from "@fortawesome/free-solid-svg-icons";
import { WrapperHeader } from "../../components/Wrapper/Wrapper.tsx";
import BookSummaryDTO from "../../dto/BookSummary.dto.ts";
import ReadingSessionDTO from "../../dto/ReadingSession.dto.ts";
import NoteDTO from "../../dto/Note.dto.ts";
import WordDTO from "../../dto/Word.dto.ts";
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
    const [notes, setNotes] = useState<NoteDTO[]>([]);
    const [words, setWords] = useState<WordDTO[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        let cancelled = false;
        Promise.resolve().then(() => {
            if (!cancelled) setLoading(true);
        });

        Promise.all([
            session.customFetch("/user/collection", { method: "GET" })
                .then(async (res) => (res.ok ? await res.json() : []))
                .catch(() => []),
            session.customFetch("/user/wishlist", { method: "GET" })
                .then(async (res) => (res.ok ? await res.json() : []))
                .catch(() => []),
            session.customFetch("/user/readingSessions", { method: "GET" })
                .then(async (res) => (res.ok ? await res.json() : []))
                .catch(() => []),
            session.customFetch("/notes", { method: "GET" })
                .then(async (res) => (res.ok ? await res.json() : []))
                .catch(() => []),
            session.customFetch("/words", { method: "GET" })
                .then(async (res) => (res.ok ? await res.json() : []))
                .catch(() => [])
        ])
            .then(([colData, wishData, sessionsData, notesData, wordsData]) => {
                if (cancelled) return;
                const booksList: BookSummaryDTO[] = Array.isArray(colData)
                    ? colData
                    : Array.isArray(colData?.content)
                        ? colData.content
                        : [];
                setCollectionBooks(booksList);
                setWishlistCount(Array.isArray(wishData) ? wishData.length : 0);
                setReadingSessions(Array.isArray(sessionsData) ? sessionsData : []);
                setNotes(Array.isArray(notesData) ? notesData : []);
                setWords(Array.isArray(wordsData) ? wordsData : []);
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

                {/* 2. Série de lecture & Historique à gauche, Notes & Glossaire à droite */}
                <section className="home-section">
                    <div className="home-main-grid">
                        <div className="home-main-col">
                            <div className="home-section__header">
                                <h3>{tr("Activity & tracking", "Activité et suivis")}</h3>
                            </div>
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
                        </div>

                        <div className="home-main-col">
                            <div className="home-section__header">
                                <h3>{tr("Virtual notebook", "Carnet virtuel")}</h3>
                            </div>
                            <div className="home-bento-tiles">
                                <Link to="/app/notes" className="home-widget home-bento-tile">
                                    <div className="home-bento-tile__icon is-primary">
                                        <FontAwesomeIcon icon={faNoteSticky} />
                                    </div>
                                    <div className="home-bento-tile__info">
                                        <span className="home-bento-tile__title">
                                            {tr("Notes", "Notes")}
                                        </span>
                                        <span className="home-bento-tile__sub">
                                            {loading
                                                ? tr("Loading...", "Chargement...")
                                                : notes.length === 0
                                                    ? tr("Reading notes", "Fiches de lecture")
                                                    : tr(
                                                        `${notes.length} reading note${notes.length > 1 ? "s" : ""}`,
                                                        `${notes.length} fiche${notes.length > 1 ? "s" : ""} de lecture`
                                                    )}
                                        </span>
                                        <span className="home-bento-tile__caption">
                                            {notes[0]?.book?.title
                                                ? tr(`Recent: ${notes[0].book.title}`, `Récent : ${notes[0].book.title}`)
                                                : tr("One note per book", "Une note par livre")}
                                        </span>
                                    </div>
                                    <FontAwesomeIcon icon={faChevronRight} className="home-bento-tile__arrow" />
                                </Link>

                                <Link to="/app/glossary" className="home-widget home-bento-tile">
                                    <div className="home-bento-tile__icon is-secondary">
                                        <FontAwesomeIcon icon={faSpellCheck} />
                                    </div>
                                    <div className="home-bento-tile__info">
                                        <span className="home-bento-tile__title">
                                            {tr("Glossary", "Glossaire")}
                                        </span>
                                        <span className="home-bento-tile__sub">
                                            {loading
                                                ? tr("Loading...", "Chargement...")
                                                : words.length === 0
                                                    ? tr("Words & definitions", "Mots & définitions")
                                                    : tr(
                                                        `${words.length} defined term${words.length > 1 ? "s" : ""}`,
                                                        `${words.length} terme${words.length > 1 ? "s" : ""} défini${words.length > 1 ? "s" : ""}`
                                                    )}
                                        </span>
                                        <span className="home-bento-tile__caption">
                                            {words[0]?.word
                                                ? tr(`Ex: ${words[0].word}`, `Ex : ${words[0].word}`)
                                                : tr("Linked to your reads", "Lié à vos lectures")}
                                        </span>
                                    </div>
                                    <FontAwesomeIcon icon={faChevronRight} className="home-bento-tile__arrow" />
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
