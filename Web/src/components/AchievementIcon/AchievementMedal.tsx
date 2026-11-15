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

function OrnamentSvg({ ornament, iconColor }: { ornament: string; iconColor: string }) {
    if (ornament === "none") {
        return null;
    }

    const commonProps = {
        className: "achievement-medal__wreath",
        viewBox: "0 0 140 132",
        fill: "none",
        xmlns: "http://www.w3.org/2000/svg",
        style: { color: iconColor },
        "aria-hidden": true as const
    };

    switch (ornament) {
        case "stars":
            return (
                <svg {...commonProps}>
                    <circle cx="70" cy="64" r="54" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.35" strokeDasharray="4 4" />
                    {/* Orbiting stars */}
                    <path d="M70 4L71.8 8.2L76.3 8.8L73 11.9L73.9 16.4L70 14.2L66.1 16.4L67 11.9L63.7 8.8L68.2 8.2L70 4Z" fill="currentColor" />
                    <path d="M24 26L25.4 29.2L28.8 29.7L26.3 32L27 35.4L24 33.7L21 35.4L21.7 32L19.2 29.7L22.6 29.2L24 26Z" fill="currentColor" fillOpacity="0.85" />
                    <path d="M116 26L117.4 29.2L120.8 29.7L118.3 32L119 35.4L116 33.7L113 35.4L113.7 32L111.2 29.7L114.6 29.2L116 26Z" fill="currentColor" fillOpacity="0.85" />
                    <path d="M14 64L15.4 67.2L18.8 67.7L16.3 70L17 73.4L14 71.7L11 73.4L11.7 70L9.2 67.7L12.6 67.2L14 64Z" fill="currentColor" fillOpacity="0.7" />
                    <path d="M126 64L127.4 67.2L130.8 67.7L128.3 70L129 73.4L126 71.7L123 73.4L123.7 70L121.2 67.7L124.6 67.2L126 64Z" fill="currentColor" fillOpacity="0.7" />
                    <path d="M53 114L54.6 117.6L58.5 118.1L55.6 120.8L56.4 124.7L53 122.8L49.6 124.7L50.4 120.8L47.5 118.1L51.4 117.6L53 114Z" fill="currentColor" fillOpacity="0.85" />
                    <path d="M70 116L72.2 120.8L77.5 121.5L73.6 125.1L74.6 130.3L70 127.8L65.4 130.3L66.4 125.1L62.5 121.5L67.8 120.8L70 116Z" fill="currentColor" />
                    <path d="M87 114L88.6 117.6L92.5 118.1L89.6 120.8L90.4 124.7L87 122.8L83.6 124.7L84.4 120.8L81.5 118.1L85.4 117.6L87 114Z" fill="currentColor" fillOpacity="0.85" />
                </svg>
            );

        case "wings":
            return (
                <svg {...commonProps}>
                    {/* Left wing */}
                    <path d="M36 48C22 38 10 34 6 40C14 48 22 52 32 54C16 54 8 56 6 62C14 66 24 66 34 66C20 68 12 72 12 78C20 80 30 78 38 76" fill="currentColor" fillOpacity="0.28" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
                    {/* Right wing */}
                    <path d="M104 48C118 38 130 34 134 40C126 48 118 52 108 54C124 54 132 56 134 62C126 66 116 66 106 66C120 68 128 72 128 78C120 80 110 78 102 76" fill="currentColor" fillOpacity="0.28" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
                    {/* Bottom gem */}
                    <polygon points="70,113 77,121 70,129 63,121" fill="currentColor" />
                </svg>
            );

        case "royal":
            return (
                <svg {...commonProps}>
                    {/* Sunburst / royal seal rays */}
                    <circle cx="70" cy="64" r="52" stroke="currentColor" strokeWidth="2" strokeOpacity="0.45" />
                    <circle cx="70" cy="64" r="56" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.3" strokeDasharray="3 5" />
                    <path d="M70 4V14M70 114V124M10 64H20M120 64H130M27 21L34 28M106 100L113 107M113 21L106 28M34 100L27 107" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
                    <circle cx="70" cy="119" r="3.5" fill="currentColor" />
                </svg>
            );

        case "ribbon":
            return (
                <svg {...commonProps}>
                    {/* Double outer arc */}
                    <path d="M26 30C36 16 52 9 70 9C88 9 104 16 114 30" stroke="currentColor" strokeWidth="2" strokeOpacity="0.45" strokeLinecap="round" />
                    {/* Crossed honor ribbon at bottom */}
                    <path d="M34 102L46 126L56 118L66 126L54 104" fill="currentColor" fillOpacity="0.35" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
                    <path d="M106 102L94 126L84 118L74 126L86 104" fill="currentColor" fillOpacity="0.35" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
                    <rect x="44" y="106" width="52" height="12" rx="6" fill="currentColor" fillOpacity="0.85" />
                </svg>
            );

        case "laurel":
        default:
            return (
                <svg {...commonProps}>
                    {/* Left laurel branch */}
                    <path
                        d="M46 112C24 98 14 76 16 50C17.5 34 24 22 33 14"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeOpacity="0.65"
                    />
                    <g fill="currentColor" fillOpacity="0.78">
                        <ellipse cx="26" cy="24" rx="4.2" ry="7.2" transform="rotate(-38 26 24)" />
                        <ellipse cx="18" cy="37" rx="4.2" ry="7.5" transform="rotate(-24 18 37)" />
                        <ellipse cx="14" cy="52" rx="4.2" ry="7.5" transform="rotate(-8 14 52)" />
                        <ellipse cx="15" cy="67" rx="4.2" ry="7.5" transform="rotate(10 15 67)" />
                        <ellipse cx="20" cy="82" rx="4.2" ry="7.2" transform="rotate(28 20 82)" />
                        <ellipse cx="29" cy="95" rx="4" ry="6.8" transform="rotate(44 29 95)" />
                        <ellipse cx="40" cy="105" rx="3.8" ry="6.2" transform="rotate(58 40 105)" />
                    </g>

                    {/* Right laurel branch */}
                    <path
                        d="M94 112C116 98 126 76 124 50C122.5 34 116 22 107 14"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeOpacity="0.65"
                    />
                    <g fill="currentColor" fillOpacity="0.78">
                        <ellipse cx="114" cy="24" rx="4.2" ry="7.2" transform="rotate(38 114 24)" />
                        <ellipse cx="122" cy="37" rx="4.2" ry="7.5" transform="rotate(24 122 37)" />
                        <ellipse cx="126" cy="52" rx="4.2" ry="7.5" transform="rotate(8 126 52)" />
                        <ellipse cx="125" cy="67" rx="4.2" ry="7.5" transform="rotate(-10 125 67)" />
                        <ellipse cx="120" cy="82" rx="4.2" ry="7.2" transform="rotate(-28 120 82)" />
                        <ellipse cx="111" cy="95" rx="4" ry="6.8" transform="rotate(-44 111 95)" />
                        <ellipse cx="100" cy="105" rx="3.8" ry="6.2" transform="rotate(-58 100 105)" />
                    </g>

                    {/* Crossed laurel stems */}
                    <path
                        d="M46 112L80 124M94 112L60 124"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeOpacity="0.6"
                    />

                    {/* Bottom 3-star arc */}
                    <path
                        d="M53 114L54.6 117.6L58.5 118.1L55.6 120.8L56.4 124.7L53 122.8L49.6 124.7L50.4 120.8L47.5 118.1L51.4 117.6L53 114Z"
                        fill="currentColor"
                        fillOpacity="0.85"
                    />
                    <path
                        d="M70 116L72.2 120.8L77.5 121.5L73.6 125.1L74.6 130.3L70 127.8L65.4 130.3L66.4 125.1L62.5 121.5L67.8 120.8L70 116Z"
                        fill="currentColor"
                    />
                    <path
                        d="M87 114L88.6 117.6L92.5 118.1L89.6 120.8L90.4 124.7L87 122.8L83.6 124.7L84.4 120.8L81.5 118.1L85.4 117.6L87 114Z"
                        fill="currentColor"
                        fillOpacity="0.85"
                    />
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
        <div className={`achievement-medal achievement-medal--${size}`}>
            <OrnamentSvg ornament={ornament} iconColor={iconColor} />

            {/* Circular/oval Steam-style inner medal */}
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
