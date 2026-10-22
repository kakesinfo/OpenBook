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
    seriesId?: number;
    seriesName?: string;
    seriesTotalVolumes?: number;
    seriesCoverUrl?: string;
    readingStatus?: string;
}
