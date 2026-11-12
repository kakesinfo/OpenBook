import { WrapperHeader } from "../../components/Wrapper/Wrapper.tsx";
import { useState, useEffect, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faCalendarDays,
    faClockRotateLeft,
    faCalendarPlus,
    faMagnifyingGlass,
    faXmark,
    faBook
} from "@fortawesome/free-solid-svg-icons";
import useSession from "../../hooks/UseSession.tsx";
import useLanguage from "../../hooks/UseLanguage.tsx";
import BookList from "../../components/BookList/BookList.tsx";
import BookSummaryDTO from "../../dto/BookSummary.dto.ts";
import Select, {
    type CategoryOption,
    DEFAULT_APP_CATEGORIES,
    bookMatchesCategories
} from "../../components/Select/Select.tsx";
import PlanningCalendarModal from "./PlanningCalendarModal.tsx";
import "./PlanningPage.scss";
import SearchBar from "../../components/SearchBar/SearchBar.tsx";
import PageControls from "../../components/PageControls/PageControls.tsx";

type TimeFilter = "upcoming" | "recent";

interface TimeTab {
    id: TimeFilter;
    label: string;
    icon?: typeof faCalendarDays;
}

export default function PlanningPage() {
    const session = useSession();
    const { tr, locale, translateCategory } = useLanguage();
    const [upcomingBooks, setUpcomingBooks] = useState<BookSummaryDTO[]>([]);
    const [recentBooks, setRecentBooks] = useState<BookSummaryDTO[]>([]);
    const [loadingUpcoming, setLoadingUpcoming] = useState<boolean>(true);
    const [loadingRecent, setLoadingRecent] = useState<boolean>(true);
    const [timeFilter, setTimeFilter] = useState<TimeFilter>("upcoming");
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [rawCategories, setRawCategories] = useState<CategoryOption[]>(DEFAULT_APP_CATEGORIES);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [calendarModalOpen, setCalendarModalOpen] = useState<boolean>(false);

    const timeTabs: TimeTab[] = useMemo(
        () => [
            { id: "upcoming", label: tr("Upcoming", "À venir"), icon: faCalendarDays },
            { id: "recent", label: tr("Recently released", "Parus récemment"), icon: faClockRotateLeft }
        ],
        [tr]
    );

    const availableCategories: CategoryOption[] = useMemo(
        () =>
            rawCategories.map((cat) => ({
                ...cat,
                label: translateCategory(cat.id)
            })),
        [rawCategories, translateCategory]
    );

    useEffect(() => {
        session.customFetch("/series/categories", { method: "GET" })
            .then(async (res) => {
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data) && data.length > 0) {
                        setRawCategories(
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

    const fetchUpcomingBooks = async () => {
        setLoadingUpcoming(true);
        try {
            const response = await session.customFetch("/books/upcoming", { method: "GET" });
            if (response.ok) {
                const data = await response.json();
                setUpcomingBooks(data);
            }
        } catch (err) {
            console.error("Planning fetch upcoming books error:", err);
        } finally {
            setLoadingUpcoming(false);
        }
    };

    const fetchRecentBooks = async () => {
        setLoadingRecent(true);
        try {
            const response = await session.customFetch("/books/recent", { method: "GET" });
            if (response.ok) {
                const data = await response.json();
                setRecentBooks(data);
            }
        } catch (err) {
            console.error("Planning fetch recent books error:", err);
        } finally {
            setLoadingRecent(false);
        }
    };

    useEffect(() => {
        // Load upcoming releases first for immediate navigation in "À venir"
        fetchUpcomingBooks();
        // Load recent releases in parallel in the background
        fetchRecentBooks();
    }, [session]);

    // Reference dates for time windows
    const { endOfToday, startOfTomorrow, twoMonthsAgo, sixMonthsAhead } = useMemo(() => {
        const now = new Date();
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
        const twoPast = new Date(now.getFullYear(), now.getMonth() - 2, now.getDate(), 0, 0, 0, 0);
        const sixFuture = new Date(now.getFullYear(), now.getMonth() + 6, now.getDate(), 23, 59, 59, 999);
        return {
            endOfToday: end,
            startOfTomorrow: tomorrow,
            twoMonthsAgo: twoPast,
            sixMonthsAhead: sixFuture
        };
    }, []);

    const totalRecentCount = useMemo(() => {
        return recentBooks.filter((b) => {
            if (!b.releaseDate) return false;
            const d = new Date(b.releaseDate);
            return !isNaN(d.getTime()) && d >= twoMonthsAgo && d <= endOfToday;
        }).length;
    }, [recentBooks, twoMonthsAgo, endOfToday]);

    const totalUpcomingCount = useMemo(() => {
        return upcomingBooks.filter((b) => {
            if (!b.releaseDate) return false;
            const d = new Date(b.releaseDate);
            return !isNaN(d.getTime()) && d >= startOfTomorrow && d <= sixMonthsAhead;
        }).length;
    }, [upcomingBooks, startOfTomorrow, sixMonthsAhead]);

    const currentBooks = timeFilter === "upcoming" ? upcomingBooks : recentBooks;
    const isCurrentLoading = timeFilter === "upcoming" ? loadingUpcoming : loadingRecent;

    // Filter books by date window
    const timeFilteredBooks = useMemo(() => {
        return currentBooks.filter((b) => {
            if (!b.releaseDate) return false;
            const bDate = new Date(b.releaseDate);
            if (isNaN(bDate.getTime())) return false;

            if (timeFilter === "recent") {
                // Parus récemment: 2 derniers mois jusqu'à aujourd'hui inclus
                return bDate >= twoMonthsAgo && bDate <= endOfToday;
            } else {
                // À venir: sorties futures à partir de demain jusqu'aux 6 prochains mois
                return bDate >= startOfTomorrow && bDate <= sixMonthsAhead;
            }
        });
    }, [currentBooks, timeFilter, twoMonthsAgo, endOfToday, startOfTomorrow, sixMonthsAhead]);

    // Filter by categories and search query
    const finalFilteredBooks = useMemo(() => {
        return timeFilteredBooks.filter((book) => {
            if (selectedCategories.length > 0) {
                if (!bookMatchesCategories(book, selectedCategories)) return false;
            }
            if (searchQuery.trim().length > 0) {
                const q = searchQuery.toLowerCase().trim();
                const titleMatch = (book.title || "").toLowerCase().includes(q);
                const seriesMatch = (book.seriesName || "").toLowerCase().includes(q);
                const authorMatch = (book.author || "").toLowerCase().includes(q);
                if (!titleMatch && !seriesMatch && !authorMatch) return false;
            }
            return true;
        });
    }, [timeFilteredBooks, selectedCategories, searchQuery]);

    // Grouping by Month: "Janvier 2026", "Février 2026", etc.
    const monthGroups = useMemo(() => {
        const groupsMap = new Map<string, { key: number; title: string; books: BookSummaryDTO[] }>();

        finalFilteredBooks.forEach((book) => {
            const date = new Date(book.releaseDate);
            const year = date.getFullYear();
            const month = date.getMonth(); // 0 to 11
            const sortKey = year * 100 + month;

            const rawMonthTitle = date.toLocaleDateString(locale, {
                month: "long",
                year: "numeric"
            });
            const monthTitle = rawMonthTitle.charAt(0).toUpperCase() + rawMonthTitle.slice(1);

            if (!groupsMap.has(monthTitle)) {
                groupsMap.set(monthTitle, {
                    key: sortKey,
                    title: monthTitle,
                    books: []
                });
            }

            groupsMap.get(monthTitle)!.books.push(book);
        });

        // Convert to array and sort groups
        const sortedGroups = Array.from(groupsMap.values());
        sortedGroups.sort((a, b) => {
            if (timeFilter === "recent") {
                // Descending for recently released (most recent month first)
                return b.key - a.key;
            } else {
                // Ascending for upcoming releases (earliest upcoming month first)
                return a.key - b.key;
            }
        });

        // Sort books within each group
        sortedGroups.forEach((group) => {
            group.books.sort((a, b) => {
                const da = new Date(a.releaseDate).getTime();
                const db = new Date(b.releaseDate).getTime();
                return timeFilter === "recent" ? db - da : da - db;
            });
        });

        return sortedGroups;
    }, [finalFilteredBooks, timeFilter, locale]);

    return (
        <div className="planning-page">
            <WrapperHeader>
                <div className="planning-page__header-center">
                    <div className="planning-page__filters">
                        {timeTabs.map((tab) => {
                            const isSelected = timeFilter === tab.id;
                            const count = tab.id === "upcoming" ? totalUpcomingCount : totalRecentCount;
                            const isLoading = tab.id === "upcoming" ? loadingUpcoming : loadingRecent;

                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setTimeFilter(tab.id)}
                                    className={`planning-page__filter-btn ${isSelected ? "is-active" : ""}`}
                                >
                                    {tab.icon && <FontAwesomeIcon icon={tab.icon} />}
                                    <span>{tab.label}</span>
                                    <span className="planning-page__filter-count">
                                        {isLoading ? "..." : count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </WrapperHeader>

            <div className="planning-page__content">
                {/* Controls Bar: Category MultiSelect, Search, Synchroniser / Exporter */}
                <PageControls
                    left={
                        <Select
                            multiple
                            translateOptions
                            options={availableCategories}
                            selected={selectedCategories}
                            onChange={(cats) => setSelectedCategories(cats)}
                            allLabel={tr("All categories", "Toutes les catégories")}
                        />
                    }
                    center={
                        <SearchBar
                            value={searchQuery}
                            onChange={setSearchQuery}
                            placeholder={tr("Search a book, series, author...", "Rechercher un album, une série, un auteur...")}
                            clearLabel={tr("Clear search", "Effacer la recherche")}
                        />
                    }
                    right={
                        <button
                            type="button"
                            onClick={() => setCalendarModalOpen(true)}
                            className="planning-page__calendar-btn"
                            title={tr("Sync with Google Calendar or export as ICS", "Synchroniser avec Google Agenda ou exporter au format ICS")}
                        >
                            <FontAwesomeIcon icon={faCalendarPlus} />
                            <span>{tr("Sync / Export", "Synchroniser / Exporter")}</span>
                        </button>
                    }
                />

                {/* Loading State */}
                {isCurrentLoading && (
                    <div className="planning-page__loading">
                        {timeFilter === "upcoming"
                            ? tr("Loading upcoming releases...", "Chargement des prochaines sorties à venir...")
                            : tr("Loading recent releases...", "Chargement des parutions récentes...")}
                    </div>
                )}

                {/* Empty State */}
                {!isCurrentLoading && monthGroups.length === 0 && (
                    <div className="planning-page__empty">
                        <div className="planning-page__empty-icon">
                            <FontAwesomeIcon icon={faCalendarDays} />
                        </div>
                        <h3>{tr("No releases found", "Aucune sortie trouvée")}</h3>
                        <p>
                            {searchQuery.trim() || selectedCategories.length > 0
                                ? tr(
                                      "No books match your search criteria for this period.",
                                      "Aucun album ne correspond à vos critères de recherche pour cette période."
                                  )
                                : tr(
                                      `No books match your followed series, authors, publishers, or collections for this period (${
                                          timeFilter === "recent" ? "last 2 months" : "next 6 months"
                                      }).`,
                                      `Aucun album ne correspond à vos séries, auteurs, éditeurs ou collections suivis pour cette période (${
                                          timeFilter === "recent" ? "2 derniers mois" : "6 prochains mois"
                                      }).`
                                  )}
                        </p>
                    </div>
                )}

                {/* Grouped Month Sections */}
                {!isCurrentLoading && monthGroups.map((group) => (
                    <section key={group.title} className="planning-page__month-section">
                        {/* Month Heading */}
                        <div className="planning-page__month-header">
                            <div className="planning-page__month-title-group">
                                <div className="planning-page__month-badge-icon">
                                    <FontAwesomeIcon icon={faCalendarDays} />
                                </div>
                                <h3 className="planning-page__month-title">
                                    {group.title}
                                </h3>
                            </div>

                            <span className="planning-page__month-count">
                                {group.books.length}{" "}
                                {group.books.length > 1
                                    ? tr("releases", "parutions")
                                    : tr("release", "parution")}
                            </span>
                        </div>

                        {/* Books of this Month */}
                        <BookList books={group.books} showReleaseDate={true} />
                    </section>
                ))}
            </div>

            <PlanningCalendarModal
                open={calendarModalOpen}
                onClose={() => setCalendarModalOpen(false)}
            />
        </div>
    );
}
