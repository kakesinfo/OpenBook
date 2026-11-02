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

    public Map<String, Object> getVolumeConflicts() {
        return Map.of("conflicts", dbService.detectVolumeConflicts());
    }

    public Map<String, Object> splitSeries(Map<String, Object> payload) {
        if (payload == null) {
            return Map.of("error", "Missing payload", "status", "error");
        }
        int sourceSeriesId = payload.get("source_series_id") instanceof Number n ? n.intValue() : 0;
        String newSeriesName = payload.get("new_series_name") != null ? payload.get("new_series_name").toString() : "";
        List<Integer> bookIds = List.of();
        if (payload.get("book_ids") instanceof List<?> list) {
            bookIds = list.stream().filter(Number.class::isInstance).map(n -> ((Number) n).intValue()).toList();
        }
        return dbService.splitSeries(sourceSeriesId, newSeriesName, bookIds);
    }

    public Map<String, Object> linkVariant(Map<String, Object> payload) {
        if (payload == null) {
            return Map.of("error", "Missing payload", "status", "error");
        }
        int parentBookId = payload.get("parent_book_id") instanceof Number n ? n.intValue() : 0;
        List<Integer> variantBookIds = List.of();
        if (payload.get("variant_book_ids") instanceof List<?> list) {
            variantBookIds = list.stream().filter(Number.class::isInstance).map(n -> ((Number) n).intValue()).toList();
        }
        return dbService.linkVariant(parentBookId, variantBookIds);
    }

    public Map<String, Object> getMaintenanceStats() {
        return dbService.getMaintenanceStats();
    }

    public Map<String, Object> migrateCovers(Integer limit) {
        return dbService.migrateCoversToUuid(limit, 4);
    }
}
