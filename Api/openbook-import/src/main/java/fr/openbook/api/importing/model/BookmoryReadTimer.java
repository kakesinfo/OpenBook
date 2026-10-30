package fr.openbook.api.importing.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class BookmoryReadTimer {
    @JsonProperty("read_started_at")
    private Long readStartedAt;

    @JsonProperty("elapsed_sec")
    private Integer elapsedSec;

    @JsonProperty("created_at")
    private Long createdAt;

    @JsonProperty("updated_at")
    private Long updatedAt;
}
