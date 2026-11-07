package fr.openbook.scraper.sources;

import fr.openbook.scraper.config.ScraperProperties;
import fr.openbook.scraper.model.ScrapedBookDTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class KomicsInitiativeSourceTest {

    private KomicsInitiativeSource source;

    @BeforeEach
    void setUp() {
        ScraperProperties properties = new ScraperProperties();
        properties.setRequestTimeout(30);
        source = new KomicsInitiativeSource(properties);
    }

    @Test
    void testSourceMetadata() {
        assertEquals("komics_initiative", source.getId());
        assertEquals("Komics Initiative", source.getName());
        assertNotNull(source.getDescription());
        assertEquals("#eab308", source.getColor());
    }

    @Test
    void testScrapeProductPageAgainstHope() {
        // Scrapes a known published comic on Komics Initiative
        ScrapedBookDTO book = source.scrapeProductPage("https://www.komics-initiative.com/catalogue-ouvrages-comics/against-hope/");
        assertNotNull(book);
        assertEquals("AGAINST HOPE", book.getTitle());
        assertEquals("Komics Initiative", book.getEditorName());
        assertEquals("9782386030628", book.getIsbn());
        assertEquals("Cartonné", book.getBookType());
        assertEquals("Comics", book.getCategoryName());
        assertEquals(176, book.getPageCount());
        assertNotNull(book.getPrice());
        assertNotNull(book.getCoverUrl());
        assertFalse(book.getAuthors().isEmpty());
        assertEquals("SANTOS", book.getAuthors().get(0).getLastname());
    }
}
