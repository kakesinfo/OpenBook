package fr.openbook.api.importing.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class BookmoryRead {
    @JsonProperty("nth")
    private Integer nth;

    @JsonProperty("start")
    private Long start;

    @JsonProperty("end")
    private Long end;

    @JsonProperty("star")
    private Double star;

    @JsonProperty("comment")
    private String comment;

    @JsonProperty("status")
    private String status; // DONE, PAUSE

    @JsonProperty("page")
    private Double page;

    @JsonProperty("total_page")
    private Double totalPage;

    @JsonProperty("real_total_page")
    private Double realTotalPage;

    @JsonProperty("page_log_list")
    private List<BookmoryPageLog> pageLogList = new ArrayList<>();

    @JsonProperty("read_timer_list")
    private List<BookmoryReadTimer> readTimerList = new ArrayList<>();

    @JsonProperty("created_at")
    private Long createdAt;

    @JsonProperty("updated_at")
    private Long updatedAt;
}
