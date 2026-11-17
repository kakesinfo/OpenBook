package fr.openbook.api.dtos;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
public class UserRetrospectiveDTO {
    private int year;
    private List<Integer> availableYears = new ArrayList<>();

    // 1. Nombre de livres lus sur l'année
    private int booksReadCount;

    // 2. Nombre de pages lues dans l'année
    private int pagesReadCount;

    // 3. Le plus gros livre de l'année
    private RetrospectiveBookDTO thickestBook;

    // 4. Temps passé à lire (en secondes)
    private long totalReadingSeconds;

    // 5. Livre lu le plus longtemps
    private RetrospectiveBookDTO longestReadBook;

    // 6. Le mois avec le plus de livres
    private BestMonthDTO bestMonth;

    // 7. Catégorie de livre la plus lue
    private TopStatDTO topCategory;

    // 8. L'auteur le plus lu
    private TopStatDTO topAuthor;

    // 9. L'éditeur le plus lu
    private TopStatDTO topPublisher;

    // 10. Le prix total des livres achetés
    private double totalSpentAmount;
    private int boughtBooksCount;

    // 11. Le livre le plus cher
    private RetrospectiveBookDTO mostExpensiveBook;

    // 12. Le livre le plus rapide en moyenne (pages/heure)
    private RetrospectiveBookDTO fastestBook;

    // 13. Le livre le plus lent en moyenne (pages/heure)
    private RetrospectiveBookDTO slowestBook;

    // 14. Plus longue série de lecture dans l'année
    private int longestStreakDays;
    private String longestStreakStart;
    private String longestStreakEnd;

    // 15. Nombre de jours de lecture dans l'année
    private int readingDaysCount;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RetrospectiveBookDTO {
        private Long id;
        private String title;
        private String author;
        private String coverUrl;
        private Integer pageCount;
        private Double price;
        private Long readingSeconds;
        private Integer sessionsCount;
        private Double pagesPerHour;
        private Integer pagesRead;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BestMonthDTO {
        private int month; // 1..12
        private String monthName;
        private int booksCount;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TopStatDTO {
        private String name;
        private int count;
        private double percentage;
    }
}
