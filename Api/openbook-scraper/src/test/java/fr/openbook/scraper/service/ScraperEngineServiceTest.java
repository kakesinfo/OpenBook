package fr.openbook.scraper.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import fr.openbook.scraper.config.ScraperProperties;
import fr.openbook.scraper.sources.ScraperSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ScraperEngineServiceTest {

    @Mock
    private ScraperDbService scraperDbService;

    @Mock
    private ScraperSource mockSource;

    private ScraperProperties properties;
    private ScraperEngineService engineService;

    @BeforeEach
    void setUp() {
        properties = new ScraperProperties();
        properties.setEnabled(true);
        properties.setScrapeOnStartup(false);
        properties.setScheduleCron("0 0 3 * * *");
        properties.setMaxBooksPerSource(30);

        when(mockSource.getId()).thenReturn("urban_comics");
        when(mockSource.getName()).thenReturn("Urban Comics");
        when(mockSource.getDescription()).thenReturn("Catalog Urban");
        when(mockSource.getColor()).thenReturn("#00a3e0");

        when(scraperDbService.getRecentBooks(anyInt())).thenReturn(List.of());

        engineService = new ScraperEngineService(
                properties,
                scraperDbService,
                List.of(mockSource),
                new ObjectMapper()
        );
        engineService.init();
    }

    @Test
    void testGetSources() {
        List<Map<String, Object>> sources = engineService.getSources();
        assertNotNull(sources);
        assertEquals(1, sources.size());
        assertEquals("urban_comics", sources.get(0).get("id"));
        assertEquals("Urban Comics", sources.get(0).get("name"));
        assertTrue((Boolean) sources.get(0).get("enabled"));
    }

    @Test
    void testToggleSource() {
        Map<String, Object> toggleRes = engineService.toggleSource("urban_comics", false);
        assertFalse((Boolean) toggleRes.get("enabled"));

        Map<String, Object> status = engineService.getStatus();
        @SuppressWarnings("unchecked")
        List<String> disabled = (List<String>) status.get("disabled_sources");
        assertTrue(disabled.contains("urban_comics"));

        engineService.toggleSource("urban_comics", true);
        Map<String, Object> status2 = engineService.getStatus();
        @SuppressWarnings("unchecked")
        List<String> enabled = (List<String>) status2.get("enabled_sources");
        assertTrue(enabled.contains("urban_comics"));
    }

    @Test
    void testGetStatusStructure() {
        Map<String, Object> status = engineService.getStatus();
        assertNotNull(status);
        assertFalse((Boolean) status.get("is_running"));
        assertEquals("idle", status.get("last_status"));
        assertTrue(status.containsKey("available_sources"));
        assertTrue(status.containsKey("schedule"));
        assertTrue(status.containsKey("live_scan"));
    }

    @Test
    void testStopScanWhenNotRunning() {
        Map<String, Object> stopRes = engineService.stopScan();
        assertEquals("not_running", stopRes.get("status"));
    }
}
