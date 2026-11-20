package fr.openbook.api.controllers;

import fr.openbook.api.services.ImportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/api/import")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
@RequiredArgsConstructor
public class ApiImportController {

    private final ImportService importService;

    @PostMapping(value = "/bookmory", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> importBookmory(
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "backup", required = false) MultipartFile backup,
            @RequestParam(value = "wait", defaultValue = "false") boolean wait,
            @RequestHeader(value = "X-User-Id", required = false) Long headerUserId,
            @RequestParam(value = "user_id", required = false) Long paramUserId
    ) {
        MultipartFile target = file != null ? file : backup;
        if (target == null || target.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Missing file field ('file' or 'backup')"));
        }

        Long userId = headerUserId != null && headerUserId > 0 ? headerUserId : (paramUserId != null && paramUserId > 0 ? paramUserId : 1L);

        try {
            Map<String, Object> result = importService.importBookmory(target, userId, wait);
            return ResponseEntity.ok(result);
        } catch (IOException ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Erreur lors de la lecture du fichier: " + ex.getMessage()));
        }
    }

    @PostMapping("/bookmory/local")
    public ResponseEntity<Map<String, Object>> importBookmoryLocal(@RequestBody Map<String, Object> payload) {
        String filePath = (String) payload.get("file_path");
        if (filePath == null || filePath.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "file_path is required"));
        }

        Number userIdNum = (Number) payload.get("user_id");
        Long userId = userIdNum != null ? userIdNum.longValue() : 1L;
        Boolean wait = (Boolean) payload.getOrDefault("wait", false);

        Map<String, Object> result = importService.importBookmoryLocal(filePath, userId, Boolean.TRUE.equals(wait));
        return ResponseEntity.ok(result);
    }

    @GetMapping("/status/{jobId}")
    public ResponseEntity<Map<String, Object>> getJobStatus(@PathVariable String jobId) {
        Map<String, Object> status = importService.getJobStatus(jobId);
        if ("error".equals(status.get("status")) && "Job not found".equals(status.get("error"))) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(status);
        }
        return ResponseEntity.ok(status);
    }
}
