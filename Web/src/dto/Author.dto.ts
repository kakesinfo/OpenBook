import BookSummaryDTO from "./BookSummary.dto.ts";

export default interface AuthorDTO {
    id: number;
    firstname: string;
    lastname: string;
    isFollowed?: boolean;
    booksCount?: number;
    books?: BookSummaryDTO[];
}
