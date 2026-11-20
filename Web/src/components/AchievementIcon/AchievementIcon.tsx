import React from "react";

export interface AchievementIconOption {
    id: string;
    label: string;
}

export const ACHIEVEMENT_ICON_OPTIONS: AchievementIconOption[] = [
    { id: "trophy", label: "Coupe légendaire" },
    { id: "crown", label: "Couronne royale" },
    { id: "medal", label: "Médaille d'honneur" },
    { id: "star", label: "Étoile nova" },
    { id: "gem", label: "Diamant taillé" },
    { id: "fire", label: "Flamme éternelle" },
    { id: "bolt", label: "Foudre" },
    { id: "book", label: "Grimoire" },
    { id: "book-open", label: "Livre enchanté" },
    { id: "coffee", label: "Pause lecture" },
    { id: "bookmark", label: "Ruban d'or" },
    { id: "feather", label: "Plume d'écrivain" },
    { id: "glasses", label: "Érudit" },
    { id: "dragon", label: "Dragon" },
    { id: "shield", label: "Écu héroïque" },
    { id: "wand", label: "Arcane" },
    { id: "rocket", label: "Astronef" },
    { id: "compass", label: "Boussole" },
    { id: "flag", label: "Bannière" },
    { id: "heart", label: "Cœur sacré" },
    { id: "award", label: "Laurier" }
];

interface AchievementIconProps {
    icon: string;
    className?: string;
}

