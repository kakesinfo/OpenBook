package fr.openbook.api.services;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import fr.openbook.api.importing.job.ImportJob;
import fr.openbook.api.importing.job.ImportOptions;
import fr.openbook.api.importing.job.ImportResponse;
import fr.openbook.api.importing.service.BookmoryImportService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.HashMap;
import java.util.Map;

@Service
@Slf4j
@RequiredArgsConstructor
public class ImportService {

    private final BookmoryImportService bookmoryImportService;
    private final ObjectMapper objectMapper;

    public Map<String, Object> importBookmory(MultipartFile file, Long userId, boolean wait) throws IOException {
        return importBookmory(file, userId, wait, new ImportOptions());
    }

    public Map<String, Object> importBookmory(MultipartFile file, Long userId, boolean wait, ImportOptions options) throws IOException {
        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "backup.bookmory";
        String prefix = "upload_";
        String suffix = filename.endsWith(".zip") ? ".zip" : ".bookmory";

        File tempFile = File.createTempFile(prefix, suffix);
        try {
            Files.copy(file.getInputStream(), tempFile.toPath(), StandardCopyOption.REPLACE_EXISTING);
            ImportResponse response = bookmoryImportService.startImport(tempFile, userId, wait, options);
            return objectMapper.convertValue(response, new TypeReference<>() {});
        } catch (Exception ex) {
            log.error("Failed to execute Bookmory import: {}", ex.getMessage(), ex);
            if (tempFile.exists()) {
                tempFile.delete();
            }
            Map<String, Object> errorMap = new HashMap<>();
            errorMap.put("success", false);
            errorMap.put("error", "Erreur lors de l'importation: " + ex.getMessage());
            return errorMap;
        }
    }

    public Map<String, Object> importBookmoryLocal(String filePath, Long userId, boolean wait) {
        File file = new File(filePath);
        if (!file.exists() || !file.isFile()) {
            Map<String, Object> errorMap = new HashMap<>();
            errorMap.put("success", false);
            errorMap.put("error", "File does not exist: " + filePath);
            return errorMap;
        }

        try {
            ImportResponse response = bookmoryImportService.startImport(file, userId, wait);
            return objectMapper.convertValue(response, new TypeReference<>() {});
        } catch (Exception ex) {
            log.error("Failed to execute local Bookmory import: {}", ex.getMessage(), ex);
            Map<String, Object> errorMap = new HashMap<>();
            errorMap.put("success", false);
            errorMap.put("error", "Erreur lors de l'importation locale: " + ex.getMessage());
            return errorMap;
        }
    }

    public Map<String, Object> getJobStatus(String jobId) {
        ImportJob job = bookmoryImportService.getJob(jobId);
        if (job == null) {
            Map<String, Object> errorMap = new HashMap<>();
            errorMap.put("status", "error");
            errorMap.put("error", "Job not found");
            return errorMap;
        }
        return objectMapper.convertValue(job, new TypeReference<>() {});
    }
}
