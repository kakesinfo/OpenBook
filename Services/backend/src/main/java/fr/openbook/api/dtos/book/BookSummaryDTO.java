package fr.openbook.api.dtos.book;

import lombok.Data;
import lombok.Getter;
import lombok.Setter;

@Data
public class BookSummaryDTO {
    private Long id;
    private String title;
    private Integer volume;
    private Integer price;
    private String releaseDate;
}
