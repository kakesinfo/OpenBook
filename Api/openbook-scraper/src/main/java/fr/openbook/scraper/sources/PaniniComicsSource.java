package fr.openbook.scraper.sources;

import fr.openbook.scraper.config.ScraperProperties;
import fr.openbook.scraper.model.ScanOptions;
import fr.openbook.scraper.model.ScrapedBookDTO;
import fr.openbook.scraper.utils.FrenchDateParser;
import fr.openbook.scraper.utils.TextCleaner;
import fr.openbook.scraper.utils.VariantDetector;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.*;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Component
public class PaniniComicsSource extends AbstractHttpSource {

    public static final List<String> CATALOG_URLS = List.of(
            "https://www.panini.fr/shp_fra_fr/comics/marvel.html",
            "https://www.panini.fr/shp_fra_fr/comics/star-wars.html",
            "https://www.panini.fr/shp_fra_fr/comics/disney.html",
            "https://www.panini.fr/shp_fra_fr/comics/autres-comics.html"
    );

    private static final Pattern RE_JS_REDIRECT = Pattern.compile("decodeURIComponent\\(['\"]([^'\"]+)['\"]\\)");
    private static final Pattern RE_ALT_PREFIX = Pattern.compile("(?i)^Panini:\\s*Comics[_\\s]*");
    private static final Pattern RE_PRICE = Pattern.compile("(\\d+)[,\\.]\\d+");
    private static final Pattern RE_VAR_URL = Pattern.compile("(?i)-[a-zA-Z0-9]+v-[a-zA-Z0-9]+\\.html");
    private static final Pattern RE_ISBN13 = Pattern.compile("(97[89]\\d{10})");

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
        return "Marvel, Star Wars, Disney, Autres Comics";
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
        Set<String> seenTitles = new HashSet<>();
        Set<String> seenUrls = new HashSet<>();

