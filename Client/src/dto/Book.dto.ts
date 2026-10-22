import BookSummaryDTO from "./BookSummary.dto.ts";
import SeriesDTO from "./Series.dto.ts";

export interface AuthorSummaryDTO {
    firstname: string;
    lastname: string;
    type: string;
}

export default interface BookDTO {
    id: string;
    title: string;
    isbn: string;
    volume: number;
    pageCount: number;
    weight: number;
    height: number;
    length: number;
    thickness: number;
    price: number;
    type?: string;
    themes?: string[];
    description: string;
    coverUrl: string;
    releaseDate: string;
    status: string;
    series: SeriesDTO;
    authors?: AuthorSummaryDTO[];
    previousBookId?: string | number | null;
    nextBookId?: string | number | null;
    previousBook?: BookSummaryDTO | null;
    nextBook?: BookSummaryDTO | null;
}
