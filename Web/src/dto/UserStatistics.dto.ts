export interface CategoryStatDTO {
    name: string;
    count: number;
    percentage: number;
    color: string;
}

export interface AuthorHighlightDTO {
    id?: number;
    name: string;
    bookCount: number;
    role: string;
    percentage?: number;
}

export interface PublisherStatDTO {
    name: string;
    count: number;
    percentage: number;
}

export interface DecadeStatDTO {
    decade: string;
    count: number;
    percentage: number;
}

export interface BookHighlightDTO {
    id: number;
    title: string;
    releaseDate: string;
    coverUrl: string;
    category?: string;
    pageCount?: number;
    price?: number;
    highlightValue?: string;
}

export default interface UserStatisticsDTO {
    // Totals
    totalOwnedBooks: number;
    totalWishlistBooks: number;
    totalSeriesCount: number;
    completedSeriesCount: number;
    totalPages: number;
    totalHeightMeters: number;
    totalWeightKg: number;
    totalEstimatedValue: number;
    averagePrice: number;
    averagePagesPerBook: number;

    // Reading Status breakdown
    booksReadCount: number;
    booksReadingCount: number;
    booksToReadCount: number;
    booksUnreadCount: number;
    booksAbandonedCount: number;
    readingProgressPercentage: number;
    totalLoggedReadingMinutes: number;
    totalReadingSessionsCount: number;

    // Fun comparisons (deprecated, no longer displayed)
    heightComparison?: string;
    weightComparison?: string;

    // Breakdown
    categoryBreakdown: CategoryStatDTO[];
    // Authors & Publishers
    topAuthor?: AuthorHighlightDTO;
    topAuthors?: AuthorHighlightDTO[];
    topPublisher?: string;
    topPublishers?: PublisherStatDTO[];

    // Publication eras
    publicationDecades?: DecadeStatDTO[];

    // Highlights / Records
    oldestBook?: BookHighlightDTO;
    newestBook?: BookHighlightDTO;
    thickestBook?: BookHighlightDTO;
    mostValuableBook?: BookHighlightDTO;
}
