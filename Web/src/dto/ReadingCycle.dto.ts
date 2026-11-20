import ReadingSessionDTO from "./ReadingSession.dto.ts";

export default interface ReadingCycleDTO {
    id: number;
    bookId: number;
    isCommon: boolean;
    startedAt: number; // epoch milliseconds
    endedAt?: number | null; // epoch milliseconds
    sessions?: ReadingSessionDTO[];
}
