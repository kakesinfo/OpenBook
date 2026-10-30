package fr.openbook.api.services.media;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.Map;

@Slf4j
@Service
public class MediaServiceClient implements MediaService {

    private final RestTemplate restTemplate;
    private final String mediaServiceUrl;

    public MediaServiceClient(RestTemplateBuilder builder,
                              @Value("${media.service.url:http://localhost:8080}") String mediaServiceUrl) {
        this.restTemplate = builder
                .setConnectTimeout(Duration.ofSeconds(10))
                .setReadTimeout(Duration.ofSeconds(30))
                .build();
        this.mediaServiceUrl = mediaServiceUrl != null ? mediaServiceUrl.replaceAll("/+$", "") : "http://localhost:8080";
    }

    /**
     * Create a virtual image slot in the media microservice.
     * Returns the generated UUID.
     */
    public String createVirtualImage() {
        String url = mediaServiceUrl + "/images";
        ResponseEntity<Map> response = restTemplate.postForEntity(url, null, Map.class);
        if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
            return (String) response.getBody().get("id");
        }
        throw new RuntimeException("Failed to create virtual image: " + response.getStatusCode());
    }

    /**
     * Upload image binary bytes to an image ID.
     */
    public Map<String, Object> uploadImage(String id, byte[] imageBytes, String contentType) {
        String url = mediaServiceUrl + "/images/" + id;
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(contentType != null ? contentType : "application/octet-stream"));
        HttpEntity<byte[]> request = new HttpEntity<>(imageBytes, headers);
        ResponseEntity<Map> response = restTemplate.postForEntity(url, request, Map.class);
        return response.getBody();
    }

    /**
     * Upload an image by remote URL to an image ID.
     */
    public Map<String, Object> uploadRemoteUrl(String id, String remoteUrl) {
        String url = mediaServiceUrl + "/images/" + id;
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, String>> request = new HttpEntity<>(Map.of("url", remoteUrl), headers);
        ResponseEntity<Map> response = restTemplate.postForEntity(url, request, Map.class);
        return response.getBody();
    }

    /**
     * Get image metadata info (dimensions, size, weight, status).
     */
    public Map<String, Object> getImageInfo(String id) {
        String url = mediaServiceUrl + "/images/" + id;
        ResponseEntity<Map> response = restTemplate.getForEntity(url, Map.class);
        return response.getBody();
    }

    /**
     * Get binary blob of the image (with optional width, height, size options).
     */
    public ResponseEntity<byte[]> getImageBlob(String id, Integer width, Integer height, String size) {
        StringBuilder url = new StringBuilder(mediaServiceUrl).append("/images/").append(id).append("/blob?");
        if (width != null && width > 0) url.append("w=").append(width).append("&");
        if (height != null && height > 0) url.append("h=").append(height).append("&");
        if (size != null && !size.isBlank()) url.append("size=").append(size).append("&");

        return restTemplate.getForEntity(url.toString(), byte[].class);
    }

    /**
     * Delete an image from the media microservice.
     */
    public void deleteImage(String id) {
        if (id == null || id.isBlank()) {
            return;
        }
        try {
            String url = mediaServiceUrl + "/images/" + id.trim();
            restTemplate.delete(url);
        } catch (Exception e) {
            log.warn("Could not delete image {} from media service: {}", id, e.getMessage());
        }
    }
}
