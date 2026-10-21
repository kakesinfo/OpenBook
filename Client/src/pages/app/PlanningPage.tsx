import { WrapperHeader } from "../../components/Wrapper/Wrapper.tsx";
import { useState, useEffect, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faCalendarDays,
    faCalendarCheck,
    faClockRotateLeft,
    faBookOpen,
    faLayerGroup,
    faMasksTheater,
    faBook,
    faFilter
} from "@fortawesome/free-solid-svg-icons";
import useSession from "../../hooks/UseSession.tsx";
import BookList from "../../components/BookList/BookList.tsx";
import BookSummaryDTO from "../../dto/BookSummary.dto.ts";
import "./PlanningPage.scss";

type TimeFilter = "recent" | "upcoming";

interface CategoryFilterOption {
    id: string;
    label: string;
    icon?: any;
}

const CATEGORY_FILTERS: CategoryFilterOption[] = [
    { id: "all", label: "Tous", icon: faLayerGroup },
    { id: "comics", label: "Comics", icon: faMasksTheater },
    { id: "bd", label: "BD", icon: faBookOpen },
    { id: "manga", label: "Manga", icon: faBookOpen },
    { id: "roman", label: "Roman", icon: faBook },
    { id: "roman_graphique", label: "Roman Graphique", icon: faBookOpen }
];

