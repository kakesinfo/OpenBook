export default interface ReadingSessionDTO {
    id?: number;
    bookId: number;
    currentPage: number;
    minutesRead: number;
    secondsRead: number;
    sessionType: number; // 0 = start, 1 = progress, 2 = end
    isCommon?: boolean; // true si la lecture (session de début, type 0) est commune
    createdAt: number; // epoch milliseconds
}
