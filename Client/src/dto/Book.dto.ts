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
    description: string;
    coverUrl: string;
    releaseDate: string;
    status: string;
    series: SeriesDTO;
    authors?: AuthorSummaryDTO[];
}
