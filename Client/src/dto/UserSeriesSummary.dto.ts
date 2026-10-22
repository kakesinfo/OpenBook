import BookSummaryDTO from "./BookSummary.dto.ts";

export default interface UserSeriesSummaryDTO {
    id: number;
    name: string;
    category?: string;
    coverUrl?: string;
    totalVolumes: number;
    ownedCount: number;
    books: BookSummaryDTO[];
}
