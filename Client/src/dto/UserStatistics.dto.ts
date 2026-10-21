export interface CategoryStatDTO {
    name: string;
    count: number;
    percentage: number;
    color: string;
}

export interface CountryStatDTO {
    code: string;
    name: string;
    flag: string;
    count: number;
    percentage: number;
}

export interface AuthorHighlightDTO {
    name: string;
    bookCount: number;
    role: string;
}

export interface BookHighlightDTO {
    id: number;
    title: string;
    releaseDate: string;
    coverUrl: string;
    category?: string;
}

export default interface UserStatisticsDTO {
    totalOwnedBooks: number;
    totalWishlistBooks: number;
    totalPages: number;
    totalHeightMeters: number;
    totalWeightKg: number;
    totalEstimatedValue: number;

    heightComparison: string;
    weightComparison: string;

    categoryBreakdown: CategoryStatDTO[];
    totalCountriesCount: number;
    countries: CountryStatDTO[];

    topAuthor?: AuthorHighlightDTO;
    oldestBook?: BookHighlightDTO;
    newestBook?: BookHighlightDTO;
    topPublisher?: string;
}
