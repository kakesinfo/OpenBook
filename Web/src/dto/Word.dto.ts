import BookSummaryDTO from "./BookSummary.dto.ts";

export default interface WordDTO {
    id: number;
    word: string;
    definition: string;
    books?: BookSummaryDTO[];
    createdAt?: string;
    updatedAt?: string;
}

export interface CreateWordRequest {
    word: string;
    definition: string;
    bookIds?: number[];
}

export interface UpdateWordRequest {
    word: string;
    definition: string;
    bookIds?: number[];
}
