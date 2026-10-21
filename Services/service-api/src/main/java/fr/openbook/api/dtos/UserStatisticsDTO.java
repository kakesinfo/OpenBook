package fr.openbook.api.dtos;

import fr.openbook.api.dtos.stats.AuthorHighlightDTO;
import fr.openbook.api.dtos.stats.BookHighlightDTO;
import fr.openbook.api.dtos.stats.CategoryStatDTO;
import fr.openbook.api.dtos.stats.CountryStatDTO;
import lombok.Data;

import java.util.List;

@Data
public class UserStatisticsDTO {
    // Totals
    private int totalOwnedBooks;
    private int totalWishlistBooks;
    private int totalPages;
    private double totalHeightMeters;
    private double totalWeightKg;
    private int totalEstimatedValue;

    // Fun comparisons
    private String heightComparison;
    private String weightComparison;

    // Breakdown for Pie Chart
    private List<CategoryStatDTO> categoryBreakdown;

    // World Map & Countries
    private int totalCountriesCount;
    private List<CountryStatDTO> countries;

    // Highlights
    private AuthorHighlightDTO topAuthor;
    private BookHighlightDTO oldestBook;
    private BookHighlightDTO newestBook;
    private String topPublisher;
}
