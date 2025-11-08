import SeriesDTO from "./Series.dto.ts";

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
	
	series: SeriesDTO;
}
