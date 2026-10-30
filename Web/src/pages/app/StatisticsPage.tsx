import { WrapperHeader } from "../../components/Wrapper/Wrapper.tsx";
import { useEffect, useState } from "react";
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
    faRotate,
    faLayerGroup,
    faBookOpen,
    faCrown,
    faBuilding,
    faClock,
    faGem,
    faChartPie,
    faTimeline,
    faCheck
} from "@fortawesome/free-solid-svg-icons";
import { Link } from "react-router";
import useSession from "../../hooks/UseSession.tsx";
import UserStatisticsDTO from "../../dto/UserStatistics.dto.ts";
import PieChart from "../../components/Charts/PieChart.tsx";
import WorldMap from "../../components/WorldMap/WorldMap.tsx";
import "./StatisticsPage.scss";

export default function StatisticsPage() {
    const session = useSession();
    const [stats, setStats] = useState<UserStatisticsDTO | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchStatistics = async () => {
        setLoading(true);
        setError(null);
        try {
            const resp = await session.customFetch("/user/statistics", { method: "GET" });
            if (resp.ok) {
                const data = await resp.json();
                setStats(data);
            } else {
                setError("Impossible de charger les statistiques.");
            }
        } catch {
            setError("Erreur réseau lors de la récupération des données.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatistics();
    }, [session]);

    // Estimated reading hours (~1.5 minutes per page / 40 pages per hour)
    const estimatedReadingHours = stats && stats.totalPages > 0
        ? Math.round((stats.totalPages * 1.5) / 60)
        : 0;

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return "";
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });
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

    return (
        <div className="stats-page">
            <WrapperHeader>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <h2>Statistiques</h2>
                    <span style={{ fontSize: "0.9rem", color: "var(--text-muted, #94a3b8)" }}>
                        Aperçu détaillé, progression de lecture et records de votre bibliothèque
                    </span>
                </div>
            </WrapperHeader>

            <div className="stats-page__content">
                {loading && (
                    <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted, #94a3b8)" }}>
                        <FontAwesomeIcon icon={faRotate} spin style={{ fontSize: "2rem", marginBottom: "16px", color: "var(--accent-secondary, #6366f1)" }} />
                        <div style={{ fontSize: "1rem", fontWeight: 500 }}>Calcul de vos statistiques en cours...</div>
                    </div>
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
                            onClick={fetchStatistics}
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
                            Réessayer
                        </button>
                    </div>
                )}

                {!loading && !error && stats && stats.totalOwnedBooks === 0 && (
                    <div className="stats-page__section-card" style={{ textAlign: "center", padding: "48px 24px" }}>
                        <FontAwesomeIcon icon={faBook} style={{ fontSize: "2.5rem", color: "var(--text-muted, #64748b)", marginBottom: "16px" }} />
                        <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary, #fff)", marginBottom: "8px" }}>
                            Votre bibliothèque est vide
                        </h3>
                        <p style={{ color: "var(--text-muted, #94a3b8)", maxWidth: "420px", margin: "0 auto 20px" }}>
                            Ajoutez vos premiers albums ou séries pour découvrir vos statistiques personnalisées, votre état de lecture et la carte du monde !
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
                            <span>Explorer ma collection</span>
                            <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: "0.85rem" }} />
                        </Link>
                    </div>
                )}

                {!loading && !error && stats && stats.totalOwnedBooks > 0 && (
                    <>
                        {/* 1. KEY METRICS CARDS */}
                        <div className="stats-page__kpi-grid">
                            {/* Owned Books */}
                            <div className="stats-page__metric-card stats-page__metric-card--blue">
                                <div className="stats-page__metric-icon" style={{ background: "rgba(99, 102, 241, 0.15)", color: "#818cf8" }}>
                                    <FontAwesomeIcon icon={faBook} />
                                </div>
                                <div className="stats-page__metric-body">
                                    <div className="stats-page__metric-label">Albums possédés</div>
                                    <div className="stats-page__metric-value">
                                        {stats.totalOwnedBooks}
                                    </div>
                                    <div className="stats-page__metric-subtext">
                                        Dans votre collection
                                    </div>
                                </div>
                            </div>

                            {/* Series */}
                            <div className="stats-page__metric-card stats-page__metric-card--purple">
                                <div className="stats-page__metric-icon" style={{ background: "rgba(168, 85, 247, 0.15)", color: "#c084fc" }}>
                                    <FontAwesomeIcon icon={faLayerGroup} />
                                </div>
                                <div className="stats-page__metric-body">
                                    <div className="stats-page__metric-label">Séries</div>
                                    <div className="stats-page__metric-value">
                                        {stats.totalSeriesCount}
                                    </div>
                                    <div className="stats-page__metric-subtext">
                                        {stats.completedSeriesCount > 0
                                            ? `${stats.completedSeriesCount} complétée${stats.completedSeriesCount > 1 ? "s" : ""}`
                                            : "Séries représentées"}
                                    </div>
                                </div>
                            </div>

                            {/* Pages */}
                            <div className="stats-page__metric-card stats-page__metric-card--emerald">
                                <div className="stats-page__metric-icon" style={{ background: "var(--accent-primary-light)", color: "var(--accent-primary)" }}>
                                    <FontAwesomeIcon icon={faFileLines} />
                                </div>
                                <div className="stats-page__metric-body">
                                    <div className="stats-page__metric-label">Total de pages</div>
                                    <div className="stats-page__metric-value">
                                        {stats.totalPages.toLocaleString("fr-FR")}
                                    </div>
                                    <div className="stats-page__metric-subtext">
                                        ~{stats.averagePagesPerBook} pages / album
                                    </div>
                                </div>
                            </div>

                            {/* Estimated Value */}
                            <div className="stats-page__metric-card stats-page__metric-card--amber">
                                <div className="stats-page__metric-icon" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24" }}>
                                    <FontAwesomeIcon icon={faCoins} />
                                </div>
                                <div className="stats-page__metric-body">
                                    <div className="stats-page__metric-label">Valeur estimée</div>
                                    <div className="stats-page__metric-value">
                                        {stats.totalEstimatedValue > 0 ? `${stats.totalEstimatedValue.toLocaleString("fr-FR")} €` : "—"}
                                    </div>
                                    <div className="stats-page__metric-subtext">
                                        {stats.averagePrice > 0 ? `~${stats.averagePrice.toFixed(2)} € / album` : "Prix non renseigné"}
                                    </div>
                                </div>
                            </div>

                            {/* Estimated Reading Time */}
                            <div className="stats-page__metric-card stats-page__metric-card--purple">
                                <div className="stats-page__metric-icon" style={{ background: "rgba(236, 72, 153, 0.15)", color: "#f472b6" }}>
                                    <FontAwesomeIcon icon={faHourglassHalf} />
                                </div>
                                <div className="stats-page__metric-body">
                                    <div className="stats-page__metric-label">Temps estimé</div>
                                    <div className="stats-page__metric-value">
                                        ~{estimatedReadingHours} h
                                    </div>
                                    <div className="stats-page__metric-subtext">
                                        Rythme : ~40 pages / heure
                                    </div>
                                </div>
                            </div>

                            {/* Wishlist */}
                            <div className="stats-page__metric-card stats-page__metric-card--rose">
                                <div className="stats-page__metric-icon" style={{ background: "rgba(244, 63, 94, 0.15)", color: "#fb7185" }}>
                                    <FontAwesomeIcon icon={faHeart} />
                                </div>
                                <div className="stats-page__metric-body">
                                    <div className="stats-page__metric-label">Dans les souhaits</div>
                                    <div className="stats-page__metric-value">
                                        {stats.totalWishlistBooks}
                                    </div>
                                    <div className="stats-page__metric-subtext">
                                        {stats.totalWishlistBooks > 1 ? "Albums convoités" : "Album convoité"}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. READING PROGRESSION & PAL */}
                        <div className="stats-page__section-card">
                            <div className="stats-page__section-header">
                                <div>
                                    <h3>
                                        <FontAwesomeIcon icon={faBookOpen} style={{ color: "var(--accent-primary)" }} />
                                        <span>Progression de lecture</span>
                                    </h3>
                                    <p>Suivi de vos lectures et état de votre Pile À Lire (PAL)</p>
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
                                    <span>{stats.readingProgressPercentage}% de la collection lue</span>
                                </div>
                            </div>

                            <div className="stats-page__reading-panel">
                                {/* Stacked Progress Bar */}
                                <div className="stats-page__progress-stacked-bar">
                                    <div
                                        className="stats-page__progress-segment stats-page__progress-segment--read"
                                        style={{ width: `${(stats.booksReadCount / stats.totalOwnedBooks) * 100}%` }}
                                        title={`Lus : ${stats.booksReadCount}`}
                                    />
                                    <div
                                        className="stats-page__progress-segment stats-page__progress-segment--reading"
                                        style={{ width: `${(stats.booksReadingCount / stats.totalOwnedBooks) * 100}%` }}
                                        title={`En cours : ${stats.booksReadingCount}`}
                                    />
                                    <div
                                        className="stats-page__progress-segment stats-page__progress-segment--toread"
                                        style={{ width: `${(stats.booksToReadCount / stats.totalOwnedBooks) * 100}%` }}
                                        title={`À lire : ${stats.booksToReadCount}`}
                                    />
                                    <div
                                        className="stats-page__progress-segment stats-page__progress-segment--unread"
                                        style={{ width: `${(stats.booksUnreadCount / stats.totalOwnedBooks) * 100}%` }}
                                        title={`Non lus : ${stats.booksUnreadCount}`}
                                    />
                                    {stats.booksAbandonedCount > 0 && (
                                        <div
                                            className="stats-page__progress-segment stats-page__progress-segment--abandoned"
                                            style={{ width: `${(stats.booksAbandonedCount / stats.totalOwnedBooks) * 100}%` }}
                                            title={`Abandonnés : ${stats.booksAbandonedCount}`}
                                        />
                                    )}
                                </div>

                                {/* Status Chips */}
                                <div className="stats-page__status-chips">
                                    <div className="stats-page__status-chip">
                                        <div className="stats-page__status-chip-dot" style={{ background: "var(--accent-primary)", boxShadow: "0 0 8px var(--accent-primary-glow)" }} />
                                        <div className="stats-page__status-chip-body">
                                            <span className="stats-page__status-chip-count">{stats.booksReadCount}</span>
                                            <span className="stats-page__status-chip-label">
                                                Lus ({stats.totalOwnedBooks > 0 ? Math.round((stats.booksReadCount * 100) / stats.totalOwnedBooks) : 0}%)
                                            </span>
                                        </div>
                                    </div>

                                    <div className="stats-page__status-chip">
                                        <div className="stats-page__status-chip-dot" style={{ background: "#3b82f6", boxShadow: "0 0 8px rgba(59, 130, 246, 0.4)" }} />
                                        <div className="stats-page__status-chip-body">
                                            <span className="stats-page__status-chip-count">{stats.booksReadingCount}</span>
                                            <span className="stats-page__status-chip-label">En cours</span>
                                        </div>
                                    </div>

                                    <div className="stats-page__status-chip">
                                        <div className="stats-page__status-chip-dot" style={{ background: "#f59e0b", boxShadow: "0 0 8px rgba(245, 158, 11, 0.4)" }} />
                                        <div className="stats-page__status-chip-body">
                                            <span className="stats-page__status-chip-count">{stats.booksToReadCount}</span>
                                            <span className="stats-page__status-chip-label">À lire (PAL)</span>
                                        </div>
                                    </div>

                                    <div className="stats-page__status-chip">
                                        <div className="stats-page__status-chip-dot" style={{ background: "rgba(255, 255, 255, 0.3)" }} />
                                        <div className="stats-page__status-chip-body">
                                            <span className="stats-page__status-chip-count">{stats.booksUnreadCount}</span>
                                            <span className="stats-page__status-chip-label">Non lus</span>
                                        </div>
                                    </div>

                                    {stats.booksAbandonedCount > 0 && (
                                        <div className="stats-page__status-chip">
                                            <div className="stats-page__status-chip-dot" style={{ background: "#ef4444" }} />
                                            <div className="stats-page__status-chip-body">
                                                <span className="stats-page__status-chip-count">{stats.booksAbandonedCount}</span>
                                                <span className="stats-page__status-chip-label">Abandonnés</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

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
                                        <FontAwesomeIcon icon={faClock} style={{ color: "#818cf8" }} />
                                        <span>
                                            <strong style={{ color: "var(--text-primary, #fff)" }}>{formatMinutes(stats.totalLoggedReadingMinutes)}</strong> de lecture chronométrée enregistrée sur <strong style={{ color: "var(--text-primary, #fff)" }}>{stats.totalReadingSessionsCount}</strong> session{stats.totalReadingSessionsCount > 1 ? "s" : ""}.
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 3. PHYSICAL STATS (CLEAN, WITHOUT SILLY COMPARISONS) */}
                        <div className="stats-page__section-card">
                            <div className="stats-page__section-header">
                                <div>
                                    <h3>
                                        <FontAwesomeIcon icon={faRulerVertical} style={{ color: "#818cf8" }} />
                                        <span>Données physiques & Dimensions</span>
                                    </h3>
                                    <p>Mensurations et poids cumulé de votre collection</p>
                                </div>
                            </div>

                            <div className="stats-page__physical-grid">
                                <div className="stats-page__physical-card">
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                        <div style={{
                                            width: "38px",
                                            height: "38px",
                                            borderRadius: "10px",
                                            background: "rgba(99, 102, 241, 0.15)",
                                            color: "#818cf8",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontSize: "16px"
                                        }}>
                                            <FontAwesomeIcon icon={faRulerVertical} />
                                        </div>
                                        <div style={{ fontSize: "1.65rem", fontWeight: 800, color: "#818cf8" }}>
                                            {stats.totalHeightMeters} m
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary, #ffffff)" }}>
                                            Hauteur de la pile
                                        </div>
                                        <div style={{ fontSize: "0.82rem", color: "var(--text-muted, #94a3b8)", marginTop: "4px" }}>
                                            Hauteur cumulée si tous vos albums étaient empilés.
                                        </div>
                                    </div>
                                </div>

                                <div className="stats-page__physical-card">
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                        <div style={{
                                            width: "38px",
                                            height: "38px",
                                            borderRadius: "10px",
                                            background: "var(--accent-primary-light)",
                                            color: "var(--accent-primary)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontSize: "16px"
                                        }}>
                                            <FontAwesomeIcon icon={faWeightHanging} />
                                        </div>
                                        <div style={{ fontSize: "1.65rem", fontWeight: 800, color: "var(--accent-primary)" }}>
                                            {stats.totalWeightKg} kg
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary, #ffffff)" }}>
                                            Poids de la bibliothèque
                                        </div>
                                        <div style={{ fontSize: "0.82rem", color: "var(--text-muted, #94a3b8)", marginTop: "4px" }}>
                                            Poids total estimé selon le type et le format de chaque album.
                                        </div>
                                    </div>
                                </div>

                                <div className="stats-page__physical-card">
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                        <div style={{
                                            width: "38px",
                                            height: "38px",
                                            borderRadius: "10px",
                                            background: "rgba(6, 182, 212, 0.15)",
                                            color: "#22d3ee",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontSize: "16px"
                                        }}>
                                            <FontAwesomeIcon icon={faFileLines} />
                                        </div>
                                        <div style={{ fontSize: "1.65rem", fontWeight: 800, color: "#22d3ee" }}>
                                            ~{stats.averagePagesPerBook} p.
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary, #ffffff)" }}>
                                            Pagination moyenne
                                        </div>
                                        <div style={{ fontSize: "0.82rem", color: "var(--text-muted, #94a3b8)", marginTop: "4px" }}>
                                            Nombre moyen de pages par volume dans votre collection.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 4. GENRES & PUBLICATION ERAS (TWO COLS) */}
                        <div className="stats-page__two-cols">
                            {/* Donut Chart: Genres */}
                            <div className="stats-page__section-card">
                                <div className="stats-page__section-header">
                                    <div>
                                        <h3>
                                            <FontAwesomeIcon icon={faChartPie} style={{ color: "#3b82f6" }} />
                                            <span>Genres & Formats</span>
                                        </h3>
                                        <p>Répartition par catégorie d'ouvrages</p>
                                    </div>
                                </div>
                                <PieChart
                                    data={stats.categoryBreakdown}
                                    totalCount={stats.totalOwnedBooks}
                                    title=""
                                />
                            </div>

                            {/* Publication Decades */}
                            <div className="stats-page__section-card">
                                <div className="stats-page__section-header">
                                    <div>
                                        <h3>
                                            <FontAwesomeIcon icon={faTimeline} style={{ color: "#a855f7" }} />
                                            <span>Époques & Décennies</span>
                                        </h3>
                                        <p>Répartition par période de parution</p>
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
                                                        <strong style={{ color: "var(--text-primary, #fff)" }}>{dec.count}</strong> {dec.count > 1 ? "albums" : "album"} ({dec.percentage}%)
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
                                        Dates de parution non renseignées
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 5. GEOGRAPHICAL ORIGIN (WORLD MAP) */}
                        <div className="stats-page__section-card">
                            <WorldMap
                                countries={stats.countries}
                                totalBooks={stats.totalOwnedBooks}
                            />
                        </div>

                        {/* 6. TOP AUTHORS & TOP PUBLISHERS (TWO COLS) */}
                        <div className="stats-page__two-cols">
                            {/* Top Authors */}
                            <div className="stats-page__section-card">
                                <div className="stats-page__section-header">
                                    <div>
                                        <h3>
                                            <FontAwesomeIcon icon={faUserPen} style={{ color: "#818cf8" }} />
                                            <span>Auteurs les plus représentés</span>
                                        </h3>
                                        <p>Auteurs ayant le plus d'albums dans votre collection</p>
                                    </div>
                                </div>

                                {stats.topAuthors && stats.topAuthors.length > 0 ? (
                                    <div className="stats-page__leaderboard">
                                        {stats.topAuthors.map((author, idx) => (
                                            <div key={author.name} className="stats-page__leaderboard-item">
                                                <div className="stats-page__leaderboard-item-left">
                                                    <span className={`stats-page__leaderboard-item-rank stats-page__leaderboard-item-rank--${idx + 1}`}>
                                                        {idx + 1}
                                                    </span>
                                                    <span className="stats-page__leaderboard-item-name" title={author.name}>
                                                        {author.name}
                                                    </span>
                                                </div>
                                                <span className="stats-page__leaderboard-item-badge">
                                                    {author.bookCount} {author.bookCount > 1 ? "albums" : "album"}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted, #64748b)", fontSize: "0.9rem" }}>
                                        Aucun auteur répertorié
                                    </div>
                                )}
                            </div>

                            {/* Top Publishers */}
                            <div className="stats-page__section-card">
                                <div className="stats-page__section-header">
                                    <div>
                                        <h3>
                                            <FontAwesomeIcon icon={faBuilding} style={{ color: "#fbbf24" }} />
                                            <span>Éditeurs favoris</span>
                                        </h3>
                                        <p>Maisons d'édition dominantes de votre bibliothèque</p>
                                    </div>
                                </div>

                                {stats.topPublishers && stats.topPublishers.length > 0 ? (
                                    <div className="stats-page__leaderboard">
                                        {stats.topPublishers.map((pub, idx) => (
                                            <div key={pub.name} className="stats-page__leaderboard-item">
                                                <div className="stats-page__leaderboard-item-left">
                                                    <span className={`stats-page__leaderboard-item-rank stats-page__leaderboard-item-rank--${idx + 1}`}>
                                                        {idx + 1}
                                                    </span>
                                                    <span className="stats-page__leaderboard-item-name" title={pub.name}>
                                                        {pub.name}
                                                    </span>
                                                </div>
                                                <span className="stats-page__leaderboard-item-badge" style={{
                                                    background: "rgba(245, 158, 11, 0.12)",
                                                    color: "#fbbf24",
                                                    borderColor: "rgba(245, 158, 11, 0.25)"
                                                }}>
                                                    {pub.count} {pub.count > 1 ? "albums" : "album"} ({pub.percentage}%)
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted, #64748b)", fontSize: "0.9rem" }}>
                                        Aucun éditeur répertorié
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 7. HALL OF FAME / RECORDS */}
                        <div className="stats-page__section-card">
                            <div className="stats-page__section-header">
                                <div>
                                    <h3>
                                        <FontAwesomeIcon icon={faCrown} style={{ color: "#fbbf24" }} />
                                        <span>Le Panthéon & Records de la collection</span>
                                    </h3>
                                    <p>Les pièces maîtresses et records remarquables de votre bibliothèque</p>
                                </div>
                            </div>

                            <div className="stats-page__records-grid">
                                {/* Top Author */}
                                {stats.topAuthor && (
                                    <div className="stats-page__record-card">
                                        <div className="stats-page__record-header" style={{ color: "#818cf8" }}>
                                            <FontAwesomeIcon icon={faUserPen} />
                                            <span>Auteur vedette</span>
                                        </div>
                                        <div className="stats-page__record-body">
                                            <div className="stats-page__record-cover-placeholder" style={{ color: "#818cf8" }}>
                                                <FontAwesomeIcon icon={faCrown} />
                                            </div>
                                            <div className="stats-page__record-info">
                                                <div className="stats-page__record-title">
                                                    {stats.topAuthor.name}
                                                </div>
                                                <div className="stats-page__record-meta">
                                                    Auteur le plus représenté
                                                </div>
                                                <span className="stats-page__record-tag" style={{ color: "#818cf8" }}>
                                                    {stats.topAuthor.bookCount} {stats.topAuthor.bookCount > 1 ? "albums possédés" : "album possédé"}
                                                </span>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: "0.8rem", color: "var(--text-muted, #64748b)" }}>
                                            Figure de proue de votre collection
                                        </div>
                                    </div>
                                )}

                                {/* Oldest Book */}
                                {stats.oldestBook && (
                                    <div className="stats-page__record-card">
                                        <div className="stats-page__record-header" style={{ color: "#f59e0b" }}>
                                            <FontAwesomeIcon icon={faCalendarDays} />
                                            <span>Le doyen</span>
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
                                                    Paru le {formatDate(stats.oldestBook.releaseDate)}
                                                </div>
                                                {stats.oldestBook.category && (
                                                    <span className="stats-page__record-tag">
                                                        {stats.oldestBook.category}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <Link
                                            to={`/app/book/${stats.oldestBook.id}`}
                                            className="stats-page__record-link"
                                            style={{ color: "#f59e0b" }}
                                        >
                                            <span>Consulter la fiche</span>
                                            <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: "0.75rem" }} />
                                        </Link>
                                    </div>
                                )}

                                {/* Newest Book */}
                                {stats.newestBook && (
                                    <div className="stats-page__record-card">
                                        <div className="stats-page__record-header" style={{ color: "var(--accent-primary)" }}>
                                            <FontAwesomeIcon icon={faCalendarDays} />
                                            <span>Dernière parution</span>
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
                                                    Paru le {formatDate(stats.newestBook.releaseDate)}
                                                </div>
                                                {stats.newestBook.category && (
                                                    <span className="stats-page__record-tag">
                                                        {stats.newestBook.category}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <Link
                                            to={`/app/book/${stats.newestBook.id}`}
                                            className="stats-page__record-link"
                                            style={{ color: "var(--accent-primary)" }}
                                        >
                                            <span>Consulter la fiche</span>
                                            <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: "0.75rem" }} />
                                        </Link>
                                    </div>
                                )}

                                {/* Thickest Book */}
                                {stats.thickestBook && (
                                    <div className="stats-page__record-card">
                                        <div className="stats-page__record-header" style={{ color: "#38bdf8" }}>
                                            <FontAwesomeIcon icon={faFileLines} />
                                            <span>Le plus gros volume</span>
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
                                                    Volume le plus imposant
                                                </div>
                                                <span className="stats-page__record-tag" style={{ color: "#38bdf8" }}>
                                                    {stats.thickestBook.highlightValue || `${stats.thickestBook.pageCount} pages`}
                                                </span>
                                            </div>
                                        </div>
                                        <Link
                                            to={`/app/book/${stats.thickestBook.id}`}
                                            className="stats-page__record-link"
                                            style={{ color: "#38bdf8" }}
                                        >
                                            <span>Consulter la fiche</span>
                                            <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: "0.75rem" }} />
                                        </Link>
                                    </div>
                                )}

                                {/* Most Valuable Book */}
                                {stats.mostValuableBook && stats.mostValuableBook.price && stats.mostValuableBook.price > 0 && (
                                    <div className="stats-page__record-card">
                                        <div className="stats-page__record-header" style={{ color: "#fbbf24" }}>
                                            <FontAwesomeIcon icon={faGem} />
                                            <span>La plus belle pièce</span>
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
                                                    Prix le plus élevé
                                                </div>
                                                <span className="stats-page__record-tag" style={{ color: "#fbbf24" }}>
                                                    {stats.mostValuableBook.highlightValue || `${stats.mostValuableBook.price} €`}
                                                </span>
                                            </div>
                                        </div>
                                        <Link
                                            to={`/app/book/${stats.mostValuableBook.id}`}
                                            className="stats-page__record-link"
                                            style={{ color: "#fbbf24" }}
                                        >
                                            <span>Consulter la fiche</span>
                                            <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: "0.75rem" }} />
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
