import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faArrowLeft,
    faBook,
    faBorderAll,
    faCalendarDays,
    faCheck,
    faChevronDown,
    faChevronRight,
    faList
} from "@fortawesome/free-solid-svg-icons";
import { WrapperHeader } from "../../components/Wrapper/Wrapper.tsx";
import BookSummaryDTO from "../../dto/BookSummary.dto.ts";
import ReadingSessionDTO from "../../dto/ReadingSession.dto.ts";
import BookList from "../../components/BookList/BookList.tsx";
import Pagination from "../../components/Pagination/Pagination.tsx";
import PageControls from "../../components/PageControls/PageControls.tsx";
import SearchBar from "../../components/SearchBar/SearchBar.tsx";
import Select, {
    CategoryOption,
    DEFAULT_APP_CATEGORIES
} from "../../components/Select/Select.tsx";
import useSession from "../../hooks/UseSession.tsx";
import useLanguage from "../../hooks/UseLanguage.tsx";

import "./HomePage.scss";
import "./StatisticsPage.scss";
import "./CollectionPage.scss";

type DisplayMode = "grid" | "list";

export default function ReadingHistoryPage() {
    const session = useSession();
    const { tr, language, locale } = useLanguage();
    const currentYear = new Date().getFullYear();

    const [collectionBooks, setCollectionBooks] = useState<BookSummaryDTO[]>([]);
    const [readingSessions, setReadingSessions] = useState<ReadingSessionDTO[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [selectedYear, setSelectedYear] = useState<number>(currentYear);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [availableCategories, setAvailableCategories] = useState<CategoryOption[]>(DEFAULT_APP_CATEGORIES);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [pageSize, setPageSize] = useState<number>(20);
    const [yearMenuOpen, setYearMenuOpen] = useState<boolean>(false);
    const yearDropdownRef = useRef<HTMLDivElement | null>(null);

    const [displayMode, setDisplayMode] = useState<DisplayMode>(() => {
        try {
            return (localStorage.getItem("reading_history_display_mode") as DisplayMode) || "grid";
        } catch {
            return "grid";
        }
    });

    const handleSetDisplayMode = (mode: DisplayMode) => {
        setDisplayMode(mode);
        try {
            localStorage.setItem("reading_history_display_mode", mode);
        } catch {
            // ignore storage errors
        }
    };

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (yearDropdownRef.current && !yearDropdownRef.current.contains(e.target as Node)) {
                setYearMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        session.customFetch("/series/categories", { method: "GET" })
            .then(async (res) => {
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data) && data.length > 0) {
                        setAvailableCategories(
                            data.map((cat: { id?: number; name: string }) => {
                                const found = DEFAULT_APP_CATEGORIES.find(
                                    (d) => d.id.toLowerCase() === cat.name.toLowerCase()
                                );
                                return {
                                    id: cat.name,
                                    label: cat.name,
                                    icon: found?.icon || faBook
                                };
                            })
                        );
                    }
                }
            })
            .catch(() => {});
    }, [session]);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);

        Promise.all([
            session
                .customFetch("/user/collection", { method: "GET" })
                .then(async (res) => (res.ok ? await res.json() : []))
                .catch(() => []),
            session
                .customFetch("/user/readingSessions", { method: "GET" })
                .then(async (res) => (res.ok ? await res.json() : []))
                .catch(() => [])
        ])
            .then(([colData, sessionsData]) => {
                if (cancelled) return;
                const booksList: BookSummaryDTO[] = Array.isArray(colData)
                    ? colData
                    : Array.isArray(colData?.content)
                        ? colData.content
                        : [];
                setCollectionBooks(booksList);
                setReadingSessions(Array.isArray(sessionsData) ? sessionsData : []);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [session]);

    const { availableYears, booksByYear } = useMemo(() => {
        const latestEndByBookId = new Map<number, number>();
        const latestAnyByBookId = new Map<number, number>();

        for (const s of readingSessions) {
            if (!s.createdAt) continue;
            const prevAny = latestAnyByBookId.get(s.bookId) ?? 0;
            if (s.createdAt > prevAny) {
                latestAnyByBookId.set(s.bookId, s.createdAt);
            }
            if (s.sessionType === 2) {
                const prevEnd = latestEndByBookId.get(s.bookId) ?? 0;
                if (s.createdAt > prevEnd) {
                    latestEndByBookId.set(s.bookId, s.createdAt);
                }
            }
        }

        const yearsSet = new Set<number>([currentYear]);
        const mapByYear = new Map<number, BookSummaryDTO[]>();

        for (const book of collectionBooks) {
            if ((book.readingStatus || "").toUpperCase() !== "READ") continue;

            const numericId = Number(book.id);
            const sessionFinishedAt =
                latestEndByBookId.get(numericId) ?? latestAnyByBookId.get(numericId);
            const effectiveFinishedAt = sessionFinishedAt ?? book.finishedAt ?? null;
            const bookWithFinishedAt: BookSummaryDTO =
                effectiveFinishedAt !== book.finishedAt
                    ? { ...book, finishedAt: effectiveFinishedAt }
                    : book;

            const year = effectiveFinishedAt
                ? new Date(effectiveFinishedAt).getFullYear()
                : currentYear;
            yearsSet.add(year);

            const list = mapByYear.get(year);
            if (list) {
                list.push(bookWithFinishedAt);
            } else {
                mapByYear.set(year, [bookWithFinishedAt]);
            }
        }

        const years = Array.from(yearsSet).sort((a, b) => b - a);
        for (const list of mapByYear.values()) {
            list.sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0));
        }

        return { availableYears: years, booksByYear: mapByYear };
    }, [collectionBooks, readingSessions, currentYear]);

    const readBooks = useMemo(() => {
        let list = booksByYear.get(selectedYear) || [];
        if (selectedCategories.length > 0) {
            const lowerSelected = selectedCategories.map((c) => c.toLowerCase());
            list = list.filter((b) => {
                const cat = (b.category || b.type || "").toLowerCase();
                return lowerSelected.includes(cat);
            });
        }
        const q = searchQuery.trim().toLowerCase();
        if (!q) return list;
        return list.filter((b) =>
            (b.title || "").toLowerCase().includes(q)
            || (b.seriesName || "").toLowerCase().includes(q)
            || (b.author || "").toLowerCase().includes(q)
        );
    }, [booksByYear, selectedYear, selectedCategories, searchQuery]);

    useEffect(() => {
        setCurrentPage(1);
    }, [selectedYear, selectedCategories, searchQuery]);

    const totalItems = readBooks.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const startIndex = (safeCurrentPage - 1) * pageSize;
    const paginatedBooks = useMemo(
        () => readBooks.slice(startIndex, startIndex + pageSize),
        [readBooks, startIndex, pageSize]
    );
    const endIndex = Math.min(startIndex + paginatedBooks.length, totalItems);

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        setCurrentPage(1);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const formatFinishedDate = (finishedAt?: number | null) => {
        if (!finishedAt) return "—";
        const d = new Date(finishedAt);
        if (Number.isNaN(d.getTime())) return "—";
        return d.toLocaleDateString(locale, {
            day: "numeric",
            month: "short",
            year: "numeric"
        });
    };

    return (
        <div className="home-dashboard">
            <WrapperHeader>
                <div className="stats-page__header-row">
                    <div className="home-dashboard__header-title">
                        <Link
                            to="/app/home"
                            className="home-btn home-btn--ghost home-btn--sm"
                            aria-label={tr("Back to home", "Retour à l'accueil")}
                        >
                            <FontAwesomeIcon icon={faArrowLeft} />
                            <span>{tr("Home", "Accueil")}</span>
                        </Link>
                        <h2>{tr("Reading history", "Historique de lecture")}</h2>
                        <span className="home-badge">
                            {loading
                                ? "—"
                                : language === "fr"
                                    ? `${readBooks.length} livre${readBooks.length > 1 ? "s" : ""}`
                                    : `${readBooks.length} book${readBooks.length !== 1 ? "s" : ""}`}
                        </span>
                    </div>

                    <div className="stats-page__year-dropdown" ref={yearDropdownRef}>
                        <button
                            type="button"
                            className={`stats-page__year-trigger ${yearMenuOpen ? "is-open" : ""}`}
                            onClick={() => setYearMenuOpen((prev) => !prev)}
                            aria-haspopup="listbox"
                            aria-expanded={yearMenuOpen}
                        >
                            <FontAwesomeIcon icon={faCalendarDays} className="stats-page__year-icon" />
                            <span>{selectedYear}</span>
                            <FontAwesomeIcon
                                icon={faChevronDown}
                                className={`stats-page__year-chevron ${yearMenuOpen ? "is-open" : ""}`}
                            />
                        </button>

                        {yearMenuOpen && (
                            <div className="stats-page__year-menu" role="listbox">
                                {availableYears.map((yr) => {
                                    const active = selectedYear === yr;
                                    return (
                                        <button
                                            key={yr}
                                            type="button"
                                            role="option"
                                            aria-selected={active}
                                            className={`stats-page__year-option ${active ? "is-active" : ""}`}
                                            onClick={() => {
                                                setSelectedYear(yr);
                                                setYearMenuOpen(false);
                                            }}
                                        >
                                            <span>{yr}</span>
                                            {active && (
                                                <FontAwesomeIcon icon={faCheck} className="stats-page__year-check" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </WrapperHeader>

            <div className="home-dashboard__body">
                <PageControls
                    left={
                        <Select
                            multiple
                            translateOptions
                            options={availableCategories}
                            selected={selectedCategories}
                            onChange={setSelectedCategories}
                            allLabel={tr("All categories", "Toutes les catégories")}
                        />
                    }
                    center={
                        <SearchBar
                            value={searchQuery}
                            onChange={setSearchQuery}
                            placeholder={tr("Filter books...", "Filtrer les livres...")}
                        />
                    }
                    right={
                        <div className="collection-page__view-toggle">
                            <button
                                type="button"
                                className={`collection-page__view-btn ${displayMode === "grid" ? "is-active" : ""}`}
                                onClick={() => handleSetDisplayMode("grid")}
                                title={tr("Gallery view", "Mode Galerie")}
                            >
                                <FontAwesomeIcon icon={faBorderAll} />
                                <span>{tr("Gallery", "Galerie")}</span>
                            </button>
                            <button
                                type="button"
                                className={`collection-page__view-btn ${displayMode === "list" ? "is-active" : ""}`}
                                onClick={() => handleSetDisplayMode("list")}
                                title={tr("Compact list view", "Mode Liste compacte")}
                            >
                                <FontAwesomeIcon icon={faList} />
                                <span>{tr("List", "Liste")}</span>
                            </button>
                        </div>
                    }
                />

                {loading ? (
                    <div className="home-widget home-yearly-reads-widget__empty">
                        {tr("Loading read books...", "Chargement des livres lus...")}
                    </div>
                ) : readBooks.length === 0 ? (
                    <div className="home-widget home-yearly-reads-widget__empty">
                        <FontAwesomeIcon icon={faBook} />
                        <p>
                            {tr(
                                `No completed books recorded in ${selectedYear}.`,
                                `Aucun livre lu enregistré en ${selectedYear}.`
                            )}
                        </p>
                    </div>
                ) : (
                    <>
                        {displayMode === "grid" ? (
                            <BookList books={paginatedBooks} showFinishedDate={true} />
                        ) : (
                            <div className="collection-list">
                                <div className="collection-list__header">
                                    <span className="collection-list__th collection-list__th--title">{tr("Title", "Titre")}</span>
                                    <span className="collection-list__th collection-list__th--series">{tr("Series / Vol.", "Série / Tome")}</span>
                                    <span className="collection-list__th collection-list__th--author">{tr("Author", "Auteur")}</span>
                                    <span className="collection-list__th collection-list__th--category">{tr("Category", "Catégorie")}</span>
                                    <span className="collection-list__th collection-list__th--date">{tr("Finished on", "Lu le")}</span>
                                    <span className="collection-list__th collection-list__th--action"></span>
                                </div>

                                {paginatedBooks.map((book) => {
                                    const cat = book.category || book.type;
                                    return (
                                        <Link to={`/app/book/${book.id}`} className="collection-row" key={book.id}>
                                            <div className="collection-row__col collection-row__col--title">
                                                <FontAwesomeIcon icon={faBook} className="collection-row__book-icon" />
                                                <span className="collection-row__title" title={book.title}>
                                                    {book.title}
                                                </span>
                                            </div>

                                            <div className="collection-row__col collection-row__col--series">
                                                {book.seriesName && (
                                                    <span className="collection-row__series-name" title={book.seriesName}>
                                                        {book.seriesName}
                                                    </span>
                                                )}
                                                {book.volume > 0 && (
                                                    <span className="collection-row__volume-badge">
                                                        {tr(`Vol.${book.volume}`, `T.${book.volume}`)}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="collection-row__col collection-row__col--author">
                                                <span className="collection-row__author">{book.author || "—"}</span>
                                            </div>

                                            <div className="collection-row__col collection-row__col--category">
                                                {cat ? <span className="collection-row__tag">{cat}</span> : "—"}
                                            </div>

                                            <div className="collection-row__col collection-row__col--date">
                                                <span className="collection-row__date">{formatFinishedDate(book.finishedAt)}</span>
                                            </div>

                                            <div className="collection-row__col collection-row__col--action">
                                                <FontAwesomeIcon icon={faChevronRight} className="collection-row__chevron" />
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}

                        <Pagination
                            currentPage={safeCurrentPage}
                            totalPages={totalPages}
                            onPageChange={handlePageChange}
                            totalItems={totalItems}
                            startIndex={startIndex}
                            endIndex={endIndex}
                            pageSize={pageSize}
                            onPageSizeChange={handlePageSizeChange}
                            pageSizeOptions={[20, 50, 100]}
                        />
                    </>
                )}
            </div>
        </div>
    );
}
