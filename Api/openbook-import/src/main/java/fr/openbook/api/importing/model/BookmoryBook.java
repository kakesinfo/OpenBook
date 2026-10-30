package fr.openbook.api.importing.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class BookmoryBook {
    @JsonProperty("key")
    private String key;

    @JsonProperty("title")
    private String title;

    @JsonProperty("author")
    private String author;

    @JsonProperty("authors")
    private List<String> authors = new ArrayList<>();

    @JsonProperty("illustrators")
    private List<String> illustrators = new ArrayList<>();

    @JsonProperty("publisher")
    private String publisher;

    @JsonProperty("isbn")
    private String isbn;

    @JsonProperty("publication_date")
    private String publicationDate;

    @JsonProperty("description")
    private String description;

    @JsonProperty("tags")
    private String tags;

    @JsonProperty("page_type")
    private String pageType;

    @JsonProperty("total_page")
    private Double totalPage = 0.0;

    @JsonProperty("real_total_page")
    private Double realTotalPage = 0.0;

    @JsonProperty("cur_page")
    private Double curPage = 0.0;

    @JsonProperty("wishlist")
    private Boolean wishlist = false;

    @JsonProperty("series_key")
    private String seriesKey;

    @JsonProperty("series_number")
    private Integer seriesNumber = 0;

    @JsonProperty("series_number_decimal")
    private Double seriesNumberDecimal = 0.0;

    @JsonProperty("collection_keys")
    private List<Object> collectionKeys = new ArrayList<>();

    @JsonProperty("image")
    private String image;

    @JsonProperty("purchases")
    private List<BookmoryPurchase> purchases = new ArrayList<>();

    @JsonProperty("reads")
    private List<BookmoryRead> reads = new ArrayList<>();

    @JsonProperty("status_list")
    private List<String> statusList = new ArrayList<>();

    @JsonProperty("created_at")
    private Long createdAt;

    @JsonProperty("updated_at")
    private Long updatedAt;

    @JsonProperty("first_read_start_date")
    private Long firstReadStartDate;

    @JsonProperty("last_read_done_date")
    private Long lastReadDoneDate;
}
