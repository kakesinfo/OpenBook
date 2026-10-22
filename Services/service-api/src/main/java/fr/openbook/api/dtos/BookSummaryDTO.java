package fr.openbook.api.dtos;

import lombok.Data;

@Data
public class BookSummaryDTO {
    private Long id;
    private String title;
    private Integer volume;
    private Integer price;
    private String releaseDate;
    private String createdAt;
    private String coverUrl;
    private String category;
    private String type;
    private String author;
    private String seriesName;
    private Integer pageCount;
    private String status;
    private String readingStatus;
}
