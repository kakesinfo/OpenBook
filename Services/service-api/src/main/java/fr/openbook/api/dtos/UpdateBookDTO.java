package fr.openbook.api.dtos;

import lombok.Data;

import java.util.List;

@Data
public class UpdateBookDTO {
    private String title;
    private String isbn;
    private Integer volume;
    private Integer pageCount;
    private Integer weight;
    private Integer height;
    private Integer length;
    private Integer thickness;
    private Integer price;
    private String description;
    private String type;
    private String releaseDate;
    private Long seriesId;
    private Boolean clearSeries;
    private String editorName;
    private String collectionName;
    private List<BookHasAuthorDTO> authors;
}
