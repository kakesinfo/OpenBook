package fr.openbook.api.services;

import fr.openbook.scraper.service.ScraperDbService;
import fr.openbook.scraper.service.ScraperEngineService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
@Slf4j
@RequiredArgsConstructor
public class ScraperService {

    private final ScraperEngineService engineService;
    private final ScraperDbService dbService;
    private final AuthorDeduplicationService authorDeduplicationService;

    public Map<String, Object> getStatus() {
        return engineService.getStatus();
    }

    public Map<String, Object> getSources() {
        return Map.of("sources", engineService.getSources());
    }

    public Map<String, Object> toggleSource(String source, boolean enabled) {
        return engineService.toggleSource(source, enabled);
    }

    public Map<String, Object> triggerScrape(List<String> sources, boolean full) {
        return engineService.triggerScrape(sources, full);
    }

    public Map<String, Object> stopScan() {
        return engineService.stopScan();
    }

    public Map<String, Object> repair() {
        return dbService.repairMojibake();
    }

    public Map<String, Object> deduplicate() {
        int merged = dbService.deduplicateBooks();
        return Map.of("status", "success", "merged_duplicates", merged);
    }

    public Map<String, Object> deduplicateAuthors() {
        return authorDeduplicationService.deduplicateAllAuthors();
    }

    public Map<String, Object> enrichFromBnf(Integer limit) {
        int effectiveLimit = (limit != null && limit > 0) ? limit : 50;
        return dbService.enrichBooksFromBnf(effectiveLimit);
    }

    public Map<String, Object> verifyBooksFromBnf(Integer limit) {
        int effectiveLimit = (limit != null && limit > 0) ? limit : 50;
        return dbService.verifyBooksFromBnf(effectiveLimit, false);
    }

    public Map<String, Object> getMaintenanceStats() {
        return dbService.getMaintenanceStats();
    }

    public Map<String, Object> migrateCovers(Integer limit) {
        return dbService.migrateCoversToUuid(limit, 4);
    }
}
