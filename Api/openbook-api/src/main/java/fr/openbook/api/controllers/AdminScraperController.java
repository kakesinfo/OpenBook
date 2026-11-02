package fr.openbook.api.controllers;

import fr.openbook.api.services.ScraperService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/admin/scrapers")
@RequiredArgsConstructor(onConstructor = @__(@Autowired))
public class AdminScraperController {

    private final ScraperService scraperService;

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus() {
        return ResponseEntity.ok(scraperService.getStatus());
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getSources() {
        return ResponseEntity.ok(scraperService.getSources());
    }

    @PutMapping("/{source}")
    public ResponseEntity<Map<String, Object>> toggleSource(
            @PathVariable String source,
            @RequestBody Map<String, Boolean> body
    ) {
        boolean enabled = body != null && Boolean.TRUE.equals(body.get("enabled"));
        return ResponseEntity.ok(scraperService.toggleSource(source, enabled));
    }

    @PostMapping("/scan")
    public ResponseEntity<Map<String, Object>> triggerScan(
            @RequestBody(required = false) Map<String, Object> request
    ) {
        List<String> sources = null;
        boolean full = false;

        if (request != null) {
            if (request.containsKey("sources") && request.get("sources") instanceof List<?> list) {
                sources = list.stream().map(Object::toString).toList();
            }
            if (request.containsKey("full") && request.get("full") instanceof Boolean b) {
                full = b;
            }
        }
        return ResponseEntity.ok(scraperService.triggerScrape(sources, full));
    }

    @PostMapping("/stop")
    public ResponseEntity<Map<String, Object>> stopScan() {
        return ResponseEntity.ok(scraperService.stopScan());
    }

    @PostMapping("/repair")
    public ResponseEntity<Map<String, Object>> repair() {
        return ResponseEntity.ok(scraperService.repair());
    }

    @PostMapping("/deduplicate")
    public ResponseEntity<Map<String, Object>> deduplicate() {
        return ResponseEntity.ok(scraperService.deduplicate());
    }

    @PostMapping({"/deduplicate-authors", "/maintenance/deduplicate-authors"})
    public ResponseEntity<Map<String, Object>> deduplicateAuthors() {
        return ResponseEntity.ok(scraperService.deduplicateAuthors());
    }

    @PostMapping({"/enrich-bnf", "/maintenance/enrich-bnf"})
    public ResponseEntity<Map<String, Object>> enrichBnf(
            @RequestBody(required = false) Map<String, Object> request
    ) {
        Integer limit = null;
        if (request != null && request.containsKey("limit") && request.get("limit") instanceof Number n) {
            limit = n.intValue();
        }
        return ResponseEntity.ok(scraperService.enrichFromBnf(limit));
    }

    @PostMapping({"/verify-isbn", "/maintenance/verify-isbn"})
    public ResponseEntity<Map<String, Object>> verifyIsbn(
            @RequestBody(required = false) Map<String, Object> request
    ) {
        Integer limit = null;
        if (request != null && request.containsKey("limit") && request.get("limit") instanceof Number n) {
            limit = n.intValue();
        }
        return ResponseEntity.ok(scraperService.verifyBooksFromBnf(limit));
    }

    @PostMapping({"/origin-countries", "/maintenance/origin-countries"})
    public ResponseEntity<Map<String, Object>> findOriginCountries(
            @RequestBody(required = false) Map<String, Object> request
    ) {
        Integer limit = null;
        if (request != null && request.containsKey("limit") && request.get("limit") instanceof Number n) {
            limit = n.intValue();
        }
        return ResponseEntity.ok(scraperService.findOriginCountriesFromBnf(limit));
    }

    @GetMapping("/maintenance/conflicts")
    public ResponseEntity<Map<String, Object>> getConflicts() {
        return ResponseEntity.ok(scraperService.getVolumeConflicts());
    }

    @PostMapping("/maintenance/split")
    public ResponseEntity<Map<String, Object>> splitSeries(@RequestBody Map<String, Object> payload) {
        return ResponseEntity.ok(scraperService.splitSeries(payload));
    }

    @PostMapping("/maintenance/link-variant")
    public ResponseEntity<Map<String, Object>> linkVariant(@RequestBody Map<String, Object> payload) {
        return ResponseEntity.ok(scraperService.linkVariant(payload));
    }

    @PostMapping({"/migrate-covers", "/maintenance/migrate-covers"})
    public ResponseEntity<Map<String, Object>> migrateCovers(
            @RequestBody(required = false) Map<String, Object> request
    ) {
        Integer limit = null;
        if (request != null && request.containsKey("limit") && request.get("limit") instanceof Number n) {
            limit = n.intValue();
        }
        return ResponseEntity.ok(scraperService.migrateCovers(limit));
    }

    @GetMapping("/maintenance/stats")
    public ResponseEntity<Map<String, Object>> getMaintenanceStats() {
        return ResponseEntity.ok(scraperService.getMaintenanceStats());
    }
}
