import { useState } from "react";
import { CategoryStatDTO } from "../../dto/UserStatistics.dto.ts";

interface PieChartProps {
    data: CategoryStatDTO[];
    totalCount: number;
    title?: string;
}

export default function PieChart({ data, totalCount, title = "Répartition par genre" }: PieChartProps) {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    const size = 280;
    const center = size / 2;
    const outerRadius = 115;
    const innerRadius = 68;

    if (!data || data.length === 0 || totalCount === 0) {
        return (
            <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "36px 16px",
                color: "var(--text-muted, #9ca3af)",
                fontSize: "0.9rem"
            }}>
                <div style={{
                    width: "120px",
                    height: "120px",
                    borderRadius: "50%",
                    border: "2px dashed var(--border-subtle)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "12px",
                    color: "var(--text-muted, #9ca3af)"
                }}>
                    Aucun livre
                </div>
                <span>Pas encore de parutions enregistrées</span>
            </div>
        );
    }

    // Build arcs
    let accumulatedAngle = -Math.PI / 2; // Start at top (12 o'clock)
    const slices = data.map((item, index) => {
        const sliceAngle = (item.count / totalCount) * 2 * Math.PI;
        const startAngle = accumulatedAngle;
        const endAngle = accumulatedAngle + sliceAngle;
        accumulatedAngle = endAngle;

        const isHovered = hoveredIndex === index;
        const rOut = isHovered ? outerRadius + 6 : outerRadius;
        const rIn = isHovered ? innerRadius - 2 : innerRadius;

        // If slice is almost 100%, avoid degenerate SVG arc
        const isFull = sliceAngle >= 2 * Math.PI - 0.001;

        let pathData = "";
        if (isFull) {
            // Draw donut with 2 arcs
            const midAngle = startAngle + Math.PI;
            const x1 = center + rOut * Math.cos(startAngle);
            const y1 = center + rOut * Math.sin(startAngle);
            const x2 = center + rOut * Math.cos(midAngle);
            const y2 = center + rOut * Math.sin(midAngle);
            const ix1 = center + rIn * Math.cos(startAngle);
            const iy1 = center + rIn * Math.sin(startAngle);
            const ix2 = center + rIn * Math.cos(midAngle);
            const iy2 = center + rIn * Math.sin(midAngle);

            pathData = `
                M ${x1} ${y1}
                A ${rOut} ${rOut} 0 0 1 ${x2} ${y2}
                A ${rOut} ${rOut} 0 0 1 ${x1} ${y1}
                M ${ix1} ${iy1}
                A ${rIn} ${rIn} 0 0 0 ${ix2} ${iy2}
                A ${rIn} ${rIn} 0 0 0 ${ix1} ${iy1}
                Z
            `;
        } else {
            const x1 = center + rOut * Math.cos(startAngle);
            const y1 = center + rOut * Math.sin(startAngle);
            const x2 = center + rOut * Math.cos(endAngle);
            const y2 = center + rOut * Math.sin(endAngle);

            const x3 = center + rIn * Math.cos(endAngle);
            const y3 = center + rIn * Math.sin(endAngle);
            const x4 = center + rIn * Math.cos(startAngle);
            const y4 = center + rIn * Math.sin(startAngle);

            const largeArc = sliceAngle > Math.PI ? 1 : 0;

            pathData = `
                M ${x1} ${y1}
                A ${rOut} ${rOut} 0 ${largeArc} 1 ${x2} ${y2}
                L ${x3} ${y3}
                A ${rIn} ${rIn} 0 ${largeArc} 0 ${x4} ${y4}
                Z
            `;
        }

        return {
            ...item,
            index,
            pathData,
            isHovered
        };
    });

    const activeItem = hoveredIndex !== null ? data[hoveredIndex] : null;

    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "18px",
            width: "100%"
        }}>
            {title && (
                <div style={{
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    color: "var(--text-primary, #ffffff)"
                }}>
                    {title}
                </div>
            )}

            <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-around",
                flexWrap: "wrap",
                gap: "24px"
            }}>
                {/* Donut Chart SVG */}
                <div style={{ position: "relative", width: `${size}px`, height: `${size}px`, flexShrink: 0 }}>
                    <svg
                        width={size}
                        height={size}
                        viewBox={`0 0 ${size} ${size}`}
                        style={{ overflow: "visible" }}
                    >
                        <defs>
                            <filter id="pie-glow" x="-20%" y="-20%" width="140%" height="140%">
                                <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.35" />
                            </filter>
                        </defs>

                        {slices.map((slice) => (
                            <path
                                key={slice.name}
                                d={slice.pathData}
                                fill={slice.color}
                                filter={slice.isHovered ? "url(#pie-glow)" : undefined}
                                style={{
                                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                    cursor: "pointer",
                                    opacity: hoveredIndex === null || slice.isHovered ? 1 : 0.65
                                }}
                                onMouseEnter={() => setHoveredIndex(slice.index)}
                                onMouseLeave={() => setHoveredIndex(null)}
                            />
                        ))}
                    </svg>

                    {/* Donut Center Display */}
                    <div style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        pointerEvents: "none",
                        textAlign: "center"
                    }}>
                        {activeItem ? (
                            <>
                                <span style={{
                                    fontSize: "1.45rem",
                                    fontWeight: 800,
                                    color: activeItem.color,
                                    lineHeight: 1.1
                                }}>
                                    {activeItem.percentage}%
                                </span>
                                <span style={{
                                    fontSize: "0.8rem",
                                    color: "var(--text-primary, #fff)",
                                    fontWeight: 600,
                                    maxWidth: "110px",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap"
                                }}>
                                    {activeItem.name}
                                </span>
                                <span style={{
                                    fontSize: "0.75rem",
                                    color: "var(--text-muted, #9ca3af)"
                                }}>
                                    {activeItem.count} {activeItem.count > 1 ? "livres" : "livre"}
                                </span>
                            </>
                        ) : (
                            <>
                                <span style={{
                                    fontSize: "1.75rem",
                                    fontWeight: 800,
                                    color: "var(--text-primary, #ffffff)",
                                    lineHeight: 1.1
                                }}>
                                    {totalCount}
                                </span>
                                <span style={{
                                    fontSize: "0.8rem",
                                    color: "var(--text-muted, #9ca3af)",
                                    fontWeight: 500,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.05em"
                                }}>
                                    {totalCount > 1 ? "albums" : "album"}
                                </span>
                            </>
                        )}
                    </div>
                </div>

                {/* Legend list */}
                <div style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    flex: "1 1 200px",
                    maxWidth: "320px"
                }}>
                    {data.map((item, idx) => {
                        const isHovered = hoveredIndex === idx;
                        return (
                            <div
                                key={item.name}
                                onMouseEnter={() => setHoveredIndex(idx)}
                                onMouseLeave={() => setHoveredIndex(null)}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    padding: "8px 12px",
                                    borderRadius: "10px",
                                    background: isHovered ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.03)",
                                    border: `1px solid ${isHovered ? item.color + "60" : "transparent"}`,
                                    cursor: "pointer",
                                    transition: "all 0.15s ease"
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                    <span style={{
                                        width: "12px",
                                        height: "12px",
                                        borderRadius: "50%",
                                        backgroundColor: item.color,
                                        boxShadow: isHovered ? `0 0 8px ${item.color}` : "none",
                                        flexShrink: 0
                                    }} />
                                    <span style={{
                                        fontSize: "0.9rem",
                                        fontWeight: isHovered ? 700 : 500,
                                        color: "var(--text-primary, #ffffff)"
                                    }}>
                                        {item.name}
                                    </span>
                                </div>

                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <span style={{
                                        fontSize: "0.85rem",
                                        color: "var(--text-muted, #9ca3af)"
                                    }}>
                                        {item.count}
                                    </span>
                                    <span style={{
                                        fontSize: "0.8rem",
                                        fontWeight: 700,
                                        padding: "2px 7px",
                                        borderRadius: "6px",
                                        background: isHovered ? item.color : "rgba(255, 255, 255, 0.08)",
                                        color: isHovered ? "#ffffff" : "var(--text-primary, #ffffff)"
                                    }}>
                                        {item.percentage}%
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