export default function PlanningPage() {
    const session = useSession();
    const [books, setBooks] = useState<BookSummaryDTO[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [timeFilter, setTimeFilter] = useState<TimeFilter>("recent");
    const [selectedCategory, setSelectedCategory] = useState<string>("all");

    const fetchAllBooks = async () => {
        setLoading(true);
        try {
            const response = await session.customFetch("/books/newest", { method: "GET" });
            if (response.ok) {
                const data = await response.json();
                setBooks(data);
            }
        } catch (err) {
            console.error("Planning fetch books error:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllBooks();
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

    // Filter books by date window
    const timeFilteredBooks = useMemo(() => {
        return books.filter((b) => {
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
    }, [books, timeFilter, twoMonthsAgo, endOfToday, startOfTomorrow, sixMonthsAhead]);

    // Matching helper for categories
    const matchCategory = (book: BookSummaryDTO, filterId: string): boolean => {
        if (filterId === "all") return true;

        const cat = (book.category || "").toLowerCase();
        const typ = (book.type || "").toLowerCase();

        switch (filterId) {
            case "comics":
                return cat.includes("comics") || typ.includes("comics");
            case "bd":
                return cat.includes("bande") || cat === "bd" || typ.includes("cartonn") || typ.includes("bd");
            case "manga":
                return cat.includes("manga") || typ.includes("manga");
            case "roman":
                return (cat === "roman" || cat.startsWith("roman")) && !cat.includes("graphique");
            case "roman_graphique":
                return cat.includes("graphique") || typ.includes("graphique");
            default:
                return cat.includes(filterId) || typ.includes(filterId);
        }
    };

    // Filter by category
    const finalFilteredBooks = useMemo(() => {
        return timeFilteredBooks.filter((book) => matchCategory(book, selectedCategory));
    }, [timeFilteredBooks, selectedCategory]);

    // Calculate category counts for current timeFilter
    const categoryCounts = useMemo(() => {
        const counts: Record<string, number> = {
            all: timeFilteredBooks.length,
            comics: 0,
            bd: 0,
            manga: 0,
            roman: 0,
            roman_graphique: 0
        };

        timeFilteredBooks.forEach((b) => {
            if (matchCategory(b, "comics")) counts.comics++;
            if (matchCategory(b, "bd")) counts.bd++;
            if (matchCategory(b, "manga")) counts.manga++;
            if (matchCategory(b, "roman")) counts.roman++;
            if (matchCategory(b, "roman_graphique")) counts.roman_graphique++;
        });

        return counts;
    }, [timeFilteredBooks]);

    // Counts for the two main toggles
    const totalRecentCount = useMemo(() => {
        return books.filter((b) => {
            if (!b.releaseDate) return false;
            const d = new Date(b.releaseDate);
            return !isNaN(d.getTime()) && d >= twoMonthsAgo && d <= endOfToday;
        }).length;
    }, [books, twoMonthsAgo, endOfToday]);

    const totalUpcomingCount = useMemo(() => {
        return books.filter((b) => {
            if (!b.releaseDate) return false;
            const d = new Date(b.releaseDate);
            return !isNaN(d.getTime()) && d >= startOfTomorrow && d <= sixMonthsAhead;
        }).length;
    }, [books, startOfTomorrow, sixMonthsAhead]);

    // Grouping by Month: "Janvier 2026", "Février 2026", etc.
    const monthGroups = useMemo(() => {
        const groupsMap = new Map<string, { key: number; title: string; books: BookSummaryDTO[] }>();

        finalFilteredBooks.forEach((book) => {
            const date = new Date(book.releaseDate);
            const year = date.getFullYear();
            const month = date.getMonth(); // 0 to 11
            const sortKey = year * 100 + month;

            const rawMonthTitle = date.toLocaleDateString("fr-FR", {
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
    }, [finalFilteredBooks, timeFilter]);

    return (
        <div className="planning-page">
            <WrapperHeader>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <h2 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 800 }}>Planning des Sorties</h2>
                    <p style={{ margin: 0, color: "var(--text-muted, #9ca3af)", fontSize: "0.9rem" }}>
                        Calendrier et suivi des parutions par mois pour les nouveautés et sorties futures
                    </p>
                </div>
            </WrapperHeader>

            <div className="planning-page__content">
                {/* Top Period Toggle: "Parus récemment" vs "À venir" */}
                <div style={{
                    background: "var(--card-bg, #1e1e24)",
                    border: "1px solid var(--border-color, #2a2a32)",
                    borderRadius: "16px",
                    padding: "20px 24px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "18px"
                }}>
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: "16px"
                    }}>
                        <div style={{
                            display: "inline-flex",
                            background: "rgba(255, 255, 255, 0.05)",
                            padding: "4px",
                            borderRadius: "12px",
                            border: "1px solid rgba(255, 255, 255, 0.08)",
                            gap: "4px"
                        }}>
                            <button
                                type="button"
                                onClick={() => setTimeFilter("recent")}
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    padding: "10px 20px",
                                    borderRadius: "10px",
                                    border: "none",
                                    fontSize: "0.95rem",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    transition: "all 0.2s ease",
                                    background: timeFilter === "recent"
                                        ? "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)"
                                        : "transparent",
                                    color: timeFilter === "recent" ? "#ffffff" : "var(--text-muted, #9ca3af)",
                                    boxShadow: timeFilter === "recent" ? "0 4px 12px rgba(99, 102, 241, 0.3)" : "none"
                                }}
                            >
                                <FontAwesomeIcon icon={faClockRotateLeft} />
                                <span>Parus récemment</span>
                                <span style={{
                                    padding: "2px 8px",
                                    borderRadius: "12px",
                                    fontSize: "0.75rem",
                                    background: timeFilter === "recent" ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.08)",
                                    color: "#ffffff"
                                }}>
                                    {totalRecentCount}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setTimeFilter("upcoming")}
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    padding: "10px 20px",
                                    borderRadius: "10px",
                                    border: "none",
                                    fontSize: "0.95rem",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    transition: "all 0.2s ease",
                                    background: timeFilter === "upcoming"
                                        ? "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)"
                                        : "transparent",
                                    color: timeFilter === "upcoming" ? "#ffffff" : "var(--text-muted, #9ca3af)",
                                    boxShadow: timeFilter === "upcoming" ? "0 4px 12px rgba(99, 102, 241, 0.3)" : "none"
                                }}
                            >
                                <FontAwesomeIcon icon={faCalendarDays} />
                                <span>À venir</span>
                                <span style={{
                                    padding: "2px 8px",
                                    borderRadius: "12px",
                                    fontSize: "0.75rem",
                                    background: timeFilter === "upcoming" ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.08)",
                                    color: "#ffffff"
                                }}>
                                    {totalUpcomingCount}
                                </span>
                            </button>
                        </div>

                        <div style={{
                            fontSize: "0.85rem",
                            color: "var(--text-muted, #9ca3af)",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px"
                        }}>
                            <FontAwesomeIcon icon={faCalendarCheck} style={{ color: "var(--accent-secondary, #818cf8)" }} />
                            <span>
                                {timeFilter === "recent"
                                    ? "Fenêtre : sorties des 2 derniers mois"
                                    : "Fenêtre : sorties prévues des 6 prochains mois"}
                            </span>
                        </div>
                    </div>

                    {/* Category Filter Pills */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <div style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            fontSize: "0.8rem",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            color: "var(--text-muted, #9ca3af)",
                            fontWeight: 600
                        }}>
                            <FontAwesomeIcon icon={faFilter} />
                            <span>Filtrer par catégorie :</span>
                        </div>

                        <div style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "10px",
                            alignItems: "center"
                        }}>
                            {CATEGORY_FILTERS.map((cat) => {
                                const count = categoryCounts[cat.id] ?? 0;
                                const isSelected = selectedCategory === cat.id;

                                return (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => setSelectedCategory(cat.id)}
                                        style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "8px",
                                            padding: "8px 16px",
                                            borderRadius: "20px",
                                            border: isSelected
                                                ? "1px solid var(--accent-secondary, #818cf8)"
                                                : "1px solid rgba(255, 255, 255, 0.1)",
                                            background: isSelected
                                                ? "rgba(99, 102, 241, 0.15)"
                                                : "rgba(255, 255, 255, 0.03)",
                                            color: isSelected
                                                ? "var(--accent-secondary, #818cf8)"
                                                : "var(--text-primary, #e5e7eb)",
                                            fontWeight: isSelected ? 700 : 500,
                                            fontSize: "0.85rem",
                                            cursor: "pointer",
                                            transition: "all 0.15s ease"
                                        }}
                                    >
                                        {cat.icon && <FontAwesomeIcon icon={cat.icon} style={{ fontSize: "0.85rem" }} />}
                                        <span>{cat.label}</span>
                                        <span style={{
                                            fontSize: "0.75rem",
                                            padding: "1px 6px",
                                            borderRadius: "10px",
                                            background: isSelected
                                                ? "rgba(99, 102, 241, 0.3)"
                                                : "rgba(255, 255, 255, 0.08)",
                                            color: isSelected ? "#fff" : "var(--text-muted, #9ca3af)"
                                        }}>
                                            {count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Loading State */}
                {loading && (
                    <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted, #9ca3af)" }}>
                        Chargement des parutions du planning...
                    </div>
                )}

                {/* Empty State */}
                {!loading && monthGroups.length === 0 && (
                    <div style={{
                        background: "var(--card-bg, #1e1e24)",
                        border: "1px dashed var(--border-color, #2a2a32)",
                        borderRadius: "16px",
                        padding: "48px 24px",
                        textAlign: "center",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "12px"
                    }}>
                        <FontAwesomeIcon icon={faCalendarDays} style={{ fontSize: "2.5rem", color: "var(--text-muted, #9ca3af)" }} />
                        <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>
                            Aucune sortie trouvée
                        </h3>
                        <p style={{ margin: 0, color: "var(--text-muted, #9ca3af)", fontSize: "0.9rem", maxWidth: "480px" }}>
                            Aucun album ne correspond à la période sélectionnée (
                            {timeFilter === "recent" ? "2 derniers mois" : "6 prochains mois"}
                            ) et au filtre {CATEGORY_FILTERS.find(c => c.id === selectedCategory)?.label}.
                        </p>
                    </div>
                )}

                {/* Grouped Month Sections */}
                {!loading && monthGroups.map((group) => (
                    <section
                        key={group.title}
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                            paddingTop: "8px"
                        }}
                    >
                        {/* Month Heading */}
                        <div style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            paddingBottom: "10px",
                            borderBottom: "2px solid rgba(99, 102, 241, 0.3)"
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                <div style={{
                                    width: "36px",
                                    height: "36px",
                                    borderRadius: "10px",
                                    background: "rgba(99, 102, 241, 0.15)",
                                    color: "var(--accent-secondary, #818cf8)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "1rem"
                                }}>
                                    <FontAwesomeIcon icon={faCalendarDays} />
                                </div>

                                <h3 style={{
                                    margin: 0,
                                    fontSize: "1.35rem",
                                    fontWeight: 800,
                                    color: "var(--text-primary, #ffffff)",
                                    letterSpacing: "-0.01em"
                                }}>
                                    {group.title}
                                </h3>
                            </div>

                            <span style={{
                                fontSize: "0.85rem",
                                fontWeight: 600,
                                padding: "4px 12px",
                                borderRadius: "14px",
                                background: "rgba(255, 255, 255, 0.06)",
                                color: "var(--text-muted, #d1d5db)",
                                border: "1px solid rgba(255, 255, 255, 0.08)"
                            }}>
                                {group.books.length} {group.books.length > 1 ? "parutions" : "parution"}
                            </span>
                        </div>

                        {/* Books of this Month */}
                        <BookList books={group.books} />
                    </section>
                ))}
            </div>
        </div>
    );
}
