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
                <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                    Origine géographique des parutions
                </div>
                <div style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "4px 12px",
                    borderRadius: "14px",
                    background: "var(--accent-primary-light)",
                    border: "1px solid var(--border-focus)",
                    color: "var(--accent-primary)",
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
                background: "var(--map-bg, var(--bg-card))",
                borderRadius: "16px",
                border: "1px solid var(--border-subtle)",
                padding: "16px",
                overflow: "hidden",
                boxShadow: "var(--shadow-sm)"
            }}>
                <svg
                    viewBox="0 0 1000 540"
                    style={{
                        width: "100%",
                        height: "auto",
                        display: "block",
                        filter: "drop-shadow(0 4px 12px rgba(0, 0, 0, 0.15))"
                    }}
                    onMouseMove={handleMouseMove}
                >
                    <defs>
                        <radialGradient id="ocean-glow" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor="var(--map-ocean, rgba(99, 102, 241, 0.05))" />
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
                                    ? (isCurrentlyHovered ? "var(--accent-primary-hover)" : "var(--accent-primary)")
                                    : (isCurrentlyHovered ? "var(--map-unowned-hover)" : "var(--map-unowned)")
                                }
                                stroke={isOwned
                                    ? "var(--accent-primary)"
                                    : "var(--map-stroke)"
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
                        background: "var(--bg-surface)",
                        backdropFilter: "blur(12px)",
                        border: `1px solid ${hover.stat ? "var(--accent-primary)" : "var(--border-subtle)"}`,
                        borderRadius: "10px",
                        padding: "8px 14px",
                        boxShadow: "var(--shadow-lg)",
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
                            color: "var(--text-primary)"
                        }}>
                            {hover.stat?.flag && <span>{hover.stat.flag}</span>}
                            <span>{hover.name}</span>
                        </div>
                        <div style={{
                            fontSize: "0.8rem",
                            color: hover.stat ? "var(--accent-primary)" : "var(--text-muted)",
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
                                background: "var(--bg-elevated)",
                                border: "1px solid var(--border-subtle)",
                                fontSize: "0.85rem",
                                color: "var(--text-primary)"
                            }}
                        >
                            <span style={{ fontSize: "1.1rem" }}>{c.flag}</span>
                            <span style={{ fontWeight: 600 }}>{c.name}</span>
                            <span style={{
                                fontSize: "0.75rem",
                                padding: "2px 6px",
                                borderRadius: "8px",
                                background: "var(--accent-primary-light)",
                                color: "var(--accent-primary)",
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
