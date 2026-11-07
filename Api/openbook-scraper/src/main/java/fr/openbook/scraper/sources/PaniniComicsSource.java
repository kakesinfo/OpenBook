package fr.openbook.scraper.sources;

import fr.openbook.scraper.config.ScraperProperties;
import fr.openbook.scraper.model.ScanOptions;
import fr.openbook.scraper.model.ScrapedBookDTO;
import fr.openbook.scraper.utils.TextCleaner;
import fr.openbook.scraper.utils.VariantDetector;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.time.LocalDate;
import java.util.*;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Component
public class PaniniComicsSource extends AbstractHttpSource {

    public static final String CATALOG_URL = "https://www.excalibur-comics.fr/715-panini-comics-france";

    private static final Pattern RE_URL_ISBN = Pattern.compile("-(\\d{10}|\\d{13})\\.html");
    private static final Pattern RE_ISBN_ANY = Pattern.compile("\\b(97[89][0-9Xx\\- ]{10,18})\\b");
    private static final Pattern RE_PRICE = Pattern.compile("(\\d+(?:[,\\.]\\d+)?)\\s*€?");
    private static final Pattern RE_DATE = Pattern.compile("(\\d{2})/(\\d{2})/(\\d{4})");

    public PaniniComicsSource(ScraperProperties properties) {
        super(properties);
    }

    @Override
    public String getId() {
        return "panini";
    }

    @Override
    public String getName() {
        return "Panini Comics";
    }

    @Override
    public String getDescription() {
        return "Catalogue Panini Comics via Excalibur Comics (Marvel, Star Wars, DC, etc.)";
    }

    @Override
    public String getColor() {
        return "#ef4444";
    }

