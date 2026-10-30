package fr.openbook.scraper.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScraperStatusDTO {
    @JsonProperty("is_running")
    private boolean isRunning;

    @JsonProperty("job_name")
    private String jobName;

    @JsonProperty("current_source")
    private String currentSource;

    @JsonProperty("current_source_name")
    private String currentSourceName;

    @JsonProperty("current_source_color")
    private String currentSourceColor;

    @JsonProperty("total_found")
    private int totalFound;

    @JsonProperty("total_saved")
    private int totalSaved;

    @JsonProperty("recent_books")
    @Builder.Default
    private List<Map<String, Object>> recentBooks = new ArrayList<>();

    @JsonProperty("started_at")
    private Instant startedAt;

    @JsonProperty("ended_at")
    private Instant endedAt;

    @JsonProperty("last_error")
    private String lastError;

    @Builder.Default
    private List<Map<String, Object>> history = new ArrayList<>();

    @JsonProperty("scheduler_running")
    private boolean schedulerRunning;

    @JsonProperty("last_status")
    private String lastStatus;

    @JsonProperty("connected")
    private boolean connected;
}
