package fr.openbook.api.services;

import fr.openbook.scraper.service.ScraperDbService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.function.Function;
import java.util.function.Supplier;

@Service
@Slf4j
@RequiredArgsConstructor
public class MaintenanceService {

    private final ScraperDbService dbService;
    private final AuthorDeduplicationService authorDeduplicationService;
    private final AuditLogService auditLogService;

    public Map<String, Object> repair() {
        return runLoggedMaintenance(
                "Maintenance : Réparation Mojibake",
                "Lancement de la réparation Mojibake",
                dbService::repairMojibake,
                res -> String.format("%s livre(s), %s série(s) réparé(s)",
                        res.getOrDefault("repaired_books", 0),
                        res.getOrDefault("repaired_series", 0))
        );
    }

    public Map<String, Object> deduplicate() {
        return runLoggedMaintenance(
                "Maintenance : Déduplication des livres",
                "Lancement de la déduplication des livres",
                () -> {
                    int merged = dbService.deduplicateBooks();
                    return Map.of("status", "success", "merged_duplicates", merged);
                },
                res -> res.getOrDefault("merged_duplicates", 0) + " doublon(s) fusionné(s)"
        );
    }

    public Map<String, Object> deduplicateAuthors() {
        return runLoggedMaintenance(
                "Maintenance : Déduplication des auteurs",
                "Lancement de la déduplication des auteurs",
                authorDeduplicationService::deduplicateAllAuthors,
                res -> String.format("%s groupe(s), %s auteur(s) fusionné(s)",
                        res.getOrDefault("groups_merged", 0),
                        res.getOrDefault("authors_merged", 0))
        );
    }

    public Map<String, Object> enrichFromBnf(Integer limit) {
        int effectiveLimit = (limit != null && limit > 0) ? limit : 50;
        return runLoggedMaintenance(
                "Maintenance : Enrichissement BNF",
                "Limite : " + effectiveLimit,
                () -> dbService.enrichBooksFromBnf(effectiveLimit),
                res -> String.format("%s scanné(s), %s enrichi(s)",
                        res.getOrDefault("scanned", 0),
                        res.getOrDefault("enriched", 0))
        );
    }

    public Map<String, Object> verifyBooksFromBnf(Integer limit) {
        int effectiveLimit = (limit != null && limit > 0) ? limit : 50;
        return runLoggedMaintenance(
                "Maintenance : Vérification ISBN BNF",
                "Limite : " + effectiveLimit,
                () -> dbService.verifyBooksFromBnf(effectiveLimit, false),
                res -> String.format("%s vérifié(s), %s mis à jour",
                        res.getOrDefault("verified", res.getOrDefault("scanned", 0)),
                        res.getOrDefault("updated", 0))
        );
    }

    public Map<String, Object> migrateCovers(Integer limit) {
        String startComment = limit != null && limit > 0 ? "Limite : " + limit : "Toutes les couvertures";
        return runLoggedMaintenance(
                "Maintenance : Migration des couvertures",
                startComment,
                () -> dbService.migrateCoversToUuid(limit, 4),
                res -> String.format("%s migrée(s), %s échec(s)",
                        res.getOrDefault("migrated", 0),
                        res.getOrDefault("failed", 0))
        );
    }

    public Map<String, Object> getMaintenanceStats() {
        return dbService.getMaintenanceStats();
    }

    private Map<String, Object> runLoggedMaintenance(
            String action,
            String startComment,
            Supplier<Map<String, Object>> task,
            Function<Map<String, Object>, String> summaryFormatter
    ) {
        auditLogService.logAdmin("MAINTENANCE", action, AuditLogService.STATUS_STARTED, startComment);
        try {
            Map<String, Object> result = task.get();
            Object rawStatus = result != null ? result.get("status") : null;
            boolean isFailure = rawStatus != null
                    && ("error".equalsIgnoreCase(rawStatus.toString()) || "failure".equalsIgnoreCase(rawStatus.toString()));
            String finalStatus = isFailure ? AuditLogService.STATUS_FAILURE : AuditLogService.STATUS_SUCCESS;
            String comment = isFailure && result.get("message") != null
                    ? result.get("message").toString()
                    : (result != null ? summaryFormatter.apply(result) : null);
            auditLogService.logAdmin("MAINTENANCE", action, finalStatus, comment);
            return result;
        } catch (Exception e) {
            auditLogService.logAdmin("MAINTENANCE", action, AuditLogService.STATUS_FAILURE, e.getMessage());
            throw e;
        }
    }
}
