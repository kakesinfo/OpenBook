import AchievementIcon from "./AchievementIcon.tsx";

export interface OrnamentOption {
    id: string;
    label: string;
}

export const ACHIEVEMENT_ORNAMENT_OPTIONS: OrnamentOption[] = [
    { id: "laurel", label: "Laurier" },
    { id: "stars", label: "Étoiles" },
    { id: "wings", label: "Ailes" },
    { id: "royal", label: "Rayons" },
    { id: "ribbon", label: "Ruban" },
    { id: "none", label: "Aucun" }
];

interface AchievementMedalProps {
    icon: string;
    ornament?: string;
    iconColor: string;
    backgroundColor: string;
    size?: "md" | "lg";
}

function Leaf({ x, y, rotate, scale = 1 }: { x: number; y: number; rotate: number; scale?: number }) {
    return (
        <path
            d="M0,-9 C4,-4 4,4 0,9 C-4,4 -4,-4 0,-9 Z"
            transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}
        />
    );
}

function Star5({ cx, cy, r, opacity = 1 }: { cx: number; cy: number; r: number; opacity?: number }) {
    const inner = r * 0.44;
    const pts: string[] = [];
    for (let i = 0; i < 10; i++) {
        const angle = (Math.PI / 5) * i - Math.PI / 2;
        const rad = i % 2 === 0 ? r : inner;
        pts.push(`${(cx + Math.cos(angle) * rad).toFixed(1)},${(cy + Math.sin(angle) * rad).toFixed(1)}`);
    }
    return <polygon points={pts.join(" ")} fill="currentColor" fillOpacity={opacity} />;
}

function Sparkle4({ cx, cy, r, opacity = 1 }: { cx: number; cy: number; r: number; opacity?: number }) {
    const c = (r * 0.24).toFixed(1);
    return (
        <path
            d={`M${cx} ${cy - r} Q${cx} ${cy - Number(c)} ${cx + r} ${cy} Q${cx} ${cy + Number(c)} ${cx} ${cy + r} Q${cx} ${cy + Number(c)} ${cx - r} ${cy} Q${cx} ${cy - Number(c)} ${cx} ${cy - r} Z`}
            fill="currentColor"
            fillOpacity={opacity}
        />
    );
}