    @Override
    public List<ScrapedBookDTO> scrape(
            ScanOptions options,
            Consumer<ScrapedBookDTO> onBookFound,
            BooleanSupplier isStopped
    ) {
        int maxItems = options.getMaxItems() > 0 ? options.getMaxItems() : properties.getMaxBooksPerSource();
        boolean fullScan = options.isFullScan();
        List<ScrapedBookDTO> books = new ArrayList<>();
        Set<String> seenIsbns = new HashSet<>();
        Set<String> seenTitles = new HashSet<>();
        Set<String> seenUrls = new HashSet<>();

        String currentPageUrl = CATALOG_URL;
        Set<String> visitedPages = new HashSet<>();

        while (currentPageUrl != null && !currentPageUrl.isBlank()) {
            if (isStopped != null && isStopped.getAsBoolean()) break;
            if (!fullScan && books.size() >= maxItems) break;
            if (!visitedPages.add(currentPageUrl)) break;

            log.info("[Panini] Fetching listing {}", currentPageUrl);
            Document doc = fetchDocument(currentPageUrl);
            if (doc == null) {
                log.warn("[Panini] Failed to fetch {}", currentPageUrl);
                break;
            }

            Elements cards = doc.select("#js-product-list article.product-miniature");
            if (cards.isEmpty()) {
                cards = doc.select(".products article.product-miniature");
            }
            if (cards.isEmpty()) {
                log.info("[Panini] No cards found on page {}, stopping.", currentPageUrl);
                break;
            }

            for (Element card : cards) {
                if (isStopped != null && isStopped.getAsBoolean()) break;
                if (!fullScan && books.size() >= maxItems) break;

                ScrapedBookDTO book = parseCard(card, currentPageUrl);
                if (book == null) continue;

                String isbnKey = book.getIsbn() != null ? book.getIsbn().trim() : "";
                if (!isbnKey.isBlank() && seenIsbns.contains(isbnKey)) {
                    continue;
                }
                if (seenTitles.contains(book.getTitle()) || (book.getSourceUrl() != null && seenUrls.contains(book.getSourceUrl()))) {
                    continue;
                }

                if (!isbnKey.isBlank()) {
                    seenIsbns.add(isbnKey);
                }
                seenTitles.add(book.getTitle());
                if (book.getSourceUrl() != null) {
                    seenUrls.add(book.getSourceUrl());
                }

                books.add(book);
                if (onBookFound != null) {
                    onBookFound.accept(book);
                }
            }

            currentPageUrl = extractNextPageUrl(doc, currentPageUrl);
            if (currentPageUrl != null && !currentPageUrl.isBlank()) {
                try {
                    Thread.sleep(150);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }

        log.info("[Panini] Finished scraping: {} books", books.size());
        return books;
    }

    public ScrapedBookDTO parseCard(Element card, String baseUrl) {
        Element titleEl = card.select("h3.product-title a").first();
        String rawTitle = titleEl != null ? titleEl.text().trim() : "";
        Element imgTag = card.select("img").first();
        String altText = imgTag != null ? imgTag.attr("alt").trim() : "";

        if (rawTitle.isBlank()) {
            rawTitle = altText;
        }

        if (rawTitle.endsWith("...") || rawTitle.endsWith("…")) {
            if (!altText.isBlank() && !altText.endsWith("...") && !altText.endsWith("…")) {
                String prefix = rawTitle.replaceAll("[\\.…]+\\s*$", "").trim().toLowerCase();
                if (altText.toLowerCase().startsWith(prefix) || altText.length() > rawTitle.length()) {
                    rawTitle = altText;
                }
            }
        }
        rawTitle = rawTitle.replaceAll("[\\.…]+\\s*$", "").trim();
        String cleanTitle = TextCleaner.cleanText(rawTitle);
        if (cleanTitle.isBlank()) return null;

        // Product URL
        String prodUrl = "";
        if (titleEl != null && !titleEl.attr("href").isBlank()) {
            prodUrl = resolveUrl(baseUrl, titleEl.attr("href"));
        } else {
            Element a = card.select("a.thumbnail").first();
            if (a != null && !a.attr("href").isBlank()) {
                prodUrl = resolveUrl(baseUrl, a.attr("href"));
            }
        }

        // ISBN / EAN
        String isbn = "";
        if (!prodUrl.isBlank()) {
            Matcher m = RE_URL_ISBN.matcher(prodUrl);
            if (m.find()) {
                isbn = m.group(1);
            }
        }
        if (isbn.isBlank()) {
            Matcher m = RE_ISBN_ANY.matcher(card.text());
            if (m.find()) {
                isbn = m.group(1).replaceAll("[^0-9Xx]", "");
            }
        }

        // Price
        Integer price = 0;
        Element priceEl = card.select("span.price, .product-price-and-shipping .price").first();
        if (priceEl != null) {
            Matcher pm = RE_PRICE.matcher(priceEl.text().replace("\u00a0", " ").trim());
            if (pm.find()) {
                try {
                    price = (int) Math.round(Double.parseDouble(pm.group(1).replace(',', '.')));
                } catch (Exception ignored) {}
            }
        }

        // Cover
        String coverUrl = "";
        if (imgTag != null) {
            String src = imgTag.attr("data-full-size-image-url");
            if (src.isBlank()) src = imgTag.attr("src");
            if (src.isBlank()) src = imgTag.attr("data-src");
            if (!src.isBlank() && !src.contains("default-home_default") && !src.contains("/assets/")) {
                src = src.replace("home_default", "large_default");
                coverUrl = resolveUrl(baseUrl, src.split("\\?")[0]);
            }
        }

        // Release date
        LocalDate releaseDate = null;
        Element dateEl = card.select(".date-btn, .product-date, .release-date").first();
        if (dateEl != null) {
            Matcher dm = RE_DATE.matcher(dateEl.text());
            if (dm.find()) {
                try {
                    int d = Integer.parseInt(dm.group(1));
                    int m = Integer.parseInt(dm.group(2));
                    int y = Integer.parseInt(dm.group(3));
                    releaseDate = LocalDate.of(y, m, d);
                } catch (Exception ignored) {}
            }
        }

        // Series & Volume
        VariantDetector.SeriesVolume sv = VariantDetector.extractCanonicalSeriesAndVolume(cleanTitle);
        String seriesName = sv.series().isBlank() ? cleanTitle : sv.series();
        Integer volume = sv.volume();

        return ScrapedBookDTO.builder()
                .title(TextCleaner.truncate(cleanTitle, 255))
                .seriesName(TextCleaner.truncate(seriesName, 255))
                .volume(volume)
                .isbn(isbn)
                .editorName("Panini Comics")
                .categoryName("Comics")
                .pageCount(0)
                .price(price)
                .description(String.format("Édition Panini Comics: %s", cleanTitle))
                .coverUrl(coverUrl)
                .releaseDate(releaseDate)
                .bookType("Comics")
                .sourceUrl(prodUrl)
                .build();
    }

    public static String extractNextPageUrl(Document doc, String currentUrl) {
        if (doc == null) return null;
        Element nextLink = doc.select("nav.pagination a[rel='next'], nav.pagination a.next, a.next.js-search-link, a[rel='next']").first();
        if (nextLink != null) {
            String href = nextLink.attr("href");
            if (href != null && !href.isBlank()) {
                return resolveUrl(currentUrl, href);
            }
        }
        return null;
    }

    private static String resolveUrl(String base, String rel) {
        if (rel == null || rel.isBlank()) return base;
        if (rel.startsWith("http://") || rel.startsWith("https://")) return rel;
        try {
            return URI.create(base).resolve(rel).toString();
        } catch (Exception e) {
            return rel;
        }
    }
}
