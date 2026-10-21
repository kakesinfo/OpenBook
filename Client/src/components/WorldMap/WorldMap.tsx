import { useState, useMemo } from "react";
import { WORLD_PATHS, CountryPath } from "./worldPaths.ts";
import { CountryStatDTO } from "../../dto/UserStatistics.dto.ts";

interface WorldMapProps {
    countries: CountryStatDTO[];
    totalBooks: number;
}

interface HoverState {
    name: string;
    code: string;
    stat?: CountryStatDTO;
    x: number;
    y: number;
}

export default function WorldMap({ countries, totalBooks }: WorldMapProps) {
    const [hover, setHover] = useState<HoverState | null>(null);

    const ownedMap = useMemo(() => {
        const map = new Map<string, CountryStatDTO>();
        countries.forEach((c) => {
            map.set(c.code.toUpperCase(), c);
        });
        return map;
    }, [countries]);

    const handleMouseEnter = (event: React.MouseEvent, country: CountryPath) => {
        const stat = ownedMap.get(country.id.toUpperCase());
        const rect = (event.currentTarget.closest("svg") || event.currentTarget).getBoundingClientRect();
        setHover({
            name: stat ? stat.name : country.name,
            code: country.id,
            stat,
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        });
    };

    const handleMouseMove = (event: React.MouseEvent) => {
        if (!hover) return;
        const rect = (event.currentTarget.closest("svg") || event.currentTarget).getBoundingClientRect();
        setHover((prev) => prev ? {
            ...prev,
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        } : null);
    };

    const handleMouseLeave = () => {
        setHover(null);
    };

    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "18px",
            width: "100%",
            position: "relative"
        }}>
            <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "10px"
            }}>
                <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary, #ffffff)" }}>
                    Origine géographique des parutions
                </div>
                <div style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "4px 12px",
                    borderRadius: "14px",
                    background: "rgba(16, 185, 129, 0.15)",
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                    color: "#34d399",
                    fontSize: "0.85rem",
                    fontWeight: 600
                }}>
                    <span>{countries.length} pays d'origine • {totalBooks} {totalBooks > 1 ? "albums" : "album"}</span>
                </div>
            </div>

            {/* Map Container */}
            <div style={{
                position: "relative",
                width: "100%",
                background: "rgba(11, 15, 23, 0.65)",
                borderRadius: "16px",
                border: "1px solid var(--border-color, #2a2a32)",
                padding: "16px",
                overflow: "hidden"
            }}>
                <svg
                    viewBox="0 0 1000 540"
                    style={{
                        width: "100%",
                        height: "auto",
                        display: "block",
                        filter: "drop-shadow(0 4px 16px rgba(0, 0, 0, 0.4))"
                    }}
                    onMouseMove={handleMouseMove}
                >
                    <defs>
                        <radialGradient id="ocean-glow" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor="rgba(99, 102, 241, 0.05)" />
                            <stop offset="100%" stopColor="transparent" />
                        </radialGradient>
                    </defs>

                    {/* Ocean background */}
                    <rect width="1000" height="540" fill="url(#ocean-glow)" rx="8" />

                    {/* All Countries */}
                    {WORLD_PATHS.map((country) => {
                        const isOwned = ownedMap.has(country.id.toUpperCase());
                        const isCurrentlyHovered = hover?.code === country.id;

                        return (
                            <path
                                key={country.id + country.name}
                                d={country.d}
                                fill={isOwned
                                    ? (isCurrentlyHovered ? "#34d399" : "#10b981")
                                    : (isCurrentlyHovered ? "rgba(255, 255, 255, 0.18)" : "rgba(255, 255, 255, 0.06)")
                                }
                                stroke={isOwned
                                    ? "#6ee7b7"
                                    : "rgba(255, 255, 255, 0.12)"
                                }
                                strokeWidth={isOwned ? (isCurrentlyHovered ? 1.5 : 1.0) : 0.6}
                                style={{
                                    transition: "all 0.15s ease",
                                    cursor: "pointer"
                                }}
                                onMouseEnter={(e) => handleMouseEnter(e, country)}
                                onMouseLeave={handleMouseLeave}
                            />
                        );
                    })}
                </svg>

                {/* Floating Tooltip */}
                {hover && (
                    <div style={{
                        position: "absolute",
                        left: `${Math.min(Math.max(hover.x + 12, 10), 820)}px`,
                        top: `${Math.max(hover.y - 45, 10)}px`,
                        pointerEvents: "none",
                        background: "rgba(19, 25, 38, 0.95)",
                        backdropFilter: "blur(12px)",
                        border: `1px solid ${hover.stat ? "#10b981" : "rgba(255, 255, 255, 0.15)"}`,
                        borderRadius: "10px",
                        padding: "8px 14px",
                        boxShadow: "0 6px 20px rgba(0, 0, 0, 0.5)",
                        zIndex: 30,
                        display: "flex",
                        flexDirection: "column",
                        gap: "2px"
                    }}>
                        <div style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            fontSize: "0.9rem",
                            fontWeight: 700,
                            color: "#ffffff"
                        }}>
                            {hover.stat?.flag && <span>{hover.stat.flag}</span>}
                            <span>{hover.name}</span>
                        </div>
                        <div style={{
                            fontSize: "0.8rem",
                            color: hover.stat ? "#34d399" : "var(--text-muted, #9ca3af)",
                            fontWeight: hover.stat ? 600 : 400
                        }}>
                            {hover.stat
                                ? `${hover.stat.count} ${hover.stat.count > 1 ? "livres" : "livre"} (${hover.stat.percentage}%)`
                                : "Aucun livre possédé"
                            }
                        </div>
                    </div>
                )}
            </div>

            {/* Country Badges List */}
            {countries.length > 0 && (
                <div style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "10px",
                    alignItems: "center"
                }}>
                    {countries.map((c) => (
                        <div
                            key={c.code}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "6px 14px",
                                borderRadius: "20px",
                                background: "rgba(255, 255, 255, 0.04)",
                                border: "1px solid rgba(16, 185, 129, 0.3)",
                                fontSize: "0.85rem",
                                color: "var(--text-primary, #ffffff)"
                            }}
                        >
                            <span style={{ fontSize: "1.1rem" }}>{c.flag}</span>
                            <span style={{ fontWeight: 600 }}>{c.name}</span>
                            <span style={{
                                fontSize: "0.75rem",
                                padding: "2px 6px",
                                borderRadius: "8px",
                                background: "rgba(16, 185, 129, 0.2)",
                                color: "#34d399",
                                fontWeight: 700
                            }}>
                                {c.count} ({c.percentage}%)
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
