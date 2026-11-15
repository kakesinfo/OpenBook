package fr.openbook.api.controllers;

import fr.openbook.api.services.MaintenanceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/admin/maintenance")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class AdminMaintenanceController {

    private final MaintenanceService maintenanceService;

    @PostMapping("/repair")
    public ResponseEntity<Map<String, Object>> repair() {
        return ResponseEntity.ok(maintenanceService.repair());
    }

    @PostMapping("/deduplicate")
    public ResponseEntity<Map<String, Object>> deduplicate() {
        return ResponseEntity.ok(maintenanceService.deduplicate());
    }

    @PostMapping("/deduplicate-authors")
    public ResponseEntity<Map<String, Object>> deduplicateAuthors() {
        return ResponseEntity.ok(maintenanceService.deduplicateAuthors());
    }

    @PostMapping("/enrich-bnf")
    public ResponseEntity<Map<String, Object>> enrichBnf(
            @RequestBody(required = false) Map<String, Object> request
    ) {
        return ResponseEntity.ok(maintenanceService.enrichFromBnf(extractLimit(request)));
    }

    @PostMapping("/verify-isbn")
    public ResponseEntity<Map<String, Object>> verifyIsbn(
            @RequestBody(required = false) Map<String, Object> request
    ) {
        return ResponseEntity.ok(maintenanceService.verifyBooksFromBnf(extractLimit(request)));
    }

    @PostMapping("/migrate-covers")
    public ResponseEntity<Map<String, Object>> migrateCovers(
            @RequestBody(required = false) Map<String, Object> request
    ) {
        return ResponseEntity.ok(maintenanceService.migrateCovers(extractLimit(request)));
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getMaintenanceStats() {
        return ResponseEntity.ok(maintenanceService.getMaintenanceStats());
    }

    private Integer extractLimit(Map<String, Object> request) {
        if (request != null && request.containsKey("limit") && request.get("limit") instanceof Number n) {
            return n.intValue();
        }
        return null;
    }
}
