package fr.openbook.api.importing.model;

import lombok.Data;

import java.time.Instant;

@Data
public class ExistingBook {
    private Long id;
    private String title;
    private String isbn;
    private Integer volume = 0;
    private Integer pageCount = 0;
    private Integer price = 0;
    private String description;
    private String coverUrl;
    private Instant releaseDate;
    private Long editorId;
    private Long seriesId;
    private Long collectionId;
    private String type;
}
