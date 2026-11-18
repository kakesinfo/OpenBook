import { WrapperHeader } from "../../components/Wrapper/Wrapper.tsx";
import { isCollectifAuthor } from "../../utils/authorUtils.ts";
import { useEffect, useRef, useState, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faBook,
    faHeart,
    faFileLines,
    faRulerVertical,
    faWeightHanging,
    faCoins,
    faHourglassHalf,
    faUserPen,
    faCalendarDays,
    faArrowRight,
    faLayerGroup,
    faBookOpen,
    faCrown,
    faBuilding,
    faClock,
    faGem,
    faChartPie,
    faTimeline,
    faCheck,
    faChevronDown,
    faCartShopping,
    faGift,
    faTag
} from "@fortawesome/free-solid-svg-icons";
import { Link } from "react-router";
import useSession from "../../hooks/UseSession.tsx";
import useLanguage from "../../hooks/UseLanguage.tsx";
import UserStatisticsDTO from "../../dto/UserStatistics.dto.ts";
import PieChart from "../../components/Charts/PieChart.tsx";
import "./StatisticsPage.scss";

function StatisticsSectionPlaceholder() {
    return (
        <div className="stats-page__section-placeholder" aria-hidden="true">
            <div className="stats-page__section-placeholder-line stats-page__section-placeholder-line--wide" />
            <div className="stats-page__section-placeholder-line" />
            <div className="stats-page__section-placeholder-content" />
        </div>
    );
}

