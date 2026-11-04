package fr.openbook.backup.service;

import fr.openbook.backup.config.BackupProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "backup.schedule-enabled", havingValue = "true")
public class BackupScheduler {

    private final BackupService backupService;
    private final BackupProperties backupProperties;

    @Scheduled(cron = "${backup.schedule-cron:0 0 4 * * *}")
    public void executeScheduledBackup() {
        log.info("[Backup] Running scheduled daily backup (cron: {})...", backupProperties.getScheduleCron());
        try {
            backupService.createBackup();
        } catch (Exception ex) {
            log.error("[Backup] Scheduled backup failed: {}", ex.getMessage(), ex);
        }
    }
}
