package fr.openbook.api.dtos;

import fr.openbook.api.dtos.stats.AuthorHighlightDTO;
import fr.openbook.api.dtos.stats.BookHighlightDTO;
import fr.openbook.api.dtos.stats.CategoryStatDTO;
import fr.openbook.api.dtos.stats.DecadeStatDTO;
import fr.openbook.api.dtos.stats.PublisherStatDTO;
import lombok.Data;

import java.util.List;

@Data
public class UserStatisticsDTO {
    // Available activity years (sorted descending)
    private List<Integer> availableYears;

    // Totals
    private int totalOwnedBooks;
    private int totalWishlistBooks;
    private int totalSeriesCount;
    private int completedSeriesCount;
    private int totalPages;
    private double totalHeightMeters;
    private double totalWeightKg;
    private int totalEstimatedValue;
    private double averagePrice;
    private int averagePagesPerBook;

    // Transactions (Purchases, Gifts, Sales)
    private int totalBoughtCount;
    private double totalBoughtAmount;
    private int totalGiftCount;
    private int totalSoldCount;
    private double totalSoldAmount;
    private double netSpentAmount;

    // Reading Status breakdown
    private int booksReadCount;
    private int booksReadingCount;
    private int booksToReadCount; // Pile à lire (PAL)
    private int booksUnreadCount;
    private int booksAbandonedCount;
    private int booksOnHoldCount;
    private double readingProgressPercentage;
    private int totalLoggedReadingMinutes;
    private int totalReadingSessionsCount;

    // Fun comparisons (kept for backwards compatibility)
    private String heightComparison;
    private String weightComparison;

    // Breakdown for Pie Chart
    private List<CategoryStatDTO> categoryBreakdown;

    // Authors & Publishers
    private AuthorHighlightDTO topAuthor;
    private List<AuthorHighlightDTO> topAuthors;
    private String topPublisher;
    private List<PublisherStatDTO> topPublishers;

    // Publication eras
    private List<DecadeStatDTO> publicationDecades;

    // Highlights / Records
    private BookHighlightDTO oldestBook;
    private BookHighlightDTO newestBook;
    private BookHighlightDTO thickestBook;
    private BookHighlightDTO mostValuableBook;
}
