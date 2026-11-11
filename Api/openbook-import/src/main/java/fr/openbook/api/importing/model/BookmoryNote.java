package fr.openbook.api.importing.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class BookmoryNote {
    @JsonProperty("key")
    private String key;

    @JsonProperty("bid")
    private String bid;

    @JsonProperty("page")
    private Double page;

    @JsonProperty("page_end")
    private Double pageEnd;

    @JsonProperty("content_quill")
    private String contentQuill;

    @JsonProperty("content")
    private String content;

    @JsonProperty("type")
    private String type;

    @JsonProperty("created_at")
    private Long createdAt;

    @JsonProperty("updated_at")
    private Long updatedAt;

    private String parsedContent;
}
