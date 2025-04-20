package fr.openbook.api.dtos;

import lombok.Data;
import lombok.EqualsAndHashCode;

import java.util.ArrayList;
import java.util.List;

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

    private SeriesDTO series;
    private EditorDTO editor;
    private CollectionDTO collection;

    private List<BookHasAuthorDTO> authors = new ArrayList<>();
}
