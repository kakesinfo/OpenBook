export default interface BookSummaryDTO {
    id: string;
    title: string;
    volume: number;
    price: number;
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
    readingStatus?: string;
    parentBookId?: number | null;
}
