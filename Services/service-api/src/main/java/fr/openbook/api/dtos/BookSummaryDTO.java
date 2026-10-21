package fr.openbook.api.dtos;

import lombok.Data;

@Data
public class BookSummaryDTO {
    private Long id;
    private String title;
    private Integer volume;
    private Integer price;
    private String releaseDate;
    private String coverUrl;
    private String category;
    private String type;
}
