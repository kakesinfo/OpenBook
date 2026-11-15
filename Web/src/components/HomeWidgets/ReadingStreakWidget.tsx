import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFire, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import ReadingSessionDTO from "../../dto/ReadingSession.dto.ts";
import useLanguage from "../../hooks/UseLanguage.tsx";
import {
    calculateReadingStreak,
    formatDurationSeconds,
    getSessionTotalSeconds,
    toLocalDayKey
} from "./readingUtils.ts";

interface ReadingStreakWidgetProps {
    sessions: ReadingSessionDTO[];
    loading?: boolean;
    onOpenCalendar?: () => void;
}

export default function ReadingStreakWidget({
    sessions,
    loading = false,
    onOpenCalendar
}: ReadingStreakWidgetProps) {
    const { tr, language } = useLanguage();

    const streak = calculateReadingStreak(sessions);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    // Monday = 0, Sunday = 6
    const jsDay = today.getDay();
    const todayIndex = jsDay === 0 ? 6 : jsDay - 1;
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - todayIndex);

    const activeDayIndices = new Set<number>();
    let weekSeconds = 0;
    let weekSessions = 0;

    const weekDayKeys: string[] = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        weekDayKeys.push(toLocalDayKey(d));
    }

    for (const s of sessions) {
        if (!s.createdAt) continue;
        const key = toLocalDayKey(new Date(s.createdAt));
        const idx = weekDayKeys.indexOf(key);
        if (idx !== -1) {
            activeDayIndices.add(idx);
            weekSeconds += getSessionTotalSeconds(s);
            weekSessions++;
        }
    }

    const dayLabels = language === "fr"
        ? ["L", "M", "M", "J", "V", "S", "D"]
        : ["M", "T", "W", "T", "F", "S", "S"];

    const streakLabel = language === "fr"
        ? `${streak} jour${streak > 1 ? "s" : ""}`
        : `${streak} day${streak !== 1 ? "s" : ""}`;

    return (
        <div
            className={`home-widget home-streak-widget ${onOpenCalendar ? "is-clickable" : ""}`}
            onClick={onOpenCalendar}
            role={onOpenCalendar ? "button" : undefined}
            tabIndex={onOpenCalendar ? 0 : undefined}
            onKeyDown={onOpenCalendar ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpenCalendar();
                }
            } : undefined}
        >
            <div className="home-streak-widget__header">
                <div className="home-streak-widget__title-group">
                    <div className={`home-streak-widget__icon ${streak > 0 ? "is-active" : ""}`}>
                        <FontAwesomeIcon icon={faFire} />
                    </div>
                    <div className="home-streak-widget__text">
                        <div className="home-streak-widget__title-row">
                            <h3 className="home-streak-widget__title">
                                {tr("Reading streak", "Série de lecture")}
                            </h3>
                            <span className={`home-streak-widget__count ${streak > 0 ? "is-active" : ""}`}>
                                {loading ? tr("Calculating...", "Calcul...") : streakLabel}
                            </span>
                        </div>
                        {!loading && weekSessions > 0 && (
                            <span className="home-streak-widget__week-summary">
                                {tr("This week:", "Cette semaine :")} {formatDurationSeconds(weekSeconds)}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="home-streak-widget__right">
                <div className="home-streak-widget__week">
                    {dayLabels.map((label, idx) => {
                        const hasRead = activeDayIndices.has(idx);
                        const isToday = idx === todayIndex;
                        return (
                            <div key={idx} className="home-streak-widget__day">
                                <span className={`home-streak-widget__day-label ${isToday ? "is-today" : ""}`}>
                                    {label}
                                </span>
                                <div
                                    className={`home-streak-widget__day-circle ${hasRead ? "is-active" : ""} ${isToday ? "is-today" : ""}`}
                                >
                                    {hasRead ? (
                                        <FontAwesomeIcon icon={faFire} />
                                    ) : (
                                        <span className="home-streak-widget__day-dot" />
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
                {onOpenCalendar && (
                    <FontAwesomeIcon icon={faChevronRight} className="home-streak-widget__chevron" />
                )}
            </div>
        </div>
    );
}
