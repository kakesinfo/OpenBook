package fr.openbook.scraper.sources;

import fr.openbook.scraper.model.ScanOptions;
import fr.openbook.scraper.model.ScrapedBookDTO;

import java.util.List;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;

public interface ScraperSource {

    /**
     * Unique source technical identifier (e.g. "urban_comics", "panini", etc.)
     */
    String getId();

    /**
     * Display name (e.g. "Urban Comics")
     */
    String getName();

    /**
     * Short description of catalogue coverage
     */
    String getDescription();

    /**
     * Hex brand color for the admin UI badge
     */
    String getColor();

    /**
     * Executes the scraping routine.
     *
     * @param options      Scan parameters (fullScan, maxItems)
     * @param onBookFound  Callback invoked in real-time as soon as a book is parsed
     * @param isStopped    Predicate checked regularly to halt early if user requests stop
     * @return List of all scraped books
     * @throws Exception if an unrecoverable error occurs
     */
    List<ScrapedBookDTO> scrape(
            ScanOptions options,
            Consumer<ScrapedBookDTO> onBookFound,
            BooleanSupplier isStopped
    ) throws Exception;
}
