export default interface ReadingSessionDTO {
    id?: number;
    bookId: number;
    currentPage: number;
    minutesRead: number;
    secondsRead: number;
    sessionType: number; // 0 = start, 1 = progress, 2 = end
    createdAt: number; // epoch milliseconds
}
