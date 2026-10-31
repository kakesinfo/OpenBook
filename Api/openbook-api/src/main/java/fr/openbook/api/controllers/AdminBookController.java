package fr.openbook.api.controllers;

import fr.openbook.api.utils.MediaUrlUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@RestController
@RequestMapping("/admin/books")
@RequiredArgsConstructor(onConstructor = @__(@Autowired))
public class AdminBookController {

    private final JdbcTemplate jdbcTemplate;

    @GetMapping("/deleted")
    public ResponseEntity<Map<String, Object>> getDeletedBooks(
            @RequestParam(required = false) String search
    ) {
        StringBuilder sql = new StringBuilder("""
            SELECT 
                b.id,
                b.title,
                b.volume,
                b.isbn,
                b.cover_url,
                b.type,
                b.price,
                b.release_date,
                b.updated_at AS deleted_at,
                s.name AS series_name,
                e.name AS editor_name,
                (
                    SELECT STRING_AGG(TRIM(CONCAT(a.firstname, ' ', a.lastname)), ', ')
                    FROM book_has_author bha
                    JOIN author a ON a.id = bha.author_id
                    WHERE bha.book_id = b.id
                ) AS authors
            FROM book b
            LEFT JOIN series s ON s.id = b.series_id
            LEFT JOIN editor e ON e.id = b.editor_id
            WHERE b.deleted = true
        """);

        List<Object> params = new ArrayList<>();
        if (search != null && !search.trim().isBlank()) {
            String q = "%" + search.trim().toLowerCase() + "%";
            sql.append("""
                 AND (
                    LOWER(b.title) LIKE ?
                    OR LOWER(COALESCE(b.isbn, '')) LIKE ?
                    OR LOWER(COALESCE(s.name, '')) LIKE ?
                    OR LOWER(COALESCE(e.name, '')) LIKE ?
                    OR EXISTS (
                        SELECT 1 FROM book_has_author bha2
                        JOIN author a2 ON a2.id = bha2.author_id
                        WHERE bha2.book_id = b.id
                        AND (LOWER(a2.firstname) LIKE ? OR LOWER(a2.lastname) LIKE ? OR LOWER(CONCAT(a2.firstname, ' ', a2.lastname)) LIKE ?)
                    )
                 )
            """);
            params.add(q);
            params.add(q);
            params.add(q);
            params.add(q);
            params.add(q);
            params.add(q);
            params.add(q);
        }

        sql.append(" ORDER BY b.updated_at DESC, b.id DESC");

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql.toString(), params.toArray());

        List<Map<String, Object>> books = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> item = new HashMap<>();
            item.put("id", row.get("id"));
            item.put("title", row.get("title"));
            item.put("volume", row.get("volume"));
            item.put("isbn", row.get("isbn"));
            String rawCover = (String) row.get("cover_url");
            item.put("coverUrl", MediaUrlUtils.formatCoverUrl(rawCover));
            item.put("type", row.get("type"));
            item.put("price", row.get("price"));
            item.put("releaseDate", row.get("release_date") != null ? row.get("release_date").toString() : null);
            item.put("deletedAt", row.get("deleted_at") != null ? row.get("deleted_at").toString() : null);
            item.put("seriesName", row.get("series_name"));
            item.put("editorName", row.get("editor_name"));
            item.put("authors", row.get("authors"));
            books.add(item);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("total", books.size());
        response.put("books", books);

        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}/restore")
    public ResponseEntity<Map<String, Object>> restoreBook(@PathVariable Long id) {
        int updated = jdbcTemplate.update(
                "UPDATE book SET deleted = false, updated_at = NOW() WHERE id = ? AND deleted = true",
                id
        );

        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Livre supprimé introuvable.");
        }

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "L'album a été restauré avec succès."
        ));
    }

    @PostMapping("/restore-bulk")
    public ResponseEntity<Map<String, Object>> restoreBulk(@RequestBody Map<String, List<Long>> body) {
        List<Long> ids = body != null ? body.get("ids") : null;
        if (ids == null || ids.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "Aucun identifiant fourni."
            ));
        }

        String inSql = String.join(",", Collections.nCopies(ids.size(), "?"));
        int updated = jdbcTemplate.update(
                "UPDATE book SET deleted = false, updated_at = NOW() WHERE deleted = true AND id IN (" + inSql + ")",
                ids.toArray()
        );

        return ResponseEntity.ok(Map.of(
                "success", true,
                "restoredCount", updated,
                "message", updated + " album(s) restauré(s) avec succès."
        ));
    }

    @PostMapping("/restore-all")
    public ResponseEntity<Map<String, Object>> restoreAll() {
        int updated = jdbcTemplate.update(
                "UPDATE book SET deleted = false, updated_at = NOW() WHERE deleted = true"
        );

        return ResponseEntity.ok(Map.of(
                "success", true,
                "restoredCount", updated,
                "message", "Tous les albums supprimés (" + updated + ") ont été restaurés."
        ));
    }
}
