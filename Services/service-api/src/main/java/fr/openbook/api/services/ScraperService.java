package fr.openbook.api.services;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
public class ScraperService {

    @Value("${scraper.service.url:http://project-scraper:5001}")
    private String scraperServiceUrl;

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    public ScraperService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(4))
                .build();
    }

    private String getBaseUrl() {
        return (scraperServiceUrl != null && !scraperServiceUrl.isBlank())
                ? scraperServiceUrl.replaceAll("/+$", "")
                : "http://project-scraper:5001";
    }

    private Map<String, Object> executeRequest(HttpRequest request, String fallbackUrl) {
        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                return objectMapper.readValue(response.body(), new TypeReference<>() {});
            }
            log.warn("Scraper service returned HTTP {}: {}", response.statusCode(), response.body());
            Map<String, Object> errorMap = new HashMap<>();
            errorMap.put("error", "HTTP " + response.statusCode());
            errorMap.put("details", response.body());
            errorMap.put("connected", false);
            return errorMap;
        } catch (Exception primaryEx) {
            log.debug("Primary request failed to {}: {}", request.uri(), primaryEx.getMessage());
            if (fallbackUrl != null && !request.uri().toString().startsWith(fallbackUrl)) {
                try {
                    URI fallbackUri = URI.create(request.uri().toString().replace(getBaseUrl(), fallbackUrl));
                    HttpRequest fallbackReq = HttpRequest.newBuilder(fallbackUri)
                            .method(request.method(), request.bodyPublisher().orElse(HttpRequest.BodyPublishers.noBody()))
                            .timeout(Duration.ofSeconds(4))
                            .header("Content-Type", "application/json")
                            .header("Accept", "application/json")
                            .build();
                    HttpResponse<String> fallbackResp = httpClient.send(fallbackReq, HttpResponse.BodyHandlers.ofString());
                    if (fallbackResp.statusCode() >= 200 && fallbackResp.statusCode() < 300) {
                        return objectMapper.readValue(fallbackResp.body(), new TypeReference<>() {});
                    }
                } catch (Exception fallbackEx) {
                    log.debug("Fallback request failed: {}", fallbackEx.getMessage());
                }
            }
            Map<String, Object> errorMap = new HashMap<>();
            errorMap.put("error", "Microservice scraper injoignable");
            errorMap.put("connected", false);
            return errorMap;
        }
    }

    public Map<String, Object> getStatus() {
        HttpRequest req = HttpRequest.newBuilder(URI.create(getBaseUrl() + "/api/status"))
                .GET()
                .timeout(Duration.ofSeconds(4))
                .header("Accept", "application/json")
                .build();
        return executeRequest(req, "http://localhost:5001");
    }

    public Map<String, Object> getSources() {
        HttpRequest req = HttpRequest.newBuilder(URI.create(getBaseUrl() + "/api/sources"))
                .GET()
                .timeout(Duration.ofSeconds(4))
                .header("Accept", "application/json")
                .build();
        return executeRequest(req, "http://localhost:5001");
    }

    public Map<String, Object> toggleSource(String source, boolean enabled) {
        try {
            String jsonBody = objectMapper.writeValueAsString(Map.of("enabled", enabled));
            HttpRequest req = HttpRequest.newBuilder(URI.create(getBaseUrl() + "/api/sources/" + source + "?enabled=" + enabled))
                    .PUT(HttpRequest.BodyPublishers.ofString(jsonBody))
                    .timeout(Duration.ofSeconds(5))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .build();
            return executeRequest(req, "http://localhost:5001");
        } catch (IOException e) {
            log.error("Failed to serialize toggle payload", e);
            return Map.of("error", e.getMessage(), "connected", false);
        }
    }

    public Map<String, Object> triggerScrape(List<String> sources, boolean full) {
        StringBuilder query = new StringBuilder("?");
        if (sources != null && !sources.isEmpty()) {
            query.append("sources=").append(String.join(",", sources)).append("&");
        }
        if (full) {
            query.append("full=true&");
        }
        String qs = query.toString().replaceAll("[?&]+$", "");

        HttpRequest req = HttpRequest.newBuilder(URI.create(getBaseUrl() + "/api/scrape" + qs))
                .POST(HttpRequest.BodyPublishers.noBody())
                .timeout(Duration.ofSeconds(5))
                .header("Accept", "application/json")
                .build();
        return executeRequest(req, "http://localhost:5001");
    }

    public Map<String, Object> stopScan() {
        HttpRequest req = HttpRequest.newBuilder(URI.create(getBaseUrl() + "/api/scrape/stop"))
                .POST(HttpRequest.BodyPublishers.noBody())
                .timeout(Duration.ofSeconds(5))
                .header("Accept", "application/json")
                .build();
        return executeRequest(req, "http://localhost:5001");
    }

    public Map<String, Object> repair() {
        HttpRequest req = HttpRequest.newBuilder(URI.create(getBaseUrl() + "/api/repair"))
                .POST(HttpRequest.BodyPublishers.noBody())
                .timeout(Duration.ofSeconds(15))
                .header("Accept", "application/json")
                .build();
        return executeRequest(req, "http://localhost:5001");
    }

    public Map<String, Object> deduplicate() {
        HttpRequest req = HttpRequest.newBuilder(URI.create(getBaseUrl() + "/api/deduplicate"))
                .POST(HttpRequest.BodyPublishers.noBody())
                .timeout(Duration.ofSeconds(20))
                .header("Accept", "application/json")
                .build();
        return executeRequest(req, "http://localhost:5001");
    }

    public Map<String, Object> getVolumeConflicts() {
        HttpRequest req = HttpRequest.newBuilder(URI.create(getBaseUrl() + "/api/maintenance/conflicts"))
                .GET()
                .timeout(Duration.ofSeconds(6))
                .header("Accept", "application/json")
                .build();
        return executeRequest(req, "http://localhost:5001");
    }

    public Map<String, Object> splitSeries(Map<String, Object> payload) {
        try {
            String jsonBody = objectMapper.writeValueAsString(payload);
            HttpRequest req = HttpRequest.newBuilder(URI.create(getBaseUrl() + "/api/maintenance/split"))
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                    .timeout(Duration.ofSeconds(10))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .build();
            return executeRequest(req, "http://localhost:5001");
        } catch (IOException e) {
            log.error("Failed to serialize splitSeries payload", e);
            return Map.of("error", e.getMessage(), "status", "error");
        }
    }

    public Map<String, Object> linkVariant(Map<String, Object> payload) {
        try {
            String jsonBody = objectMapper.writeValueAsString(payload);
            HttpRequest req = HttpRequest.newBuilder(URI.create(getBaseUrl() + "/api/maintenance/link-variant"))
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                    .timeout(Duration.ofSeconds(10))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .build();
            return executeRequest(req, "http://localhost:5001");
        } catch (IOException e) {
            log.error("Failed to serialize linkVariant payload", e);
            return Map.of("error", e.getMessage(), "status", "error");
        }
    }

    public Map<String, Object> getMaintenanceStats() {
        HttpRequest req = HttpRequest.newBuilder(URI.create(getBaseUrl() + "/api/maintenance/stats"))
                .GET()
                .timeout(Duration.ofSeconds(5))
                .header("Accept", "application/json")
                .build();
        return executeRequest(req, "http://localhost:5001");
    }
}
