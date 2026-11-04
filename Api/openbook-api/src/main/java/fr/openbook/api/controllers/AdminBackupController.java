package fr.openbook.api.controllers;

import fr.openbook.backup.model.BackupMetadata;
import fr.openbook.backup.model.RestoreResult;
import fr.openbook.backup.service.BackupService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.File;
import java.io.IOException;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/admin/backup")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class AdminBackupController {

    private final BackupService backupService;

    /**
     * Lists existing backup files.
     */
    @GetMapping
    public ResponseEntity<List<BackupMetadata>> listBackups() {
        return ResponseEntity.ok(backupService.listBackups());
    }

    /**
     * Triggers the creation of a new dated backup (.zip with database dump + media images).
     */
    @PostMapping
    public ResponseEntity<?> createBackup() {
        try {
            BackupMetadata meta = backupService.createBackup();
            return ResponseEntity.status(HttpStatus.CREATED).body(meta);
        } catch (Exception e) {
            log.error("[AdminBackup] Failed to create backup: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Backup failed: " + e.getMessage()));
        }
    }

    /**
     * Downloads a backup zip by filename.
     */
    @GetMapping("/download/{filename}")
    public ResponseEntity<Resource> downloadBackup(@PathVariable String filename) {
        try {
            Path path = backupService.getBackupPath(filename);
            File file = path.toFile();
            Resource resource = new FileSystemResource(file);

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + file.getName() + "\"")
                    .contentType(MediaType.APPLICATION_OCTET_STREAM)
                    .contentLength(file.length())
                    .body(resource);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * Restores a backup by filename.
     */
    @PostMapping("/restore/{filename}")
    public ResponseEntity<?> restoreBackup(@PathVariable String filename) {
        try {
            log.info("[AdminBackup] Received restore request for backup: {}", filename);
            RestoreResult result = backupService.restoreBackup(filename);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.error("[AdminBackup] Restore failed for backup {}: {}", filename, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Restore failed: " + e.getMessage()));
        }
    }

    /**
     * Deletes a backup by filename.
     */
    @DeleteMapping("/{filename}")
    public ResponseEntity<?> deleteBackup(@PathVariable String filename) {
        try {
            boolean deleted = backupService.deleteBackup(filename);
            if (deleted) {
                return ResponseEntity.noContent().build();
            } else {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(Map.of("error", "Could not delete backup file"));
            }
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }
}
