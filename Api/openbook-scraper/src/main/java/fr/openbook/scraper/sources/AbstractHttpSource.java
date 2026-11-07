package fr.openbook.scraper.sources;

import fr.openbook.scraper.config.ScraperProperties;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;

import java.net.CookieHandler;
import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

@Slf4j
public abstract class AbstractHttpSource implements ScraperSource {

    protected final ScraperProperties properties;
    protected final HttpClient httpClient;
    protected final CookieManager cookieManager;

    protected AbstractHttpSource(ScraperProperties properties) {
        this.properties = properties;
        this.cookieManager = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(properties.getRequestTimeout()))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .cookieHandler(this.cookieManager)
                .build();
    }

    protected Document fetchDocument(String url) {
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                    .GET()
                    .timeout(Duration.ofSeconds(properties.getRequestTimeout()))
                    .header("User-Agent", properties.getUserAgent())
                    .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8")
                    .header("Accept-Language", "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7")
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                return Jsoup.parse(response.body(), url);
            }
            log.warn("[{}] HTTP {} for {}", getId(), response.statusCode(), url);
            return null;
        } catch (Exception e) {
            log.warn("[{}] Error fetching {}: {}", getId(), url, e.getMessage());
            return null;
        }
    }

    protected String fetchString(String url) {
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                    .GET()
                    .timeout(Duration.ofSeconds(properties.getRequestTimeout()))
                    .header("User-Agent", properties.getUserAgent())
                    .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8")
                    .header("Accept-Language", "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7")
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                return response.body();
            }
            return null;
        } catch (Exception e) {
            log.warn("[{}] Error fetching string {}: {}", getId(), url, e.getMessage());
            return null;
        }
    }
}
