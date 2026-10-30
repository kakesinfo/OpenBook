import BookSummaryDTO from "./BookSummary.dto.ts";

export default interface CollectionPageDTO {
    content: BookSummaryDTO[];
    totalElements: number;
    totalPages: number;
    page: number;
    size: number;
    statusCounts?: {
        all?: number;
        toread?: number;
        read?: number;
        abandoned?: number;
        [key: string]: number | undefined;
    };
    totalOwned?: number;
}