        for (String categoryUrl : CATALOG_URLS) {
            if (isStopped != null && isStopped.getAsBoolean()) break;
            if (!fullScan && books.size() >= maxItems) break;

            String currentPageUrl = categoryUrl;
            Set<String> visitedPages = new HashSet<>();

            while (currentPageUrl != null && !currentPageUrl.isBlank()) {
                if (isStopped != null && isStopped.getAsBoolean()) break;
                if (!fullScan && books.size() >= maxItems) break;
                if (!visitedPages.add(currentPageUrl)) break;

                log.info("[Panini] Fetching listing {}", currentPageUrl);
                String html = fetchPageHtml(currentPageUrl);
                if (html == null || html.isBlank()) {
                    break;
                }

                Document doc = Jsoup.parse(html, currentPageUrl);
                Elements cards = doc.select("li.item.product.product-item");
                if (cards.isEmpty()) {
                    cards = doc.select("div.product-item-info");
                }

                for (Element card : cards) {
                    if (isStopped != null && isStopped.getAsBoolean()) break;
                    if (!fullScan && books.size() >= maxItems) break;

                    ScrapedBookDTO book = parseCard(card, currentPageUrl);
                    if (book == null) continue;

                    if (seenTitles.contains(book.getTitle()) || (book.getSourceUrl() != null && seenUrls.contains(book.getSourceUrl()))) {
                        continue;
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
            }
        }

        log.info("[Panini] Finished scraping: {} books", books.size());
        return books;
    }

    private String fetchPageHtml(String targetUrl) {
        String currentUrl = targetUrl;
        for (int i = 0; i < 5; i++) {
            String content = fetchString(currentUrl);
            if (content == null) return null;

            Matcher m = RE_JS_REDIRECT.matcher(content);
            if (m.find()) {
                try {
                    String redirectPath = URLDecoder.decode(m.group(1), StandardCharsets.UTF_8);
                    currentUrl = resolveUrl(currentUrl, redirectPath);
                    continue;
                } catch (Exception ignored) {}
            }
            return content;
        }
        return null;
    }

    public ScrapedBookDTO parseCard(Element card, String baseUrl) {
        String rawTitle = "";
        String prodUrl = "";

        for (Element a : card.select("a[href]")) {
            String t = a.text().trim();
            String low = t.toLowerCase();
            if (!t.isBlank() && !low.contains("liste d") && !low.contains("panier")
                    && !low.contains("aperçu") && !low.contains("voir")) {
                rawTitle = t;
                String href = a.attr("href");
                prodUrl = resolveUrl(baseUrl, href);
                break;
            }
        }

        if (rawTitle.isBlank()) {
            Element img = card.select("img").first();
            if (img != null) {
                String alt = img.attr("alt");
                if (!alt.isBlank()) {
                    rawTitle = RE_ALT_PREFIX.matcher(alt).replaceAll("").trim();
                }
            }
        }

        if (rawTitle.isBlank()) return null;

        String cleanTitle = TextCleaner.cleanText(rawTitle);
        if (cleanTitle.isBlank()) return null;

        // Price
        int price = 0;
        Element priceEl = card.select("span.price").first();
        if (priceEl != null) {
            Matcher pm = RE_PRICE.matcher(priceEl.text());
            if (pm.find()) {
                try {
                    price = Integer.parseInt(pm.group(1));
                } catch (NumberFormatException ignored) {}
            }
        }

        // Cover
        String coverUrl = "";
        Element imgTag = card.select("img.product-image-photo, img[class*='product-image-photo']").first();
        if (imgTag == null) imgTag = card.select("img").first();
        if (imgTag != null) {
            String src = imgTag.attr("src");
            if (src.isBlank()) src = imgTag.attr("data-src");
            if (!src.isBlank()) {
                coverUrl = src.split("\\?")[0];
            }
        }

        // SKU
        String skuVal = "";
        Element skuEl = card.select("[data-product-sku]").first();
        if (skuEl != null) {
            skuVal = skuEl.attr("data-product-sku").trim();
        }

        // Variant detection
        boolean isVariant = VariantDetector.isVariantBook(cleanTitle, coverUrl, skuVal);
        if (!isVariant && !prodUrl.isBlank() && RE_VAR_URL.matcher(prodUrl).find()) {
            isVariant = true;
        }

        if (isVariant && !VariantDetector.isVariantTitle(cleanTitle)) {
            cleanTitle = cleanTitle + " - Edition collector";
        }

        // Series & Volume
        VariantDetector.SeriesVolume sv = VariantDetector.extractCanonicalSeriesAndVolume(cleanTitle);
        String seriesName = sv.series().isBlank() ? cleanTitle : sv.series();
        Integer volume = sv.volume();

        // Release date
        LocalDate releaseDate = null;
        Element dateEl = card.select(".product-item-attribute-release-date small, .product-item-attribute-release-date").first();
        if (dateEl != null) {
            releaseDate = FrenchDateParser.parse(dateEl.text().trim());
        }
        

        // ISBN
        String isbn = "";
        if (!prodUrl.isBlank()) {
            Matcher im = RE_ISBN13.matcher(prodUrl);
            if (im.find()) {
                isbn = im.group(1);
            }
        }
        if (isbn.isBlank() && !skuVal.isBlank()) {
            Matcher im = RE_ISBN13.matcher(skuVal);
            if (im.find()) {
                isbn = im.group(1);
            }
        }

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
                .isVariant(isVariant)
                .build();
    }

    public static String extractNextPageUrl(Document doc, String currentUrl) {
        Elements items = doc.select("div.pages ul.pages-items li.item");
        if (items.isEmpty()) return null;

        for (Element item : items) {
            if (item.hasClass("pages-item-next")) {
                Element a = item.select("a[href]").first();
                if (a != null && !a.attr("href").isBlank()) {
                    return resolveUrl(currentUrl, a.attr("href"));
                }
            }

            Element aNext = item.select("a.next").first();
            if (aNext != null && !aNext.attr("href").isBlank()) {
                return resolveUrl(currentUrl, aNext.attr("href"));
            }

            String txt = item.text().trim().toLowerCase();
            if (txt.contains("suivant") || txt.contains("next")) {
                Element a = item.select("a[href]").first();
                if (a != null && !a.attr("href").isBlank()) {
                    return resolveUrl(currentUrl, a.attr("href"));
                }
            }
        }

        // Fallback: item after 'current'
        boolean foundCurrent = false;
        for (Element item : items) {
            if (item.hasClass("current")) {
                foundCurrent = true;
                continue;
            }
            if (foundCurrent && !item.hasClass("pages-item-previous")) {
                Element a = item.select("a[href]").first();
                if (a != null && !a.attr("href").isBlank()) {
                    return resolveUrl(currentUrl, a.attr("href"));
                }
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
