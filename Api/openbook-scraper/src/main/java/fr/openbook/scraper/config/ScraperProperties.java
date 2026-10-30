package fr.openbook.scraper.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Data
@Configuration
@ConfigurationProperties(prefix = "scraper")
public class ScraperProperties {
    /**
     * Whether the scraper features are enabled.
     */
    private boolean enabled = true;

    /**
     * Whether to trigger a scan immediately at startup. Default is false (user requested).
     */
    private boolean scrapeOnStartup = false;

    /**
     * Cron expression for daily automatic scan. Default: every day at 03:00 AM.
     */
    private String scheduleCron = "0 0 3 * * *";

    /**
     * Maximum books crawled per source in standard (non-full) mode.
     */
    private int maxBooksPerSource = 50;

    /**
     * HTTP request timeout in seconds.
     */
    private int requestTimeout = 30;

    /**
     * User agent used for scraping requests.
     */
    private String userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 YetAnotherLibrary/1.0";
}
