export default interface BookSummaryDTO {
    id: string;
    title: string;
    isbn?: string;
    volume: number;
    price: number;
    listingUrl?: string | null;
    releaseDate: string;
    createdAt?: string;
    coverUrl: string;
    category?: string;
    type?: string;
    author?: string;
    status?: string | null;
    seriesId?: number;
    seriesName?: string;
    seriesTotalVolumes?: number;
    seriesCoverUrl?: string;
    editorName?: string;
    pageCount?: number;
    readingStatus?: string;
    finishedAt?: number | null;
    readingCycleId?: number;
    loanType?: "BORROWED" | "LENT" | string | null;
    loanPerson?: string | null;
    loanDate?: string | null;
    loanDueDate?: string | null;
    loanMemo?: string | null;
}