export default function StatisticsPage() {
    const session = useSession();
    const { tr, locale, translateCategory } = useLanguage();
    const [stats, setStats] = useState<UserStatisticsDTO | null>(null);
    const [selectedYear, setSelectedYear] = useState<number | null>(null);
    const [availableYears, setAvailableYears] = useState<number[]>([]);
    const [yearMenuOpen, setYearMenuOpen] = useState(false);
    const yearDropdownRef = useRef<HTMLDivElement | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [visibleSections, setVisibleSections] = useState(0);
    const [errorType, setErrorType] = useState<"load" | "network" | null>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (yearDropdownRef.current && !yearDropdownRef.current.contains(e.target as Node)) {
                setYearMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const fetchStatisticsRef = useRef<((yearParam: number | null) => Promise<void>) | null>(null);

    const fetchStatistics = useCallback(async (yearParam: number | null = selectedYear) => {
        setLoading(true);
        setVisibleSections(0);
        setErrorType(null);
        try {
            const url = yearParam !== null ? `/user/statistics?year=${encodeURIComponent(yearParam)}` : "/user/statistics";
            const resp = await session.customFetch(url, { method: "GET" });
            if (resp.ok) {
                const data: UserStatisticsDTO = await resp.json();
                setStats(data);
                if (Array.isArray(data.availableYears)) {
                    setAvailableYears(data.availableYears);
                }
                setVisibleSections(1);
                [2, 3, 4, 5, 6, 7].forEach((section, index) => {
                    window.setTimeout(() => setVisibleSections(section), (index + 1) * 150);
                });
                if (!Array.isArray(data.availableYears)) {
                    // Payload sans liste d'années : on relance la requête directement
                    // (remplace l'ancien effect qui surveillait stats)
                    queueMicrotask(() => {
                        void fetchStatisticsRef.current?.(yearParam);
                    });
                }
            } else {
                setErrorType("load");
            }
        } catch {
            setErrorType("network");
        } finally {
            setLoading(false);
        }
    }, [session, selectedYear]);

    useEffect(() => {
        fetchStatisticsRef.current = fetchStatistics;
    }, [fetchStatistics]);

    useEffect(() => {
        queueMicrotask(() => {
            void fetchStatistics(selectedYear);
        });
    }, [fetchStatistics, selectedYear]);

    const error =
        errorType === "load"
            ? tr("Unable to load statistics.", "Impossible de charger les statistiques.")
            : errorType === "network"
            ? tr("Network error while fetching data.", "Erreur réseau lors de la récupération des données.")
            : null;

    // Estimated reading hours (~1.5 minutes per page / 40 pages per hour)
    const estimatedReadingHours = stats && stats.totalPages > 0
        ? Math.round((stats.totalPages * 1.5) / 60)
        : 0;

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return "";
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" });
        } catch {
            return dateStr;
        }
    };

    const formatMinutes = (minutes: number) => {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        if (h === 0) return `${m} min`;
        if (m === 0) return `${h} h`;
        return `${h} h ${m} min`;
    };

    const formatAmount = (amount?: number) => {
        const val = amount ?? 0;
        return `${val.toLocaleString(locale, { minimumFractionDigits: val % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 })} €`;
    };

    return (
        <div className="stats-page">
            <WrapperHeader>
                <div className="stats-page__header-row">
                    <div className="stats-page__header-titles">
                        <h2>{tr("Statistics", "Statistiques")}</h2>
                    </div>

                    <div className="stats-page__year-dropdown" ref={yearDropdownRef}>
                        <button
                            type="button"
                            className={`stats-page__year-trigger ${yearMenuOpen ? "is-open" : ""}`}
                            onClick={() => {
                                if (!yearMenuOpen && availableYears.length === 0 && !loading) {
                                    fetchStatistics(selectedYear);
                                }
                                setYearMenuOpen((prev) => !prev);
                            }}
                            aria-haspopup="listbox"
                            aria-expanded={yearMenuOpen}
                        >
                            <FontAwesomeIcon icon={faCalendarDays} className="stats-page__year-icon" />
                            <span>{selectedYear === null ? tr("All time", "Depuis toujours") : selectedYear}</span>
                            <FontAwesomeIcon
                                icon={faChevronDown}
                                className={`stats-page__year-chevron ${yearMenuOpen ? "is-open" : ""}`}
                            />
                        </button>

                        {yearMenuOpen && (
                            <div className="stats-page__year-menu" role="listbox">
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={selectedYear === null}
                                    className={`stats-page__year-option ${selectedYear === null ? "is-active" : ""}`}
                                    onClick={() => {
                                        setSelectedYear(null);
                                        setYearMenuOpen(false);
                                    }}
                                >
                                    <span>{tr("All time", "Depuis toujours")}</span>
                                    {selectedYear === null && (
                                        <FontAwesomeIcon icon={faCheck} className="stats-page__year-check" />
                                    )}
                                </button>
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

            <div className="stats-page__content">
                {loading && !stats && (
                    <>
                        <StatisticsSectionPlaceholder />
                        <StatisticsSectionPlaceholder />
                        <StatisticsSectionPlaceholder />
                    </>
                )}

                {error && (
                    <div style={{
                        padding: "24px",
                        borderRadius: "14px",
                        background: "rgba(239, 68, 68, 0.12)",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        color: "#f87171",
                        textAlign: "center"
                    }}>
                        <p style={{ marginBottom: "12px", fontWeight: 500 }}>{error}</p>
                        <button
                            onClick={() => fetchStatistics(selectedYear)}
                            style={{
                                padding: "8px 18px",
                                borderRadius: "8px",
                                background: "#ef4444",
                                color: "#fff",
                                border: "none",
                                fontWeight: 600,
                                cursor: "pointer"
                            }}
                        >
                            {tr("Retry", "Réessayer")}
                        </button>
                    </div>
                )}

                {!loading && !error && stats && stats.totalOwnedBooks === 0 && visibleSections >= 1 && (
                    <div className="stats-page__section-card" style={{ textAlign: "center", padding: "48px 24px" }}>
                        <FontAwesomeIcon icon={faBook} style={{ fontSize: "2.5rem", color: "var(--text-muted, #64748b)", marginBottom: "16px" }} />
                        <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary, #fff)", marginBottom: "8px" }}>
                            {selectedYear !== null
                                ? tr(`No activity recorded in ${selectedYear}`, `Aucune activité enregistrée en ${selectedYear}`)
                                : tr("Your library is empty", "Votre bibliothèque est vide")}
                        </h3>
                        <p style={{ color: "var(--text-muted, #94a3b8)", maxWidth: "420px", margin: "0 auto 20px" }}>
                            {selectedYear !== null
                                ? tr(
                                      "Select another period or log readings, purchases, gifts, and sales.",
                                      "Sélectionnez une autre période ou enregistrez des lectures, achats, cadeaux et ventes."
                                  )
                                : tr(
                                      "Add your first books or series to discover your personalized statistics, reading status, and more!",
                                      "Ajoutez vos premiers albums ou séries pour découvrir vos statistiques personnalisées, votre état de lecture et plus encore !"
                                  )}
                        </p>
                        <Link
                            to="/app/collection"
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "10px 20px",
                                borderRadius: "10px",
                                background: "var(--accent-primary)",
                                color: "#ffffff",
                                fontWeight: 600,
                                textDecoration: "none"
                            }}
                        >
                            <span>{tr("Explore my collection", "Explorer ma collection")}</span>
                            <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: "0.85rem" }} />
                        </Link>
                    </div>
                )}

                {!loading && !error && stats && stats.totalOwnedBooks > 0 && (
                    <>
                        {/* 1. KEY METRICS CARDS */}
                        {visibleSections >= 1 && <div className="stats-page__kpi-grid">
                            {/* Owned / Active Books */}
                            <div className="stats-page__metric-card stats-page__metric-card--blue">
                                <div className="stats-page__metric-icon" style={{ background: "var(--accent-primary-light)", color: "var(--stat-indigo)" }}>
                                    <FontAwesomeIcon icon={faBook} />
                                </div>
                                <div className="stats-page__metric-body">
                                    <div className="stats-page__metric-label">
                                        {selectedYear !== null
                                            ? tr(`Active books (${selectedYear})`, `Albums actifs (${selectedYear})`)
                                            : tr("Owned books", "Albums possédés")}
                                    </div>
                                    <div className="stats-page__metric-value">
                                        {stats.totalOwnedBooks}
                                    </div>
                                    <div className="stats-page__metric-subtext">
                                        {selectedYear !== null
                                            ? tr("Read, bought, gifted or sold", "Lus, achetés, reçus ou vendus")
                                            : tr("In your collection", "Dans votre collection")}
                                    </div>
                                </div>
                            </div>

                            {/* Series */}
                            <div className="stats-page__metric-card stats-page__metric-card--purple">
                                <div className="stats-page__metric-icon" style={{ background: "var(--accent-primary-light)", color: "var(--accent-primary)" }}>
                                    <FontAwesomeIcon icon={faLayerGroup} />
                                </div>
                                <div className="stats-page__metric-body">
                                    <div className="stats-page__metric-label">{tr("Series", "Séries")}</div>
                                    <div className="stats-page__metric-value">
                                        {stats.totalSeriesCount}
                                    </div>
                                    <div className="stats-page__metric-subtext">
                                        {stats.completedSeriesCount > 0
                                            ? tr(
                                                  `${stats.completedSeriesCount} completed`,
                                                  `${stats.completedSeriesCount} complétée${stats.completedSeriesCount > 1 ? "s" : ""}`
                                              )
                                            : tr("Represented series", "Séries représentées")}
                                    </div>
                                </div>
                            </div>

                            {/* Pages */}
                            <div className="stats-page__metric-card stats-page__metric-card--emerald">
                                <div className="stats-page__metric-icon" style={{ background: "var(--accent-primary-light)", color: "var(--accent-primary)" }}>
                                    <FontAwesomeIcon icon={faFileLines} />
                                </div>
                                <div className="stats-page__metric-body">
                                    <div className="stats-page__metric-label">{tr("Total pages", "Total de pages")}</div>
                                    <div className="stats-page__metric-value">
                                        {stats.totalPages.toLocaleString(locale)}
                                    </div>
                                    <div className="stats-page__metric-subtext">
                                        ~{stats.averagePagesPerBook} {tr("pages / book", "pages / album")}
                                    </div>
                                </div>
                            </div>

                            {/* Estimated Value */}
                            <div className="stats-page__metric-card stats-page__metric-card--amber">
                                <div className="stats-page__metric-icon" style={{ background: "var(--accent-primary-light)", color: "var(--accent-primary)" }}>
                                    <FontAwesomeIcon icon={faCoins} />
                                </div>
                                <div className="stats-page__metric-body">
                                    <div className="stats-page__metric-label">{tr("Estimated value", "Valeur estimée")}</div>
                                    <div className="stats-page__metric-value">
                                        {stats.totalEstimatedValue > 0 ? `${stats.totalEstimatedValue.toLocaleString(locale)} €` : "—"}
                                    </div>
                                    <div className="stats-page__metric-subtext">
                                        {stats.averagePrice > 0
                                            ? `~${stats.averagePrice.toFixed(2)} € / ${tr("book", "album")}`
                                            : tr("Price not specified", "Prix non renseigné")}
                                    </div>
                                </div>
                            </div>

                            {/* Estimated Reading Time */}
                            <div className="stats-page__metric-card stats-page__metric-card--purple">
                                <div className="stats-page__metric-icon" style={{ background: "var(--accent-primary-light)", color: "var(--stat-pink)" }}>
                                    <FontAwesomeIcon icon={faHourglassHalf} />
                                </div>
                                <div className="stats-page__metric-body">
                                    <div className="stats-page__metric-label">{tr("Estimated time", "Temps estimé")}</div>
                                    <div className="stats-page__metric-value">
                                        ~{estimatedReadingHours} h
                                    </div>
                                    <div className="stats-page__metric-subtext">
                                        {tr("Pace: ~40 pages / hour", "Rythme : ~40 pages / heure")}
                                    </div>
                                </div>
                            </div>

                            {/* Wishlist */}
                            <div className="stats-page__metric-card stats-page__metric-card--rose">
                                <div className="stats-page__metric-icon" style={{ background: "var(--accent-primary-light)", color: "var(--accent-primary-hover)" }}>
                                    <FontAwesomeIcon icon={faHeart} />
                                </div>
                                <div className="stats-page__metric-body">
                                    <div className="stats-page__metric-label">{tr("In wishlist", "Dans les souhaits")}</div>
                                    <div className="stats-page__metric-value">
                                        {stats.totalWishlistBooks}
                                    </div>
                                    <div className="stats-page__metric-subtext">
                                        {stats.totalWishlistBooks > 1
                                            ? tr("Desired books", "Albums convoités")
                                            : tr("Desired book", "Album convoité")}
                                    </div>
                                </div>
                            </div>
                        </div>}

                        {/* 2. READING PROGRESSION & PHYSICAL STATS (TWO COLS) */}
                        {visibleSections >= 2 && <div className="stats-page__two-cols">
                            {/* Reading Progress */}
                            <div className="stats-page__section-card">
                                <div className="stats-page__section-header">
                                    <div>
                                        <h3>
                                            <FontAwesomeIcon icon={faBookOpen} style={{ color: "var(--accent-primary)" }} />
                                            <span>{tr("Reading progress", "Progression de lecture")}</span>
                                        </h3>
                                        <p>{tr("Track your reading and your To-Read pile", "Suivi de vos lectures et état de votre Pile À Lire (PAL)")}</p>
                                    </div>

                                    <div style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "8px",
                                        padding: "6px 14px",
                                        borderRadius: "12px",
                                        background: "var(--accent-primary-light)",
                                        border: "1px solid var(--border-focus)",
                                        color: "var(--accent-primary)",
                                        fontSize: "0.95rem",
                                        fontWeight: 700
                                    }}>
                                        <FontAwesomeIcon icon={faCheck} style={{ fontSize: "0.85rem" }} />
                                        <span>
                                            {selectedYear !== null
                                                ? tr(
                                                      `${stats.readingProgressPercentage}% read (${selectedYear})`,
                                                      `${stats.readingProgressPercentage}% lus (${selectedYear})`
                                                  )
                                                : tr(
                                                      `${stats.readingProgressPercentage}% of collection read`,
                                                      `${stats.readingProgressPercentage}% de la collection lue`
                                                  )}
                                        </span>
                                    </div>
                                </div>

                                <div className="stats-page__reading-panel">
                                    <PieChart
                                        data={[
                                            {
                                                name: tr("Read", "Lus"),
                                                count: stats.booksReadCount,
                                                percentage:
                                                    stats.totalOwnedBooks > 0
                                                        ? Math.round((stats.booksReadCount * 1000) / stats.totalOwnedBooks) / 10
                                                        : 0,
                                                color: "#10b981"
                                            },
                                            {
                                                name: tr("Reading", "En cours"),
                                                count: stats.booksReadingCount,
                                                percentage:
                                                    stats.totalOwnedBooks > 0
                                                        ? Math.round((stats.booksReadingCount * 1000) / stats.totalOwnedBooks) / 10
                                                        : 0,
                                                color: "var(--accent-primary)"
                                            },
                                            {
                                                name: tr("To read (PAL)", "À lire (PAL)"),
                                                count: stats.booksToReadCount + (stats.booksUnreadCount || 0),
                                                percentage:
                                                    stats.totalOwnedBooks > 0
                                                        ? Math.round(
                                                              ((stats.booksToReadCount + (stats.booksUnreadCount || 0)) * 1000) /
                                                                  stats.totalOwnedBooks
                                                          ) / 10
                                                        : 0,
                                                color: "#6366f1"
                                            },
                                            {
                                                name: tr("On hold", "En pause"),
                                                count: stats.booksOnHoldCount || 0,
                                                percentage:
                                                    stats.totalOwnedBooks > 0
                                                        ? Math.round(((stats.booksOnHoldCount || 0) * 1000) / stats.totalOwnedBooks) / 10
                                                        : 0,
                                                color: "#f59e0b"
                                            },
                                            {
                                                name: tr("Dropped", "Abandonnés"),
                                                count: stats.booksAbandonedCount,
                                                percentage:
                                                    stats.totalOwnedBooks > 0
                                                        ? Math.round((stats.booksAbandonedCount * 1000) / stats.totalOwnedBooks) / 10
                                                        : 0,
                                                color: "#ef4444"
                                            }
                                        ]}
                                        totalCount={stats.totalOwnedBooks}
                                        title=""
                                    />

                                    {stats.totalLoggedReadingMinutes > 0 && (
                                        <div style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "10px",
                                            padding: "10px 16px",
                                            borderRadius: "10px",
                                            background: "rgba(99, 102, 241, 0.08)",
                                            border: "1px solid rgba(99, 102, 241, 0.2)",
                                            fontSize: "0.85rem",
                                            color: "var(--text-secondary, #94a3b8)"
                                        }}>
                                            <FontAwesomeIcon icon={faClock} style={{ color: "var(--stat-indigo)" }} />
                                            <span>
                                                <strong style={{ color: "var(--text-primary, #fff)" }}>{formatMinutes(stats.totalLoggedReadingMinutes)}</strong>{" "}
                                                {tr("of timed reading recorded across ", "de lecture chronométrée enregistrée sur ")}
                                                <strong style={{ color: "var(--text-primary, #fff)" }}>{stats.totalReadingSessionsCount}</strong>{" "}
                                                {stats.totalReadingSessionsCount > 1 ? tr("sessions.", "sessions.") : tr("session.", "session.")}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Physical Stats */}
                            <div className="stats-page__section-card">
                                <div className="stats-page__section-header">
                                    <div>
                                        <h3>
                                            <FontAwesomeIcon icon={faRulerVertical} style={{ color: "var(--stat-indigo)" }} />
                                            <span>{tr("Physical data & Dimensions", "Données physiques & Dimensions")}</span>
                                        </h3>
                                        <p>{tr("Measurements and cumulative weight of your collection", "Mensurations et poids cumulé de votre collection")}</p>
                                    </div>
                                </div>

                                <div className="stats-page__physical-grid stats-page__physical-grid--stacked">
                                    <div className="stats-page__physical-card stats-page__physical-card--row">
                                        <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0 }}>
                                            <div style={{
                                                width: "36px",
                                                height: "36px",
                                                borderRadius: "10px",
                                                background: "var(--accent-primary-light)",
                                                color: "var(--stat-indigo)",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontSize: "15px",
                                                flexShrink: 0
                                            }}>
                                                <FontAwesomeIcon icon={faRulerVertical} />
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--text-primary, #ffffff)" }}>
                                                    {tr("Stack height", "Hauteur de la pile")}
                                                </div>
                                                <div style={{ fontSize: "0.78rem", color: "var(--text-muted, #94a3b8)", marginTop: "2px" }}>
                                                    {tr("Cumulative height if all your books were stacked.", "Hauteur cumulée si tous vos albums étaient empilés.")}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--stat-indigo)", flexShrink: 0 }}>
                                            {stats.totalHeightMeters} m
                                        </div>
                                    </div>

                                    <div className="stats-page__physical-card stats-page__physical-card--row">
                                        <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0 }}>
                                            <div style={{
                                                width: "36px",
                                                height: "36px",
                                                borderRadius: "10px",
                                                background: "var(--accent-primary-light)",
                                                color: "var(--accent-primary)",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontSize: "15px",
                                                flexShrink: 0
                                            }}>
                                                <FontAwesomeIcon icon={faWeightHanging} />
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--text-primary, #ffffff)" }}>
                                                    {tr("Library weight", "Poids de la bibliothèque")}
                                                </div>
                                                <div style={{ fontSize: "0.78rem", color: "var(--text-muted, #94a3b8)", marginTop: "2px" }}>
                                                    {tr("Estimated total weight based on the type and format of each book.", "Poids total estimé selon le type et le format de chaque album.")}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--accent-primary)", flexShrink: 0 }}>
                                            {stats.totalWeightKg} kg
                                        </div>
                                    </div>

                                    <div className="stats-page__physical-card stats-page__physical-card--row">
                                        <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0 }}>
                                            <div style={{
                                                width: "36px",
                                                height: "36px",
                                                borderRadius: "10px",
                                                background: "var(--accent-primary-light)",
                                                color: "var(--accent-primary)",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontSize: "15px",
                                                flexShrink: 0
                                            }}>
                                                <FontAwesomeIcon icon={faFileLines} />
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--text-primary, #ffffff)" }}>
                                                    {tr("Average page count", "Pagination moyenne")}
                                                </div>
                                                <div style={{ fontSize: "0.78rem", color: "var(--text-muted, #94a3b8)", marginTop: "2px" }}>
                                                    {tr("Average number of pages per volume in your collection.", "Nombre moyen de pages par volume dans votre collection.")}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--accent-primary)", flexShrink: 0 }}>
                                            ~{stats.averagePagesPerBook} p.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>}

                        {/* 3. GENRES & PUBLICATION ERAS (TWO COLS) */}
                        {visibleSections >= 3 && <div className="stats-page__two-cols">
                            {/* Donut Chart: Genres */}
                            <div className="stats-page__section-card">
                                <div className="stats-page__section-header">
                                    <div>
                                        <h3>
                                            <FontAwesomeIcon icon={faChartPie} style={{ color: "var(--accent-primary)" }} />
                                            <span>{tr("Genres & Formats", "Genres & Formats")}</span>
                                        </h3>
                                        <p>{tr("Breakdown by book category", "Répartition par catégorie d'ouvrages")}</p>
                                    </div>
                                </div>
                                <PieChart
                                    data={(stats.categoryBreakdown || []).map((c) => ({
                                        ...c,
                                        name: translateCategory(c.name)
                                    }))}
                                    totalCount={stats.totalOwnedBooks}
                                    title=""
                                />
                            </div>

                            {/* Publication Decades */}
                            <div className="stats-page__section-card">
                                <div className="stats-page__section-header">
                                    <div>
                                        <h3>
                                            <FontAwesomeIcon icon={faTimeline} style={{ color: "var(--accent-primary)" }} />
                                            <span>{tr("Eras & Decades", "Époques & Décennies")}</span>
                                        </h3>
                                        <p>{tr("Breakdown by publication period", "Répartition par période de parution")}</p>
                                    </div>
                                </div>

                                {stats.publicationDecades && stats.publicationDecades.length > 0 ? (
                                    <div className="stats-page__decades-list">
                                        {stats.publicationDecades.map((dec) => (
                                            <div key={dec.decade} className="stats-page__decade-row">
                                                <div className="stats-page__decade-label-row">
                                                    <span style={{ fontWeight: 600, color: "var(--text-primary, #fff)" }}>
                                                        {dec.decade}
                                                    </span>
                                                    <span style={{ color: "var(--text-muted, #94a3b8)", fontSize: "0.8rem" }}>
                                                        <strong style={{ color: "var(--text-primary, #fff)" }}>{dec.count}</strong>{" "}
                                                        {dec.count > 1 ? tr("books", "albums") : tr("book", "album")} ({dec.percentage}%)
                                                    </span>
                                                </div>
                                                <div className="stats-page__decade-track">
                                                    <div
                                                        className="stats-page__decade-fill"
                                                        style={{ width: `${Math.max(dec.percentage, 4)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted, #64748b)", fontSize: "0.9rem" }}>
                                        {tr("Publication dates not specified", "Dates de parution non renseignées")}
                                    </div>
                                )}
                            </div>
                        </div>}

                        {/* 4. TOP AUTHORS & TOP PUBLISHERS (TWO COLS) */}
                        {visibleSections >= 4 && <div className="stats-page__two-cols">
                            {/* Top Authors */}
                            <div className="stats-page__section-card">
                                <div className="stats-page__section-header">
                                    <div>
                                        <h3>
                                            <FontAwesomeIcon icon={faUserPen} style={{ color: "var(--stat-indigo)" }} />
                                            <span>{tr("Most represented authors", "Auteurs les plus représentés")}</span>
                                        </h3>
                                        <p>{tr("Authors with the most books in your collection", "Auteurs ayant le plus d'albums dans votre collection")}</p>
                                    </div>
                                </div>

                                {stats.topAuthors && stats.topAuthors.length > 0 ? (
                                    <div className="stats-page__leaderboard">
                                        {stats.topAuthors.map((author, idx) => {
                                            const content = (
                                                <>
                                                    <div className="stats-page__leaderboard-item-left">
                                                        <span className={`stats-page__leaderboard-item-rank stats-page__leaderboard-item-rank--${idx + 1}`}>
                                                            {idx + 1}
                                                        </span>
                                                        <span className="stats-page__leaderboard-item-name" title={author.name}>
                                                            {author.name}
                                                        </span>
                                                    </div>
                                                    <span className="stats-page__leaderboard-item-badge">
                                                        {author.bookCount} {author.bookCount > 1 ? tr("books", "albums") : tr("book", "album")}
                                                    </span>
                                                </>
                                            );
                                            return author.id && !isCollectifAuthor(author) ? (
                                                <Link
                                                    key={author.name}
                                                    to={`/app/author/${author.id}`}
                                                    className="stats-page__leaderboard-item stats-page__leaderboard-item--clickable"
                                                    title={tr(`View ${author.name}'s page`, `Voir la page de ${author.name}`)}
                                                >
                                                    {content}
                                                </Link>
                                            ) : (
                                                <div key={author.name} className="stats-page__leaderboard-item">
                                                    {content}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted, #64748b)", fontSize: "0.9rem" }}>
                                        {tr("No authors listed", "Aucun auteur répertorié")}
                                    </div>
                                )}
                            </div>

                            {/* Top Publishers */}
                            <div className="stats-page__section-card">
                                <div className="stats-page__section-header">
                                    <div>
                                        <h3>
                                            <FontAwesomeIcon icon={faBuilding} style={{ color: "var(--accent-primary)" }} />
                                            <span>{tr("Favorite publishers", "Éditeurs favoris")}</span>
                                        </h3>
                                        <p>{tr("Dominant publishing houses in your library", "Maisons d'édition dominantes de votre bibliothèque")}</p>
                                    </div>
                                </div>

                                {stats.topPublishers && stats.topPublishers.length > 0 ? (
                                    <div className="stats-page__leaderboard">
                                        {stats.topPublishers.map((pub, idx) => {
                                            const content = (
                                                <>
                                                    <div className="stats-page__leaderboard-item-left">
                                                        <span className={`stats-page__leaderboard-item-rank stats-page__leaderboard-item-rank--${idx + 1}`}>
                                                            {idx + 1}
                                                        </span>
                                                        <span className="stats-page__leaderboard-item-name" title={pub.name}>
                                                            {pub.name}
                                                        </span>
                                                    </div>
                                                    <span className="stats-page__leaderboard-item-badge" style={{
                                                        background: "var(--accent-primary-light)",
                                                        color: "var(--accent-primary)",
                                                        borderColor: "var(--border-focus)"
                                                    }}>
                                                        {pub.count} {pub.count > 1 ? tr("books", "albums") : tr("book", "album")} ({pub.percentage}%)
                                                    </span>
                                                </>
                                            );
                                            return pub.id ? (
                                                <Link
                                                    key={pub.name}
                                                    to={`/app/editor/${pub.id}`}
                                                    className="stats-page__leaderboard-item stats-page__leaderboard-item--clickable"
                                                    title={tr(`View ${pub.name}'s page`, `Voir la page de ${pub.name}`)}
                                                >
                                                    {content}
                                                </Link>
                                            ) : (
                                                <div key={pub.name} className="stats-page__leaderboard-item">
                                                    {content}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted, #64748b)", fontSize: "0.9rem" }}>
                                        {tr("No publishers listed", "Aucun éditeur répertorié")}
                                    </div>
                                )}
                            </div>
                        </div>}

                        {/* 5. TRANSACTIONS & HALL OF FAME / RECORDS (TWO COLS) */}
                        {visibleSections >= 5 && <div className="stats-page__two-cols">
                            {/* Transactions: Purchases, Gifts & Sales */}
                            <div className="stats-page__section-card">
                                <div className="stats-page__section-header">
                                    <div>
                                        <h3>
                                            <FontAwesomeIcon icon={faCoins} style={{ color: "var(--accent-primary)" }} />
                                            <span>{tr("Purchases, Gifts & Sales", "Achats, Cadeaux & Ventes")}</span>
                                        </h3>
                                        <p>
                                            {selectedYear !== null
                                                ? tr(`Transactions recorded in ${selectedYear}`, `Transactions enregistrées en ${selectedYear}`)
                                                : tr("Summary of your purchases, gifts received, and sales", "Bilan de vos achats, cadeaux reçus et ventes")}
                                        </p>
                                    </div>
                                </div>

                                <div className="stats-page__physical-grid stats-page__physical-grid--stacked">
                                    {/* Purchases */}
                                    <div className="stats-page__physical-card stats-page__physical-card--row">
                                        <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0 }}>
                                            <div style={{
                                                width: "36px",
                                                height: "36px",
                                                borderRadius: "10px",
                                                background: "var(--accent-primary-light)",
                                                color: "var(--stat-emerald)",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontSize: "15px",
                                                flexShrink: 0
                                            }}>
                                                <FontAwesomeIcon icon={faCartShopping} />
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--text-primary, #ffffff)" }}>
                                                    {tr("Purchases", "Achats")}
                                                </div>
                                                <div style={{ fontSize: "0.78rem", color: "var(--text-muted, #94a3b8)", marginTop: "2px" }}>
                                                    {tr("Books bought and total amount spent.", "Albums achetés et montant total dépensé.")}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                                            <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--stat-emerald)", lineHeight: 1.15 }}>
                                                {stats.totalBoughtCount ?? 0}
                                            </div>
                                            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary, #cbd5e1)" }}>
                                                {formatAmount(stats.totalBoughtAmount)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Gifts */}
                                    <div className="stats-page__physical-card stats-page__physical-card--row">
                                        <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0 }}>
                                            <div style={{
                                                width: "36px",
                                                height: "36px",
                                                borderRadius: "10px",
                                                background: "var(--accent-primary-light)",
                                                color: "var(--stat-pink)",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontSize: "15px",
                                                flexShrink: 0
                                            }}>
                                                <FontAwesomeIcon icon={faGift} />
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--text-primary, #ffffff)" }}>
                                                    {tr("Gifts received", "Cadeaux reçus")}
                                                </div>
                                                <div style={{ fontSize: "0.78rem", color: "var(--text-muted, #94a3b8)", marginTop: "2px" }}>
                                                    {tr("Books added as gifts to your library.", "Albums offerts et ajoutés à votre collection.")}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--stat-pink)", flexShrink: 0 }}>
                                            {stats.totalGiftCount ?? 0}
                                        </div>
                                    </div>

                                    {/* Sales */}
                                    <div className="stats-page__physical-card stats-page__physical-card--row">
                                        <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0 }}>
                                            <div style={{
                                                width: "36px",
                                                height: "36px",
                                                borderRadius: "10px",
                                                background: "var(--accent-primary-light)",
                                                color: "var(--accent-primary)",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontSize: "15px",
                                                flexShrink: 0
                                            }}>
                                                <FontAwesomeIcon icon={faTag} />
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--text-primary, #ffffff)" }}>
                                                    {tr("Sales", "Ventes")}
                                                </div>
                                                <div style={{ fontSize: "0.78rem", color: "var(--text-muted, #94a3b8)", marginTop: "2px" }}>
                                                    {tr("Books sold and total amount earned.", "Albums vendus et montant total récupéré.")}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                                            <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--accent-primary)", lineHeight: 1.15 }}>
                                                {stats.totalSoldCount ?? 0}
                                            </div>
                                            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary, #cbd5e1)" }}>
                                                {formatAmount(stats.totalSoldAmount)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Net Spent */}
                                    <div className="stats-page__physical-card stats-page__physical-card--row">
                                        <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0 }}>
                                            <div style={{
                                                width: "36px",
                                                height: "36px",
                                                borderRadius: "10px",
                                                background: "var(--accent-primary-light)",
                                                color: "var(--stat-indigo)",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontSize: "15px",
                                                flexShrink: 0
                                            }}>
                                                <FontAwesomeIcon icon={faCoins} />
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--text-primary, #ffffff)" }}>
                                                    {tr("Net budget", "Budget net")}
                                                </div>
                                                <div style={{ fontSize: "0.78rem", color: "var(--text-muted, #94a3b8)", marginTop: "2px" }}>
                                                    {tr("Total purchases minus total sales.", "Total des achats moins le total des ventes.")}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--stat-indigo)", flexShrink: 0 }}>
                                            {formatAmount(stats.netSpentAmount)}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Hall of Fame / Records */}
                            <div className="stats-page__section-card">
                            <div className="stats-page__section-header">
                                <div>
                                    <h3>
                                        <FontAwesomeIcon icon={faCrown} style={{ color: "var(--accent-primary)" }} />
                                        <span>{tr("Hall of Fame & Collection Records", "Le Panthéon & Records de la collection")}</span>
                                    </h3>
                                    <p>{tr("The centerpieces and notable records of your library", "Les pièces maîtresses et records remarquables de votre bibliothèque")}</p>
                                </div>
                            </div>

                            <div className="stats-page__records-grid">
                                {/* Top Author */}
                                {stats.topAuthor && (() => {
                                    const cardContent = (
                                        <>
                                            <div className="stats-page__record-header" style={{ color: "var(--stat-indigo)" }}>
                                                <FontAwesomeIcon icon={faUserPen} />
                                                <span>{tr("Featured author", "Auteur vedette")}</span>
                                            </div>
                                            <div className="stats-page__record-body">
                                                <div className="stats-page__record-info">
                                                    <div className="stats-page__record-title">
                                                        {stats.topAuthor.name}
                                                    </div>
                                                    <div className="stats-page__record-meta">
                                                        {tr("Most represented author", "Auteur le plus représenté")}
                                                    </div>
                                                    <span className="stats-page__record-tag" style={{ color: "var(--stat-indigo)" }}>
                                                        {stats.topAuthor.bookCount}{" "}
                                                        {stats.topAuthor.bookCount > 1
                                                            ? tr("owned books", "albums possédés")
                                                            : tr("owned book", "album possédé")}
                                                    </span>
                                                </div>
                                            </div>
                                            {stats.topAuthor.id ? (
                                                <span className="stats-page__record-link" style={{ color: "var(--stat-indigo)" }}>
                                                    <span>{tr("View details", "Consulter la fiche")}</span>
                                                    <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: "0.75rem" }} />
                                                </span>
                                            ) : (
                                                <div style={{ fontSize: "0.8rem", color: "var(--text-muted, #64748b)" }}>
                                                    {tr("Leading figure of your collection", "Figure de proue de votre collection")}
                                                </div>
                                            )}
                                        </>
                                    );
                                    return stats.topAuthor.id && !isCollectifAuthor(stats.topAuthor) ? (
                                        <Link
                                            to={`/app/author/${stats.topAuthor.id}`}
                                            className="stats-page__record-card stats-page__record-card--clickable"
                                        >
                                            {cardContent}
                                        </Link>
                                    ) : (
                                        <div className="stats-page__record-card">{cardContent}</div>
                                    );
                                })()}

                                {/* Oldest Book */}
                                {stats.oldestBook && (
                                    <Link
                                        to={`/app/book/${stats.oldestBook.id}`}
                                        className="stats-page__record-card stats-page__record-card--clickable"
                                    >
                                        <div className="stats-page__record-header" style={{ color: "var(--accent-primary)" }}>
                                            <FontAwesomeIcon icon={faCalendarDays} />
                                            <span>{tr("The oldest", "Le doyen")}</span>
                                        </div>
                                        <div className="stats-page__record-body">
                                            {stats.oldestBook.coverUrl ? (
                                                <img
                                                    src={stats.oldestBook.coverUrl}
                                                    alt={stats.oldestBook.title}
                                                    className="stats-page__record-cover"
                                                    loading="lazy"
                                                    decoding="async"
                                                />
                                            ) : (
                                                <div className="stats-page__record-cover-placeholder">
                                                    <FontAwesomeIcon icon={faBook} />
                                                </div>
                                            )}
                                            <div className="stats-page__record-info">
                                                <div className="stats-page__record-title" title={stats.oldestBook.title}>
                                                    {stats.oldestBook.title}
                                                </div>
                                                <div className="stats-page__record-meta">
                                                    {tr("Released on", "Paru le")} {formatDate(stats.oldestBook.releaseDate)}
                                                </div>
                                                {stats.oldestBook.category && (
                                                    <span className="stats-page__record-tag">
                                                        {translateCategory(stats.oldestBook.category)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <span className="stats-page__record-link" style={{ color: "var(--accent-primary)" }}>
                                            <span>{tr("View details", "Consulter la fiche")}</span>
                                            <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: "0.75rem" }} />
                                        </span>
                                    </Link>
                                )}

                                {/* Newest Book */}
                                {stats.newestBook && (
                                    <Link
                                        to={`/app/book/${stats.newestBook.id}`}
                                        className="stats-page__record-card stats-page__record-card--clickable"
                                    >
                                        <div className="stats-page__record-header" style={{ color: "var(--accent-primary)" }}>
                                            <FontAwesomeIcon icon={faCalendarDays} />
                                            <span>{tr("Latest release", "Dernière parution")}</span>
                                        </div>
                                        <div className="stats-page__record-body">
                                            {stats.newestBook.coverUrl ? (
                                                <img
                                                    src={stats.newestBook.coverUrl}
                                                    alt={stats.newestBook.title}
                                                    className="stats-page__record-cover"
                                                    loading="lazy"
                                                    decoding="async"
                                                />
                                            ) : (
                                                <div className="stats-page__record-cover-placeholder">
                                                    <FontAwesomeIcon icon={faBook} />
                                                </div>
                                            )}
                                            <div className="stats-page__record-info">
                                                <div className="stats-page__record-title" title={stats.newestBook.title}>
                                                    {stats.newestBook.title}
                                                </div>
                                                <div className="stats-page__record-meta">
                                                    {tr("Released on", "Paru le")} {formatDate(stats.newestBook.releaseDate)}
                                                </div>
                                                {stats.newestBook.category && (
                                                    <span className="stats-page__record-tag">
                                                        {translateCategory(stats.newestBook.category)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <span className="stats-page__record-link" style={{ color: "var(--accent-primary)" }}>
                                            <span>{tr("View details", "Consulter la fiche")}</span>
                                            <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: "0.75rem" }} />
                                        </span>
                                    </Link>
                                )}

                                {/* Thickest Book */}
                                {stats.thickestBook && (
                                    <Link
                                        to={`/app/book/${stats.thickestBook.id}`}
                                        className="stats-page__record-card stats-page__record-card--clickable"
                                    >
                                        <div className="stats-page__record-header" style={{ color: "var(--stat-sky)" }}>
                                            <FontAwesomeIcon icon={faFileLines} />
                                            <span>{tr("Largest volume", "Le plus gros volume")}</span>
                                        </div>
                                        <div className="stats-page__record-body">
                                            {stats.thickestBook.coverUrl ? (
                                                <img
                                                    src={stats.thickestBook.coverUrl}
                                                    alt={stats.thickestBook.title}
                                                    className="stats-page__record-cover"
                                                    loading="lazy"
                                                    decoding="async"
                                                />
                                            ) : (
                                                <div className="stats-page__record-cover-placeholder">
                                                    <FontAwesomeIcon icon={faBook} />
                                                </div>
                                            )}
                                            <div className="stats-page__record-info">
                                                <div className="stats-page__record-title" title={stats.thickestBook.title}>
                                                    {stats.thickestBook.title}
                                                </div>
                                                <div className="stats-page__record-meta">
                                                    {tr("Most imposing volume", "Volume le plus imposant")}
                                                </div>
                                                <span className="stats-page__record-tag" style={{ color: "var(--stat-sky)" }}>
                                                    {stats.thickestBook.highlightValue || `${stats.thickestBook.pageCount} pages`}
                                                </span>
                                            </div>
                                        </div>
                                        <span className="stats-page__record-link" style={{ color: "var(--stat-sky)" }}>
                                            <span>{tr("View details", "Consulter la fiche")}</span>
                                            <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: "0.75rem" }} />
                                        </span>
                                    </Link>
                                )}

                                {/* Most Valuable Book */}
                                {stats.mostValuableBook && stats.mostValuableBook.price && stats.mostValuableBook.price > 0 && (
                                    <Link
                                        to={`/app/book/${stats.mostValuableBook.id}`}
                                        className="stats-page__record-card stats-page__record-card--clickable"
                                    >
                                        <div className="stats-page__record-header" style={{ color: "var(--accent-primary)" }}>
                                            <FontAwesomeIcon icon={faGem} />
                                            <span>{tr("Crown jewel", "La plus belle pièce")}</span>
                                        </div>
                                        <div className="stats-page__record-body">
                                            {stats.mostValuableBook.coverUrl ? (
                                                <img
                                                    src={stats.mostValuableBook.coverUrl}
                                                    alt={stats.mostValuableBook.title}
                                                    className="stats-page__record-cover"
                                                    loading="lazy"
                                                    decoding="async"
                                                />
                                            ) : (
                                                <div className="stats-page__record-cover-placeholder">
                                                    <FontAwesomeIcon icon={faGem} />
                                                </div>
                                            )}
                                            <div className="stats-page__record-info">
                                                <div className="stats-page__record-title" title={stats.mostValuableBook.title}>
                                                    {stats.mostValuableBook.title}
                                                </div>
                                                <div className="stats-page__record-meta">
                                                    {tr("Highest price", "Prix le plus élevé")}
                                                </div>
                                                <span className="stats-page__record-tag" style={{ color: "var(--accent-primary)" }}>
                                                    {stats.mostValuableBook.highlightValue || `${stats.mostValuableBook.price} €`}
                                                </span>
                                            </div>
                                        </div>
                                        <span className="stats-page__record-link" style={{ color: "var(--accent-primary)" }}>
                                            <span>{tr("View details", "Consulter la fiche")}</span>
                                            <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: "0.75rem" }} />
                                        </span>
                                    </Link>
                                )}
                            </div>
                            </div>
                        </div>}
                    </>
                )}
            </div>
        </div>
    );
}
