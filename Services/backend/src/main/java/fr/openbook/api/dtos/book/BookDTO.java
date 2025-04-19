package fr.openbook.api.dtos.book;

import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class BookDTO extends BookSummaryDTO {
    private String isbn;
    private Integer pageCount;
    private Integer weight;
    private Integer height;
    private Integer length;
    private Integer thickness;
    private String description;
}
