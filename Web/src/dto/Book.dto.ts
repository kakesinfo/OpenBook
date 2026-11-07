import BookSummaryDTO from "./BookSummary.dto.ts";
import SeriesDTO from "./Series.dto.ts";
import EditorDTO from "./Editor.dto.ts";
import CollectionDTO from "./Collection.dto.ts";

export interface AuthorSummaryDTO {
    id?: number;
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
    readingStatus?: string | null;
    series: SeriesDTO;
    editor?: EditorDTO | null;
    collection?: CollectionDTO | null;
    authors?: AuthorSummaryDTO[];
    previousBookId?: string | number | null;
    nextBookId?: string | number | null;
    previousBook?: BookSummaryDTO | null;
    nextBook?: BookSummaryDTO | null;
}
