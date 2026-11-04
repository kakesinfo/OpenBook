package fr.openbook.backup.model;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class BackupMetadata {
    private String filename;
    private long sizeBytes;
    private Instant createdAt;
    private int imageCount;
    private long databaseSizeBytes;
    private String openbookVersion;
}
