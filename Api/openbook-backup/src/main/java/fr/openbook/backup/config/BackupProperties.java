package fr.openbook.backup.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "backup")
public class BackupProperties {

    /**
     * Directory on disk where backup archives (.zip) are stored.
     */
    private String directory = "/data/backups";

    /**
     * Cron expression for automated scheduled backups.
     * Default: every day at 04:00 AM (0 0 4 * * *).
     */
    private String scheduleCron = "0 0 4 * * *";

    /**
     * Whether scheduled backup is enabled.
     */
    private boolean scheduleEnabled = false;

    /**
     * Maximum number of old backup files to keep (0 = keep all).
     */
    private int retentionCount = 10;
}
