package fr.openbook.scraper.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScrapedBookDTO {
    private String title;

    @JsonProperty("series_name")
    private String seriesName;

    @JsonProperty("series_qualifier")
    private String seriesQualifier;

    private Integer volume;

    private String isbn;

    @JsonProperty("editor_name")
    private String editorName;

    @JsonProperty("collection_name")
    private String collectionName;

    @JsonProperty("category_name")
    private String categoryName;

    @JsonProperty("page_count")
    private Integer pageCount;

    private Integer price;

    private String description;

    @JsonProperty("cover_url")
    private String coverUrl;

    @JsonProperty("release_date")
    private LocalDate releaseDate;

    @JsonProperty("book_type")
    private String bookType;

    @JsonProperty("origin_country")
    private String originCountry;

    @Builder.Default
    private List<ScrapedAuthorDTO> authors = new ArrayList<>();

    @JsonProperty("source_url")
    private String sourceUrl;

    @JsonProperty("parent_book_id")
    private Long parentBookId;

    @JsonProperty("is_variant")
    private boolean isVariant;
}
