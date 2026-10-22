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
}
