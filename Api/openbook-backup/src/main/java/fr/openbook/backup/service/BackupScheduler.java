package fr.openbook.backup.service;

import fr.openbook.api.services.ConfigurationService;
import fr.openbook.api.services.ConfigurationUpdatedEvent;
import fr.openbook.backup.config.BackupProperties;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.scheduling.support.CronTrigger;
import org.springframework.stereotype.Component;

import java.util.concurrent.ScheduledFuture;

@Slf4j
@Component
@RequiredArgsConstructor
public class BackupScheduler {

    private final BackupService backupService;
    private final BackupProperties backupProperties;
    private final ConfigurationService configurationService;

    private ThreadPoolTaskScheduler taskScheduler;
    private ScheduledFuture<?> scheduledFuture;

    @PostConstruct
    public void onStartup() {
        taskScheduler = new ThreadPoolTaskScheduler();
        taskScheduler.setPoolSize(1);
        taskScheduler.setThreadNamePrefix("backup-cron-");
        taskScheduler.initialize();

        String cron = configurationService.getValue(
                ConfigurationService.KEY_BACKUP_SCHEDULE_CRON,
                backupProperties.getScheduleCron()
        );
        backupProperties.setScheduleCron(cron);
        scheduleBackupTask(cron);
    }

    @PreDestroy
    public void onShutdown() {
        if (scheduledFuture != null) {
            scheduledFuture.cancel(false);
        }
        if (taskScheduler != null) {
            taskScheduler.shutdown();
        }
    }

    @EventListener
    public void onConfigurationUpdated(ConfigurationUpdatedEvent event) {
        if (ConfigurationService.KEY_BACKUP_SCHEDULE_CRON.equalsIgnoreCase(event.getKey())) {
            String newCron = event.getValue();
            backupProperties.setScheduleCron(newCron);
            log.info("[Backup] Configuration {} updated. Rescheduling backup with new CRON: {}",
                    event.getKey(), newCron);
            scheduleBackupTask(newCron);
        }
    }

    public synchronized void scheduleBackupTask(String cronExpression) {
        if (scheduledFuture != null) {
            scheduledFuture.cancel(false);
            scheduledFuture = null;
        }
        if (cronExpression == null || cronExpression.isBlank() || "-".equals(cronExpression.trim())) {
            log.info("[Backup] Scheduled automatic backup is disabled (cron='{}').", cronExpression);
            return;
        }
        try {
            CronTrigger trigger = new CronTrigger(cronExpression.trim());
            scheduledFuture = taskScheduler.schedule(this::executeScheduledBackup, trigger);
            log.info("[Backup] Scheduled automatic backup with CRON: {}", cronExpression);
        } catch (Exception e) {
            log.error("[Backup] Invalid CRON expression '{}', could not schedule automatic backup: {}",
                    cronExpression, e.getMessage());
        }
    }

    public void executeScheduledBackup() {
        log.info("[Backup] Running scheduled backup (cron: {})...", backupProperties.getScheduleCron());
        try {
            backupService.createBackup();
        } catch (Exception ex) {
            log.error("[Backup] Scheduled backup failed: {}", ex.getMessage(), ex);
        }
    }
}
