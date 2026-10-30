package fr.openbook.scraper.service;

import fr.openbook.scraper.config.ScraperProperties;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "scraper.enabled", havingValue = "true", matchIfMissing = true)
public class ScraperScheduler {

    private final ScraperEngineService engineService;
    private final ScraperProperties properties;

    @PostConstruct
    public void onStartup() {
        if (properties.isScrapeOnStartup()) {
            log.info("Startup scan requested via scraper.scrape-on-startup=true. Triggering initial scrape...");
            engineService.triggerScrape(null, false);
        } else {
            log.info("Scraper startup scan disabled (scraper.scrape-on-startup=false). Scheduled cron: {}",
                    properties.getScheduleCron());
        }
    }

    /**
     * Daily scheduled crawl at 03:00 AM (configured via scraper.schedule-cron).
     */
    @Scheduled(cron = "${scraper.schedule-cron:0 0 3 * * *}")
    public void executeDailyScheduledScrape() {
        log.info("Executing daily scheduled crawl for all active sources...");
        engineService.triggerScrape(null, false);
    }
}
