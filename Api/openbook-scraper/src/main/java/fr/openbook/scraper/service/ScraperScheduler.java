package fr.openbook.scraper.service;

import fr.openbook.api.services.AuditLogService;
import fr.openbook.api.services.ConfigurationService;
import fr.openbook.api.services.ConfigurationUpdatedEvent;
import fr.openbook.scraper.config.ScraperProperties;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.scheduling.support.CronTrigger;
import org.springframework.stereotype.Component;

import java.util.concurrent.ScheduledFuture;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "scraper.enabled", havingValue = "true", matchIfMissing = true)
public class ScraperScheduler {

    private final ScraperEngineService engineService;
    private final ScraperProperties properties;
    private final ConfigurationService configurationService;

    private ThreadPoolTaskScheduler taskScheduler;
    private ScheduledFuture<?> scheduledFuture;

    @PostConstruct
    public void onStartup() {
        taskScheduler = new ThreadPoolTaskScheduler();
        taskScheduler.setPoolSize(1);
        taskScheduler.setThreadNamePrefix("scraper-cron-");
        taskScheduler.initialize();

        String cron = configurationService.getValue(
                ConfigurationService.KEY_SCRAPER_SCHEDULE_CRON,
                properties.getScheduleCron()
        );
        properties.setScheduleCron(cron);
        scheduleDailyScrape(cron);

        if (properties.isScrapeOnStartup()) {
            log.info("Startup scan requested via scraper.scrape-on-startup=true. Triggering initial scrape...");
            engineService.triggerScrape(null, false);
        } else {
            log.info("Scraper startup scan disabled (scraper.scrape-on-startup=false). Scheduled cron: {}",
                    properties.getScheduleCron());
        }
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
        if (ConfigurationService.KEY_SCRAPER_SCHEDULE_CRON.equalsIgnoreCase(event.getKey())) {
            String newCron = event.getValue();
            properties.setScheduleCron(newCron);
            log.info("[Scraper] Configuration {} updated. Rescheduling scraper with new CRON: {}",
                    event.getKey(), newCron);
            scheduleDailyScrape(newCron);
        }
    }

    public synchronized void scheduleDailyScrape(String cronExpression) {
        if (scheduledFuture != null) {
            scheduledFuture.cancel(false);
            scheduledFuture = null;
        }
        if (cronExpression == null || cronExpression.isBlank() || "-".equals(cronExpression.trim())) {
            log.info("[Scraper] Scheduled automatic scrape is disabled (cron='{}').", cronExpression);
            return;
        }
        try {
            CronTrigger trigger = new CronTrigger(cronExpression.trim());
            scheduledFuture = taskScheduler.schedule(this::executeDailyScheduledScrape, trigger);
            log.info("[Scraper] Scheduled automatic crawl with CRON: {}", cronExpression);
        } catch (Exception e) {
            log.error("[Scraper] Invalid CRON expression '{}', could not schedule automatic crawl: {}",
                    cronExpression, e.getMessage());
        }
    }

    /**
     * Scheduled crawl (configured dynamically via SCRAPER_SCHEDULE_CRON in database).
     */
    public void executeDailyScheduledScrape() {
        log.info("Executing scheduled crawl (cron: {}) for all active sources...", properties.getScheduleCron());
        engineService.triggerScrape(null, false, AuditLogService.ACTOR_CRON);
    }
}
