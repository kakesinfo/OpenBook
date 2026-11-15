import BookSummaryDTO from "./BookSummary.dto.ts";

export default interface EditorDTO {
    id: number;
    name: string;
    isFollowed?: boolean;
    booksCount?: number;
    books?: BookSummaryDTO[];
}
