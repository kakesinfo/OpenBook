export default interface ReadingSessionDTO {
    id?: number;
    bookId: number;
    readingCycleId?: number;
    currentPage: number;
    minutesRead: number;
    secondsRead: number;
    sessionType: number; // 0 = start, 1 = progress, 2 = end
    isCommon?: boolean; // true si le cycle de lecture associé est commun
    createdAt: number; // epoch milliseconds
}
