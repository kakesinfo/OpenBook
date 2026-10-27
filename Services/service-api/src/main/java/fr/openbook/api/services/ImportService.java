package fr.openbook.api.services;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

@Service
@Slf4j
public class ImportService {

    @Value("${import.service.url:http://project-import:5003}")
    private String importServiceUrl;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public ImportService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.restTemplate = new RestTemplate();
    }

    private String getBaseUrl() {
        return (importServiceUrl != null && !importServiceUrl.isBlank())
                ? importServiceUrl.replaceAll("/+$", "")
                : "http://project-import:5003";
    }

    public Map<String, Object> importBookmory(MultipartFile file, Long userId, boolean wait) throws IOException {
        String url = getBaseUrl() + "/api/import/bookmory?wait=" + wait;

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        if (userId != null) {
            headers.set("X-User-Id", String.valueOf(userId));
        }

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        ByteArrayResource fileResource = new ByteArrayResource(file.getBytes()) {
            @Override
            public String getFilename() {
                return file.getOriginalFilename() != null ? file.getOriginalFilename() : "backup.bookmory";
            }
        };

        body.add("file", fileResource);
        if (userId != null) {
            body.add("user_id", String.valueOf(userId));
        }

        HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<String> response = restTemplate.postForEntity(url, requestEntity, String.class);
            return objectMapper.readValue(response.getBody(), new TypeReference<>() {});
        } catch (Exception ex) {
            log.error("Failed to forward import request to service-import: {}", ex.getMessage(), ex);
            Map<String, Object> errorMap = new HashMap<>();
            errorMap.put("success", false);
            errorMap.put("error", "Impossible de joindre le service d'import: " + ex.getMessage());
            return errorMap;
        }
    }

    public Map<String, Object> getJobStatus(String jobId) {
        String url = getBaseUrl() + "/api/import/status/" + jobId;
        try {
            ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);
            return objectMapper.readValue(response.getBody(), new TypeReference<>() {});
        } catch (Exception ex) {
            log.error("Failed to fetch import job status from service-import: {}", ex.getMessage());
            Map<String, Object> errorMap = new HashMap<>();
            errorMap.put("status", "error");
            errorMap.put("error", ex.getMessage());
            return errorMap;
        }
    }
}
