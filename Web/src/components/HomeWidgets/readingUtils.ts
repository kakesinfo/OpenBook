import ReadingSessionDTO from "../../dto/ReadingSession.dto.ts";

/**
 * Formats a Date into a YYYY-MM-DD local day key.
 */
export function toLocalDayKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

/**
 * Formats a Date into a YYYY-MM local month key.
 */
export function toLocalMonthKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
}

/**
 * Calculates the current consecutive reading streak in days (matching Mobile's ReadingStreakCard).
 */
export function calculateReadingStreak(sessions: ReadingSessionDTO[]): number {
    if (!sessions || sessions.length === 0) return 0;

    const readDays = new Set<string>();
    for (const s of sessions) {
        if (!s.createdAt) continue;
        readDays.add(toLocalDayKey(new Date(s.createdAt)));
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let checkDate = new Date(today);
    let streak = 0;

    if (readDays.has(toLocalDayKey(checkDate))) {
        while (readDays.has(toLocalDayKey(checkDate))) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        }
        return streak;
    }

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (readDays.has(toLocalDayKey(yesterday))) {
        checkDate = yesterday;
        while (readDays.has(toLocalDayKey(checkDate))) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        }
        return streak;
    }

    return 0;
}

/**
 * Computes total seconds for a reading session.
 */
export function getSessionTotalSeconds(session: ReadingSessionDTO): number {
    return (session.minutesRead || 0) * 60 + (session.secondsRead || 0);
}

/**
 * Formats a duration in seconds as a concise human-readable string (e.g. "1h 25m" or "12m 30s").
 */
export function formatDurationSeconds(totalSeconds: number): string {
    const safe = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const seconds = safe % 60;

    if (hours > 0) {
        return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
    if (minutes > 0) {
        return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
    }
    return `${seconds}s`;
}
