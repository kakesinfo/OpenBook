package fr.openbook.api.importing.job;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ImportJob {
    @JsonProperty("id")
    private String id;

    @JsonProperty("user_id")
    private Long userId;

    @JsonProperty("status")
    private String status; // "pending", "processing", "completed", "failed"

    @JsonProperty("total_books")
    private int totalBooks = 0;

    @JsonProperty("processed_books")
    private int processedBooks = 0;

    @JsonProperty("created_books")
    private int createdBooks = 0;

    @JsonProperty("updated_books")
    private int updatedBooks = 0;

    @JsonProperty("imported_purchases")
    private int importedPurchases = 0;

    @JsonProperty("imported_reading_sessions")
    private int importedReadingSessions = 0;

    @JsonProperty("current_step")
    private String currentStep;

    @JsonProperty("errors")
    private List<String> errors = new ArrayList<>();

    @JsonProperty("started_at")
    private Instant startedAt;

    @JsonProperty("finished_at")
    private Instant finishedAt;
}
