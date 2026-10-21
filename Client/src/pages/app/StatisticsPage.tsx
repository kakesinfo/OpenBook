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
    faRotate
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

    // Estimated reading hours (~1.5 minutes per page)
    const estimatedReadingHours = stats && stats.totalPages > 0
        ? Math.round((stats.totalPages * 1.5) / 60)
        : 0;

    return (
        <div className="stats-page">
            <WrapperHeader>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <h2>Statistiques</h2>
                </div>
            </WrapperHeader>

            <div className="stats-page__content">
                {loading && (
                    <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted, #9ca3af)" }}>
                        <FontAwesomeIcon icon={faRotate} spin style={{ fontSize: "2rem", marginBottom: "16px" }} />
                        <div>Calcul de vos statistiques en cours...</div>
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
                        <p>{error}</p>
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

                {!loading && !error && stats && (
                    <>
                        {/* 4 Key Totals Cards */}
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                            gap: "16px"
                        }}>
                            <div className="stats-page__metric-card">
                                <div className="stats-page__metric-icon" style={{ background: "rgba(99, 102, 241, 0.15)", color: "#818cf8" }}>
                                    <FontAwesomeIcon icon={faBook} />
                                </div>
                                <div>
                                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted, #9ca3af)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                                        Dans la collection
                                    </div>
                                    <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary, #ffffff)" }}>
                                        {stats.totalOwnedBooks}
                                        <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text-muted, #9ca3af)", marginLeft: "6px" }}>
                                            {stats.totalOwnedBooks > 1 ? "albums" : "album"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="stats-page__metric-card">
                                <div className="stats-page__metric-icon" style={{ background: "rgba(236, 72, 153, 0.15)", color: "#f472b6" }}>
                                    <FontAwesomeIcon icon={faHeart} />
                                </div>
                                <div>
                                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted, #9ca3af)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                                        Dans les souhaits
                                    </div>
                                    <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary, #ffffff)" }}>
                                        {stats.totalWishlistBooks}
                                        <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text-muted, #9ca3af)", marginLeft: "6px" }}>
                                            {stats.totalWishlistBooks > 1 ? "envies" : "envie"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="stats-page__metric-card">
                                <div className="stats-page__metric-icon" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}>
                                    <FontAwesomeIcon icon={faFileLines} />
                                </div>
                                <div>
                                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted, #9ca3af)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                                        Total de pages
                                    </div>
                                    <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary, #ffffff)" }}>
                                        {stats.totalPages.toLocaleString("fr-FR")}
                                        <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text-muted, #9ca3af)", marginLeft: "6px" }}>
                                            pages
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="stats-page__metric-card">
                                <div className="stats-page__metric-icon" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24" }}>
                                    <FontAwesomeIcon icon={faCoins} />
                                </div>
                                <div>
                                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted, #9ca3af)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                                        Valeur estimée
                                    </div>
                                    <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary, #ffffff)" }}>
                                        {stats.totalEstimatedValue > 0 ? `${stats.totalEstimatedValue} €` : "—"}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Fun Comparisons: Height of Stack & Weight */}
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                            gap: "20px"
                        }}>
                            {/* Height Card */}
                            <div className="stats-page__section-card" style={{
                                background: "linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, var(--card-bg, #1e1e24) 100%)",
                                border: "1px solid rgba(99, 102, 241, 0.3)"
                            }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                        <div style={{
                                            width: "40px",
                                            height: "40px",
                                            borderRadius: "10px",
                                            background: "rgba(99, 102, 241, 0.2)",
                                            color: "#818cf8",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontSize: "18px"
                                        }}>
                                            <FontAwesomeIcon icon={faRulerVertical} />
                                        </div>
                                        <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>
                                            Hauteur de la pile
                                        </h3>
                                    </div>

                                    <div style={{ fontSize: "1.65rem", fontWeight: 800, color: "#818cf8" }}>
                                        {stats.totalHeightMeters} m
                                    </div>
                                </div>

                                <div style={{
                                    padding: "14px 18px",
                                    borderRadius: "12px",
                                    background: "rgba(255, 255, 255, 0.05)",
                                    border: "1px solid rgba(99, 102, 241, 0.2)",
                                    fontSize: "0.95rem",
                                    lineHeight: 1.5,
                                    color: "var(--text-primary, #ffffff)"
                                }}>
                                    <span style={{ fontSize: "1.2rem", marginRight: "8px" }}>📏</span>
                                    <strong>Comparaison insolite :</strong> {stats.heightComparison}
                                </div>
                            </div>

                            {/* Weight Card */}
                            <div className="stats-page__section-card" style={{
                                background: "linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, var(--card-bg, #1e1e24) 100%)",
                                border: "1px solid rgba(16, 185, 129, 0.3)"
                            }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                        <div style={{
                                            width: "40px",
                                            height: "40px",
                                            borderRadius: "10px",
                                            background: "rgba(16, 185, 129, 0.2)",
                                            color: "#34d399",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontSize: "18px"
                                        }}>
                                            <FontAwesomeIcon icon={faWeightHanging} />
                                        </div>
                                        <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>
                                            Poids de la collection
                                        </h3>
                                    </div>

                                    <div style={{ fontSize: "1.65rem", fontWeight: 800, color: "#34d399" }}>
                                        {stats.totalWeightKg} kg
                                    </div>
                                </div>

                                <div style={{
                                    padding: "14px 18px",
                                    borderRadius: "12px",
                                    background: "rgba(255, 255, 255, 0.05)",
                                    border: "1px solid rgba(16, 185, 129, 0.2)",
                                    fontSize: "0.95rem",
                                    lineHeight: 1.5,
                                    color: "var(--text-primary, #ffffff)"
                                }}>
                                    <span style={{ fontSize: "1.2rem", marginRight: "8px" }}>🐘</span>
                                    <strong>Comparaison insolite :</strong> {stats.weightComparison}
                                </div>
                            </div>
                        </div>

                        {/* Donut Chart (Camembert) */}
                        <div className="stats-page__section-card">
                            <PieChart
                                data={stats.categoryBreakdown}
                                totalCount={stats.totalOwnedBooks}
                                title="Camembert des types & genres de livres"
                            />
                        </div>

                        {/* Interactive World Map */}
                        <div className="stats-page__section-card">
                            <WorldMap
                                countries={stats.countries}
                                totalBooks={stats.totalOwnedBooks}
                            />
                        </div>

                        {/* Highlights & Records Grid */}
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                            gap: "20px"
                        }}>
                            {/* Top Author */}
                            {stats.topAuthor && (
                                <div className="stats-page__section-card" style={{ justifyContent: "space-between" }}>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                        <div style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "10px",
                                            color: "var(--text-muted, #9ca3af)",
                                            fontSize: "0.85rem",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.05em",
                                            fontWeight: 600
                                        }}>
                                            <FontAwesomeIcon icon={faUserPen} style={{ color: "var(--accent-secondary, #818cf8)" }} />
                                            <span>Auteur le plus lu</span>
                                        </div>
                                        <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--text-primary, #ffffff)" }}>
                                            {stats.topAuthor.name}
                                        </div>
                                    </div>
                                    <div style={{
                                        padding: "8px 14px",
                                        borderRadius: "10px",
                                        background: "rgba(99, 102, 241, 0.12)",
                                        border: "1px solid rgba(99, 102, 241, 0.25)",
                                        color: "#818cf8",
                                        fontSize: "0.9rem",
                                        fontWeight: 600,
                                        width: "fit-content"
                                    }}>
                                        {stats.topAuthor.bookCount} {stats.topAuthor.bookCount > 1 ? "livres possédés" : "livre possédé"}
                                    </div>
                                </div>
                            )}

                            {/* Oldest Book */}
                            {stats.oldestBook && (
                                <div className="stats-page__section-card" style={{ justifyContent: "space-between" }}>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                        <div style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "10px",
                                            color: "var(--text-muted, #9ca3af)",
                                            fontSize: "0.85rem",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.05em",
                                            fontWeight: 600
                                        }}>
                                            <FontAwesomeIcon icon={faCalendarDays} style={{ color: "#f59e0b" }} />
                                            <span>Le doyen de la collection</span>
                                        </div>
                                        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                                            {stats.oldestBook.coverUrl && (
                                                <img
                                                    src={stats.oldestBook.coverUrl}
                                                    alt={stats.oldestBook.title}
                                                    style={{ width: "42px", height: "60px", objectFit: "cover", borderRadius: "6px" }}
                                                />
                                            )}
                                            <div>
                                                <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary, #ffffff)" }}>
                                                    {stats.oldestBook.title}
                                                </div>
                                                <div style={{ fontSize: "0.85rem", color: "var(--text-muted, #9ca3af)" }}>
                                                    Paru le {new Date(stats.oldestBook.releaseDate).toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <Link
                                        to={`/app/book/${stats.oldestBook.id}`}
                                        style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "6px",
                                            fontSize: "0.85rem",
                                            color: "#818cf8",
                                            textDecoration: "none",
                                            fontWeight: 600
                                        }}
                                    >
                                        <span>Consulter la fiche</span>
                                        <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: "0.75rem" }} />
                                    </Link>
                                </div>
                            )}

                            {/* Newest Book */}
                            {stats.newestBook && (
                                <div className="stats-page__section-card" style={{ justifyContent: "space-between" }}>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                        <div style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "10px",
                                            color: "var(--text-muted, #9ca3af)",
                                            fontSize: "0.85rem",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.05em",
                                            fontWeight: 600
                                        }}>
                                            <FontAwesomeIcon icon={faCalendarDays} style={{ color: "#10b981" }} />
                                            <span>La parution la plus récente</span>
                                        </div>
                                        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                                            {stats.newestBook.coverUrl && (
                                                <img
                                                    src={stats.newestBook.coverUrl}
                                                    alt={stats.newestBook.title}
                                                    style={{ width: "42px", height: "60px", objectFit: "cover", borderRadius: "6px" }}
                                                />
                                            )}
                                            <div>
                                                <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary, #ffffff)" }}>
                                                    {stats.newestBook.title}
                                                </div>
                                                <div style={{ fontSize: "0.85rem", color: "var(--text-muted, #9ca3af)" }}>
                                                    Paru le {new Date(stats.newestBook.releaseDate).toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <Link
                                        to={`/app/book/${stats.newestBook.id}`}
                                        style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "6px",
                                            fontSize: "0.85rem",
                                            color: "#10b981",
                                            textDecoration: "none",
                                            fontWeight: 600
                                        }}
                                    >
                                        <span>Consulter la fiche</span>
                                        <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: "0.75rem" }} />
                                    </Link>
                                </div>
                            )}

                            {/* Estimated Reading Time */}
                            <div className="stats-page__section-card" style={{ justifyContent: "space-between" }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                    <div style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "10px",
                                        color: "var(--text-muted, #9ca3af)",
                                        fontSize: "0.85rem",
                                        textTransform: "uppercase",
                                        letterSpacing: "0.05em",
                                        fontWeight: 600
                                    }}>
                                        <FontAwesomeIcon icon={faHourglassHalf} style={{ color: "#a855f7" }} />
                                        <span>Temps estimé de lecture</span>
                                    </div>
                                    <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary, #ffffff)" }}>
                                        ~{estimatedReadingHours} heures
                                    </div>
                                    <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted, #9ca3af)" }}>
                                        Basé sur un rythme moyen de lecture de ~40 pages par heure.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
