package fr.openbook.backup.model;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class RestoreResult {
    private String filename;
    private boolean success;
    private String message;
    private Instant restoredAt;
    private int restoredImagesCount;
    private long databaseSizeBytes;
    private long durationMs;
}