function OrnamentSvg({ ornament, iconColor }: { ornament: string; iconColor: string }) {
    if (ornament === "none") {
        return null;
    }

    const commonProps = {
        className: "achievement-medal__wreath",
        viewBox: "0 0 160 160",
        fill: "none",
        xmlns: "http://www.w3.org/2000/svg",
        style: { color: iconColor },
        "aria-hidden": true as const
    };

    switch (ornament) {
        case "stars":
            return (
                <svg {...commonProps}>
                    <circle cx="80" cy="80" r="57" stroke="currentColor" strokeWidth="1.4" strokeOpacity="0.32" />
                    <circle cx="80" cy="80" r="64" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.22" strokeDasharray="2 5" />

                    {/* Top celestial crown */}
                    <Star5 cx={80} cy={16} r={9.5} />
                    <Star5 cx={51} cy={24} r={6.2} opacity={0.85} />
                    <Star5 cx={109} cy={24} r={6.2} opacity={0.85} />

                    {/* Side sparkles */}
                    <Sparkle4 cx={17} cy={74} r={8.5} opacity={0.9} />
                    <Sparkle4 cx={143} cy={74} r={8.5} opacity={0.9} />
                    <Sparkle4 cx={28} cy={46} r={5} opacity={0.65} />
                    <Sparkle4 cx={132} cy={46} r={5} opacity={0.65} />

                    {/* Bottom accent stars */}
                    <Star5 cx={80} cy={144} r={7.5} />
                    <Star5 cx={58} cy={138} r={4.8} opacity={0.78} />
                    <Star5 cx={102} cy={138} r={4.8} opacity={0.78} />
                    <circle cx="38" cy="121" r="2.2" fill="currentColor" fillOpacity="0.55" />
                    <circle cx="122" cy="121" r="2.2" fill="currentColor" fillOpacity="0.55" />
                </svg>
            );

        case "wings":
            return (
                <svg {...commonProps}>
                    {/* Subtle inner halo */}
                    <circle cx="80" cy="80" r="54" stroke="currentColor" strokeWidth="1.4" strokeOpacity="0.28" />

                    {/* Left wing - 3 feathered tiers */}
                    <path
                        d="M36 58 C22 44 10 42 5 48 C13 55 21 60 32 64 Z"
                        fill="currentColor"
                        fillOpacity="0.45"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M33 68 C18 62 8 64 5 72 C14 75 23 76 33 76 Z"
                        fill="currentColor"
                        fillOpacity="0.34"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M34 80 C20 80 12 85 11 93 C19 94 28 92 37 89 Z"
                        fill="currentColor"
                        fillOpacity="0.24"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M39 92 C28 95 22 102 22 108 C30 107 38 103 44 98 Z"
                        fill="currentColor"
                        fillOpacity="0.18"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                    />

                    {/* Right wing - 3 feathered tiers */}
                    <path
                        d="M124 58 C138 44 150 42 155 48 C147 55 139 60 128 64 Z"
                        fill="currentColor"
                        fillOpacity="0.45"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M127 68 C142 62 152 64 155 72 C146 75 137 76 127 76 Z"
                        fill="currentColor"
                        fillOpacity="0.34"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M126 80 C140 80 148 85 149 93 C141 94 132 92 123 89 Z"
                        fill="currentColor"
                        fillOpacity="0.24"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M121 92 C132 95 138 102 138 108 C130 107 122 103 116 98 Z"
                        fill="currentColor"
                        fillOpacity="0.18"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                    />

                    {/* Top & bottom crest diamonds */}
                    <polygon points="80,15 86,23 80,31 74,23" fill="currentColor" fillOpacity="0.85" />
                    <polygon points="80,130 87,139 80,148 73,139" fill="currentColor" />
                    <circle cx="65" cy="139" r="2.2" fill="currentColor" fillOpacity="0.65" />
                    <circle cx="95" cy="139" r="2.2" fill="currentColor" fillOpacity="0.65" />
                </svg>
            );

        case "royal":
            return (
                <svg {...commonProps}>
                    <circle cx="80" cy="80" r="55" stroke="currentColor" strokeWidth="1.8" strokeOpacity="0.42" />
                    <circle cx="80" cy="80" r="61" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.28" strokeDasharray="3 4" />

                    {/* 8 primary tapered rays */}
                    {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
                        <polygon
                            key={deg}
                            points="80,7 83.2,22 76.8,22"
                            fill="currentColor"
                            fillOpacity={deg % 90 === 0 ? 0.92 : 0.65}
                            transform={`rotate(${deg} 80 80)`}
                        />
                    ))}

                    {/* 8 secondary fine ticks */}
                    {[22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5].map((deg) => (
                        <line
                            key={deg}
                            x1="80"
                            y1="14"
                            x2="80"
                            y2="23"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeOpacity="0.45"
                            transform={`rotate(${deg} 80 80)`}
                        />
                    ))}
                </svg>
            );

        case "ribbon":
            return (
                <svg {...commonProps}>
                    {/* Top honor arc with beads */}
                    <path
                        d="M32 54 A54 54 0 0 1 128 54"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeOpacity="0.45"
                        strokeLinecap="round"
                    />
                    <circle cx="80" cy="21" r="3.5" fill="currentColor" fillOpacity="0.9" />
                    <circle cx="62" cy="24" r="2.2" fill="currentColor" fillOpacity="0.6" />
                    <circle cx="98" cy="24" r="2.2" fill="currentColor" fillOpacity="0.6" />

                    {/* Left swallowtail ribbon */}
                    <path
                        d="M52 114 L38 152 L54 143 L66 154 L76 122 Z"
                        fill="currentColor"
                        fillOpacity="0.34"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinejoin="round"
                    />
                    {/* Right swallowtail ribbon */}
                    <path
                        d="M108 114 L122 152 L106 143 L94 154 L84 122 Z"
                        fill="currentColor"
                        fillOpacity="0.34"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinejoin="round"
                    />
                    {/* Center clasp */}
                    <rect
                        x="63"
                        y="119"
                        width="34"
                        height="12"
                        rx="6"
                        fill="currentColor"
                        fillOpacity="0.92"
                    />
                </svg>
            );

        case "laurel":
        default:
            return (
                <svg {...commonProps}>
                    {/* Left branch stem */}
                    <path
                        d="M66 135 C34 125 18 98 20 68 C22 47 32 30 48 20"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeOpacity="0.6"
                    />
                    {/* Left branch paired leaves */}
                    <g fill="currentColor" fillOpacity="0.82">
                        <Leaf x={44} y={24} rotate={-48} scale={0.78} />
                        <Leaf x={32} y={35} rotate={-36} scale={0.86} />
                        <Leaf x={24} y={49} rotate={-22} scale={0.92} />
                        <Leaf x={19} y={65} rotate={-8} scale={0.96} />
                        <Leaf x={19} y={82} rotate={8} scale={0.96} />
                        <Leaf x={24} y={98} rotate={24} scale={0.92} />
                        <Leaf x={34} y={113} rotate={42} scale={0.88} />
                        <Leaf x={48} y={125} rotate={58} scale={0.82} />
                    </g>
                    <g fill="currentColor" fillOpacity="0.48">
                        <Leaf x={39} y={40} rotate={18} scale={0.72} />
                        <Leaf x={32} y={56} rotate={28} scale={0.76} />
                        <Leaf x={29} y={73} rotate={38} scale={0.78} />
                        <Leaf x={31} y={90} rotate={52} scale={0.76} />
                        <Leaf x={38} y={105} rotate={68} scale={0.74} />
                    </g>

                    {/* Right branch stem */}
                    <path
                        d="M94 135 C126 125 142 98 140 68 C138 47 128 30 112 20"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeOpacity="0.6"
                    />
                    {/* Right branch paired leaves */}
                    <g fill="currentColor" fillOpacity="0.82">
                        <Leaf x={116} y={24} rotate={48} scale={0.78} />
                        <Leaf x={128} y={35} rotate={36} scale={0.86} />
                        <Leaf x={136} y={49} rotate={22} scale={0.92} />
                        <Leaf x={141} y={65} rotate={8} scale={0.96} />
                        <Leaf x={141} y={82} rotate={-8} scale={0.96} />
                        <Leaf x={136} y={98} rotate={-24} scale={0.92} />
                        <Leaf x={126} y={113} rotate={-42} scale={0.88} />
                        <Leaf x={112} y={125} rotate={-58} scale={0.82} />
                    </g>
                    <g fill="currentColor" fillOpacity="0.48">
                        <Leaf x={121} y={40} rotate={-18} scale={0.72} />
                        <Leaf x={128} y={56} rotate={-28} scale={0.76} />
                        <Leaf x={131} y={73} rotate={-38} scale={0.78} />
                        <Leaf x={129} y={90} rotate={-52} scale={0.76} />
                        <Leaf x={122} y={105} rotate={-68} scale={0.74} />
                    </g>

                    {/* Crossed stems & bottom star crest */}
                    <path
                        d="M64 134 L90 144 M96 134 L70 144"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeOpacity="0.58"
                    />
                    <Star5 cx={80} cy={138} r={7.2} />
                </svg>
            );
    }
}

export default function AchievementMedal({
    icon,
    ornament = "laurel",
    iconColor,
    backgroundColor,
    size = "lg"
}: AchievementMedalProps) {
    return (
        <div
            className={`achievement-medal achievement-medal--${size}`}
            style={{ "--medal-color": iconColor, "--medal-bg": backgroundColor } as React.CSSProperties}
        >
            <OrnamentSvg ornament={ornament} iconColor={iconColor} />

            {/* Enameled metallic medallion */}
            <div
                className="achievement-card__badge"
                style={{
                    backgroundColor,
                    color: iconColor
                }}
            >
                <div className="achievement-card__badge-ring" />
                <AchievementIcon icon={icon} />
            </div>
        </div>
    );
}
