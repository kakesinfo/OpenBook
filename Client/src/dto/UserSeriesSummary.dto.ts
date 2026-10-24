import BookSummaryDTO from "./BookSummary.dto.ts";

export default interface UserSeriesSummaryDTO {
    id: number;
    name: string;
    description?: string;
    category?: string;
    categoryId?: number;
    status?: string;
    coverUrl?: string;
    totalVolumes: number;
    ownedCount: number;
    isFollowed?: boolean;
    books: BookSummaryDTO[];
}