export default function AchievementIcon({ icon, className = "" }: AchievementIconProps) {
    const svgProps: React.SVGProps<SVGSVGElement> = {
        viewBox: "0 0 64 64",
        fill: "none",
        xmlns: "http://www.w3.org/2000/svg",
        className: `achievement-svg-icon ${className}`.trim(),
        "aria-hidden": true
    };

    switch (icon) {
        case "crown":
            return (
                <svg {...svgProps}>
                    <path d="M10 44L6 20L20 30L32 14L44 30L58 20L54 44H10Z" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
                    <path d="M12 44H52V51C52 52.1 51.1 53 50 53H14C12.9 53 12 52.1 12 51V44Z" fill="currentColor" stroke="currentColor" strokeWidth="2.5" />
                    <circle cx="32" cy="12" r="3" fill="currentColor" />
                    <circle cx="6" cy="18" r="2.5" fill="currentColor" />
                    <circle cx="58" cy="18" r="2.5" fill="currentColor" />
                    <polygon points="32,26 36,33 32,40 28,33" fill="currentColor" />
                    <circle cx="20" cy="36" r="2.2" fill="currentColor" fillOpacity="0.8" />
                    <circle cx="44" cy="36" r="2.2" fill="currentColor" fillOpacity="0.8" />
                </svg>
            );

        case "medal":
            return (
                <svg {...svgProps}>
                    <path d="M20 6H30L34 20H24L20 6Z" fill="currentColor" fillOpacity="0.35" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
                    <path d="M44 6H34L30 20H40L44 6Z" fill="currentColor" fillOpacity="0.65" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
                    <circle cx="32" cy="39" r="18" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="2.8" />
                    <circle cx="32" cy="39" r="13.5" stroke="currentColor" strokeWidth="1.6" strokeDasharray="3 3" />
                    <path d="M32 28L35.2 34.8L42.6 35.8L37.2 41L38.6 48.3L32 44.8L25.4 48.3L26.8 41L21.4 35.8L28.8 34.8L32 28Z" fill="currentColor" />
                </svg>
            );

        case "star":
            return (
                <svg {...svgProps}>
                    <circle cx="32" cy="32" r="22" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.35" strokeDasharray="4 4" />
                    <path d="M32 8L37.8 23.2L54 24.5L41.5 34.8L45.4 50.6L32 42L18.6 50.6L22.5 34.8L10 24.5L26.2 23.2L32 8Z" fill="currentColor" fillOpacity="0.28" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
                    <path d="M32 17L35.2 26.2L44.5 27L37.3 32.9L39.6 42L32 37L24.4 42L26.7 32.9L19.5 27L28.8 26.2L32 17Z" fill="currentColor" />
                    <circle cx="13" cy="14" r="2" fill="currentColor" />
                    <circle cx="51" cy="14" r="1.8" fill="currentColor" />
                    <circle cx="53" cy="48" r="2" fill="currentColor" />
                </svg>
            );

        case "gem":
            return (
                <svg {...svgProps}>
                    <polygon points="18,12 46,12 56,26 32,54 8,26" fill="currentColor" fillOpacity="0.22" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
                    <polyline points="8,26 56,26" stroke="currentColor" strokeWidth="2.4" />
                    <polyline points="18,12 24,26 32,54 40,26 46,12" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                    <polygon points="24,26 40,26 32,54" fill="currentColor" fillOpacity="0.35" />
                    <polygon points="25,12 39,12 40,26 24,26" fill="currentColor" fillOpacity="0.5" />
                    <path d="M51 9V15M48 12H54" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
            );

        case "fire":
            return (
                <svg {...svgProps}>
                    <path d="M34 8C34 8 49 20 49 35C49 46.5 41.2 55 32 55C22.8 55 15 46.5 15 36C15 28 19.5 21.5 23 18C23 23 26 25 26 25C26 25 25 14 34 8Z" fill="currentColor" fillOpacity="0.28" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
                    <path d="M33 25C33 25 41 32 41 40C41 46.5 36.8 51 32 51C27.2 51 23 46.5 23 40.5C23 35.5 26.5 31.5 28.5 29.5C28.5 32.5 30.5 33.5 30.5 33.5C30.5 33.5 30 28 33 25Z" fill="currentColor" />
                    <circle cx="17" cy="14" r="2" fill="currentColor" fillOpacity="0.8" />
                    <circle cx="48" cy="16" r="1.8" fill="currentColor" fillOpacity="0.8" />
                </svg>
            );

        case "bolt":
            return (
                <svg {...svgProps}>
                    <circle cx="32" cy="32" r="23" stroke="currentColor" strokeWidth="1.8" strokeOpacity="0.3" />
                    <path d="M36 7L15 35H30L26 57L49 27H34L36 7Z" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
                    <path d="M34 15L22 33H32L29 48L43 29H33L34 15Z" fill="currentColor" />
                    <path d="M12 18L16 21M50 43L54 46M51 17L47 20" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
            );

        case "book":
            return (
                <svg {...svgProps}>
                    <path d="M14 10H46C48.8 10 51 12.2 51 15V49C51 51.8 48.8 54 46 54H14C11.8 54 10 52.2 10 50V14C10 11.8 11.8 10 14 10Z" fill="currentColor" fillOpacity="0.22" stroke="currentColor" strokeWidth="2.8" />
                    <path d="M18 10V54" stroke="currentColor" strokeWidth="2.6" />
                    <rect x="25" y="19" width="18" height="14" rx="2" fill="currentColor" fillOpacity="0.45" stroke="currentColor" strokeWidth="2" />
                    <path d="M34 22L35.5 25L38.8 25.5L36.4 27.8L37 31L34 29.4L31 31L31.6 27.8L29.2 25.5L32.5 25L34 22Z" fill="currentColor" />
                    <path d="M25 40H43M25 46H38" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                    <path d="M46 31H53V37H46V31Z" fill="currentColor" />
                </svg>
            );

        case "book-open":
            return (
                <svg {...svgProps}>
                    <path d="M32 22C26 17 16 16 9 18V50C16 48 26 49 32 54C38 49 48 48 55 50V18C48 16 38 17 32 22Z" fill="currentColor" fillOpacity="0.22" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
                    <path d="M32 22V54" stroke="currentColor" strokeWidth="2.6" />
                    <path d="M15 26C19 25 24 25.5 27 27M15 34C19 33 24 33.5 27 35M15 42C19 41 24 41.5 27 43" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M49 26C45 25 40 25.5 37 27M49 34C45 33 40 33.5 37 35M49 42C45 41 40 41.5 37 43" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M32 6V12M23 9L26 14M41 9L38 14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                </svg>
            );

        case "coffee":
            return (
                <svg {...svgProps}>
                    <path d="M23 11C21.5 13.5 24.5 15.5 23 18M32 9C30.5 11.5 33.5 13.5 32 16M41 11C39.5 13.5 42.5 15.5 41 18" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" />
                    <path d="M16 24H44V35C44 42.2 38.2 47 30 47C21.8 47 16 42.2 16 35V24Z" fill="currentColor" fillOpacity="0.28" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
                    <path d="M44 27H49C51.8 27 54 29.2 54 32C54 34.8 51.8 37 49 37H44" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
                    <ellipse cx="30" cy="24" rx="14" ry="3.2" fill="currentColor" fillOpacity="0.45" stroke="currentColor" strokeWidth="2.2" />
                    <path d="M11 49C16 53 44 53 49 49" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
                    <path d="M22 33C23 38 26 41 30 42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.7" />
                </svg>
            );

        case "bookmark":
            return (
                <svg {...svgProps}>
                    <path d="M18 8H46V55L32 45L18 55V8Z" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
                    <path d="M24 14H40V43L32 37L24 43V14Z" fill="currentColor" fillOpacity="0.35" />
                    <path d="M32 18L34.5 23.5L40.5 24.3L36.1 28.4L37.2 34.3L32 31.4L26.8 34.3L27.9 28.4L23.5 24.3L29.5 23.5L32 18Z" fill="currentColor" />
                </svg>
            );

        case "feather":
            return (
                <svg {...svgProps}>
                    <path d="M51 11C37 11 23 22 18 41L12 52L23 46C42 41 53 27 51 11Z" fill="currentColor" fillOpacity="0.28" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
                    <path d="M12 52L43 20" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
                    <path d="M28 35H39M33 29H44M23 41H33" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M11 54H26" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
                </svg>
            );

        case "glasses":
            return (
                <svg {...svgProps}>
                    <circle cx="19" cy="36" r="11" fill="currentColor" fillOpacity="0.22" stroke="currentColor" strokeWidth="2.8" />
                    <circle cx="45" cy="36" r="11" fill="currentColor" fillOpacity="0.22" stroke="currentColor" strokeWidth="2.8" />
                    <path d="M30 35C31 32 33 32 34 35" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
                    <path d="M8 35L13 17C14 14 17 13 19 14M56 35L51 17C50 14 47 13 45 14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
                    <path d="M14 32L18 29M40 32L44 29" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
            );

        case "dragon":
            return (
                <svg {...svgProps}>
                    <path d="M32 10L48 20L44 42L32 54L20 42L16 20L32 10Z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round" />
                    <path d="M23 25L18 16L27 21L32 14L37 21L46 16L41 25L45 34L32 45L19 34L23 25Z" fill="currentColor" fillOpacity="0.45" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
                    <circle cx="27" cy="29" r="2.2" fill="currentColor" />
                    <circle cx="37" cy="29" r="2.2" fill="currentColor" />
                    <path d="M28 37L32 40L36 37" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
            );

        case "shield":
            return (
                <svg {...svgProps}>
                    <path d="M32 8L52 15V31C52 43.5 43.2 52.3 32 56C20.8 52.3 12 43.5 12 31V15L32 8Z" fill="currentColor" fillOpacity="0.24" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
                    <path d="M32 14L46 19V30.5C46 39.8 39.6 46.5 32 49.5C24.4 46.5 18 39.8 18 30.5V19L32 14Z" stroke="currentColor" strokeWidth="1.8" strokeOpacity="0.65" />
                    <path d="M32 20L35.2 26.8L42.5 27.8L37.2 32.8L38.5 40L32 36.5L25.5 40L26.8 32.8L21.5 27.8L28.8 26.8L32 20Z" fill="currentColor" />
                </svg>
            );

        case "wand":
            return (
                <svg {...svgProps}>
                    <path d="M12 52L39 25" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                    <path d="M44 10L47 18L55 21L47 24L44 32L41 24L33 21L41 18L44 10Z" fill="currentColor" fillOpacity="0.85" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    <circle cx="24" cy="18" r="2.2" fill="currentColor" />
                    <circle cx="51" cy="39" r="2.2" fill="currentColor" />
                    <path d="M19 29V34M16.5 31.5H21.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
            );

        case "rocket":
            return (
                <svg {...svgProps}>
                    <path d="M32 8C42 16 46 28 44 41H20C18 28 22 16 32 8Z" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
                    <path d="M20 34L11 42L19 45M44 34L53 42L45 45" fill="currentColor" fillOpacity="0.45" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
                    <circle cx="32" cy="25" r="5" fill="currentColor" />
                    <path d="M26 45L32 57L38 45" fill="currentColor" fillOpacity="0.7" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
                </svg>
            );

        case "compass":
            return (
                <svg {...svgProps}>
                    <circle cx="32" cy="32" r="22" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="2.8" />
                    <circle cx="32" cy="32" r="16" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 3" />
                    <polygon points="32,14 37,29 32,32 27,29" fill="currentColor" />
                    <polygon points="32,50 37,35 32,32 27,35" fill="currentColor" fillOpacity="0.45" stroke="currentColor" strokeWidth="1.6" />
                    <circle cx="32" cy="32" r="3" fill="currentColor" />
                </svg>
            );

        case "flag":
            return (
                <svg {...svgProps}>
                    <path d="M16 10V54" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
                    <path d="M18 12H50L44 23L50 34H18V12Z" fill="currentColor" fillOpacity="0.28" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round" />
                    <path d="M31 17L33 21L37.5 21.6L34.2 24.7L35 29L31 27L27 29L27.8 24.7L24.5 21.6L29 21L31 17Z" fill="currentColor" />
                    <path d="M10 54H24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
            );

        case "heart":
            return (
                <svg {...svgProps}>
                    <path d="M32 52C32 52 10 38.5 10 22.5C10 15.6 15.4 10 22 10C26.3 10 30 12.3 32 15.7C34 12.3 37.7 10 42 10C48.6 10 54 15.6 54 22.5C54 38.5 32 52 32 52Z" fill="currentColor" fillOpacity="0.26" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
                    <polygon points="32,20 38,29 32,41 26,29" fill="currentColor" />
                </svg>
            );

        case "award":
            return (
                <svg {...svgProps}>
                    <path d="M18 44C12 37 11 26 16 17M46 44C52 37 53 26 48 17" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
                    <path d="M13 31H19M14 23H20M45 31H51M44 23H50" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                    <circle cx="32" cy="30" r="11" fill="currentColor" fillOpacity="0.28" stroke="currentColor" strokeWidth="2.6" />
                    <path d="M32 23L34.2 27.6L39.2 28.3L35.6 31.8L36.5 36.8L32 34.4L27.5 36.8L28.4 31.8L24.8 28.3L29.8 27.6L32 23Z" fill="currentColor" />
                    <path d="M24 47L32 53L40 47" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );

        case "trophy":
        default:
            return (
                <svg {...svgProps}>
                    <path d="M19 12H45V27C45 34.7 39.2 41 32 41C24.8 41 19 34.7 19 27V12Z" fill="currentColor" fillOpacity="0.28" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
                    <path d="M19 16H11C11 24 14 28 19 29M45 16H53C53 24 50 28 45 29" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M32 41V49M22 53H42M25 49H39" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
                    <path d="M32 18L34.2 22.8L39.4 23.5L35.6 27.1L36.6 32.2L32 29.8L27.4 32.2L28.4 27.1L24.6 23.5L29.8 22.8L32 18Z" fill="currentColor" />
                </svg>
            );
    }
}
