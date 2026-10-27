package fr.openbook.api.dtos;

import lombok.Data;

import java.util.List;

@Data
public class CreateBookDTO {
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
    private String seriesName;
    private String editorName;
    private String collectionName;
    private String coverUrl;
    private List<BookHasAuthorDTO> authors;
    private Boolean addToLibrary;
}
