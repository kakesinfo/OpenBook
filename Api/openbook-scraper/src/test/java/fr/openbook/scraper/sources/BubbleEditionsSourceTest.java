package fr.openbook.scraper.sources;

import fr.openbook.scraper.config.ScraperProperties;
import fr.openbook.scraper.model.ScrapedBookDTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class BubbleEditionsSourceTest {

    private BubbleEditionsSource source;

    @BeforeEach
    void setUp() {
        ScraperProperties properties = new ScraperProperties();
        properties.setRequestTimeout(30);
        source = new BubbleEditionsSource(properties);
    }

    @Test
    void testMetadata() {
        assertEquals("bubble_editions", source.getId());
        assertEquals("Bubble Editions", source.getName());
        assertEquals("#0ea5e9", source.getColor());
    }

    @Test
    void testScrapeBookPageAnamnese() {
        ScrapedBookDTO book = source.scrapeBookPage("https://www.bubble-editions.com/anamnese");
        assertNotNull(book);
        assertTrue(book.getTitle().contains("Anamnèse") || book.getTitle().contains("Anamnese"));
        assertEquals("Bubble Editions", book.getEditorName());
        assertEquals("9782958030346", book.getIsbn());
        assertEquals(216, book.getPageCount());
        assertNotNull(book.getPrice());
        assertFalse(book.getAuthors().isEmpty());
        assertEquals("Souto", book.getAuthors().get(0).getLastname());
        assertNotNull(book.getCoverUrl());
        assertTrue(book.getCoverUrl().contains("Coverv1-FINAL.jpeg"));
    }

    @Test
    void testScrapeBookPageFantasyCover() {
        ScrapedBookDTO book = source.scrapeBookPage("https://www.bubble-editions.com/fantasy");
        assertNotNull(book);
        assertEquals("Fantasy", book.getTitle());
        assertNotNull(book.getCoverUrl());
        assertTrue(book.getCoverUrl().contains("FANTASY+Couverture+Alma"));
    }

    @Test
    void testScrapeAParaitre() {
        List<ScrapedBookDTO> list = source.scrapeAParaitre(() -> false);
        assertNotNull(list);
        assertFalse(list.isEmpty());
        assertTrue(list.stream().anyMatch(b -> b.getTitle().toLowerCase().contains("homme qui n'aimait") || b.getTitle().toLowerCase().contains("lattaria")));
    }
}
