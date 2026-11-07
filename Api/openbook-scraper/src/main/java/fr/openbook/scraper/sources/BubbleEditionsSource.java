package fr.openbook.scraper.sources;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fr.openbook.scraper.config.ScraperProperties;
import fr.openbook.scraper.model.ScanOptions;
import fr.openbook.scraper.model.ScrapedAuthorDTO;
import fr.openbook.scraper.model.ScrapedBookDTO;
import fr.openbook.scraper.utils.FrenchDateParser;
import fr.openbook.scraper.utils.TextCleaner;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.*;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Scraper source for Bubble Éditions (https://www.bubble-editions.com).
 * Scrapes:
 * 1. Catalogue / Nos ouvrages: https://www.bubble-editions.com/nos-ouvrages
 * 2. À paraître: https://www.bubble-editions.com/a-paraitre
 */
@Slf4j
@Component
public class BubbleEditionsSource extends AbstractHttpSource {

    private static final String BASE_URL = "https://www.bubble-editions.com";
    private static final String CATALOGUE_URL = BASE_URL + "/nos-ouvrages";
    private static final String A_PARAITRE_URL = BASE_URL + "/a-paraitre";

    private static final Pattern RE_PRICE = Pattern.compile("([0-9]+(?:[.,][0-9]{1,2})?)\\s*(?:€|EUR)");
    private static final Pattern RE_ISBN = Pattern.compile("(?i)(?:ISBN|EAN)\\s*:?\\s*([0-9Xx\\- ]{10,20})");
    private static final Pattern RE_PAGES = Pattern.compile("(?i)Nombre de pages\\s*:?\\s*([0-9]+)");
    private static final Pattern RE_DATE = Pattern.compile("(?i)(?:Date de parution|Parution|Sortie)\\s*:?\\s*([0-9]{1,2}\\s+[a-zA-ZÀ-ÿ]+\\s+[0-9]{4}|[a-zA-ZÀ-ÿ]+\\s+[0-9]{4}|[0-9]{1,2}/[0-9]{1,2}/[0-9]{4})");
    private static final Pattern RE_AUTHORS = Pattern.compile("(?i)Auteurs?\\s*:?\\s*([^<\\n\\r]+?)(?=\\s+Editeur|\\s+Date|\\s+N°|\\s+Nombre|$)");
    private static final Pattern RE_FORMAT = Pattern.compile("(?i)Format\\s*:?\\s*([^<\\n\\r]+?)(?=\\s+Auteurs|\\s+Editeur|\\s+Date|$)");
    private static final Pattern RE_VOL = Pattern.compile("(?i)\\b(?:tome|t\\.?|volume|vol\\.?)\\s*(\\d+)\\b");
    private static final Pattern RE_VOL_STRIP = Pattern.compile("(?i)\\s*[-–—]?\\s*\\b(?:tome|t\\.?|volume|vol\\.?)\\s*\\d+\\b.*");

    private final ObjectMapper objectMapper = new ObjectMapper();

    public BubbleEditionsSource(ScraperProperties properties) {
        super(properties);
    }

    @Override
    public String getId() {
        return "bubble_editions";
    }

    @Override
    public String getName() {
        return "Bubble Editions";
    }

    @Override
    public String getDescription() {
        return "Catalogue et nouveautés à paraître de Bubble Éditions";
    }

    @Override
    public String getColor() {
        return "#0ea5e9"; // Sky blue
    }

    @Override
    public List<ScrapedBookDTO> scrape(
            ScanOptions options,
            Consumer<ScrapedBookDTO> onBookFound,
            BooleanSupplier isStopped
    ) {
        int maxItems = options.getMaxItems() > 0 ? options.getMaxItems() : properties.getMaxBooksPerSource();
        boolean fullScan = options.isFullScan();
        List<ScrapedBookDTO> results = new ArrayList<>();
        Set<String> processedUrls = new HashSet<>();

        log.info("[BubbleEditions] Starting scrape (fullScan={}, maxItems={})", fullScan, maxItems);

        // 1. Scrape 'à paraître' list items
        List<ScrapedBookDTO> aParaitreBooks = scrapeAParaitre(isStopped);
        for (ScrapedBookDTO b : aParaitreBooks) {
            if (isStopped != null && isStopped.getAsBoolean()) break;
            if (!fullScan && results.size() >= maxItems) break;

            results.add(b);
            if (onBookFound != null) {
                onBookFound.accept(b);
            }
        }

        // 2. Scrape 'nos ouvrages' catalogue links
        List<String> catalogueLinks = collectCatalogueLinks(isStopped);
        log.info("[BubbleEditions] Found {} book links in catalogue", catalogueLinks.size());

        for (String url : catalogueLinks) {
            if (isStopped != null && isStopped.getAsBoolean()) {
                log.info("[BubbleEditions] Stop requested");
                break;
            }
            if (!fullScan && results.size() >= maxItems) {
                break;
            }
            if (!processedUrls.add(url)) {
                continue;
            }

            try {
                ScrapedBookDTO book = scrapeBookPage(url);
                if (book != null) {
                    results.add(book);
                    if (onBookFound != null) {
                        onBookFound.accept(book);
                    }
                }
            } catch (Exception e) {
                log.warn("[BubbleEditions] Error scraping book page {}: {}", url, e.getMessage());
            }

            try {
                Thread.sleep(100);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }

        log.info("[BubbleEditions] Finished scrape. Total scraped books: {}", results.size());
        return results;
    }

    private List<String> collectCatalogueLinks(BooleanSupplier isStopped) {
        List<String> links = new ArrayList<>();
        Set<String> seen = new HashSet<>();

        Document doc = fetchDocument(CATALOGUE_URL);
        if (doc == null) {
            return links;
        }

        for (Element a : doc.select("a[href]")) {
            if (isStopped != null && isStopped.getAsBoolean()) break;
            String href = a.absUrl("href").trim();
            if (href.isEmpty() || !href.startsWith(BASE_URL)) continue;

            // Normalize path
            String path = href.substring(BASE_URL.length());
            int qIdx = path.indexOf('?');
            if (qIdx >= 0) path = path.substring(0, qIdx);
            int hIdx = path.indexOf('#');
            if (hIdx >= 0) path = path.substring(0, hIdx);

            if (path.isEmpty() || path.equals("/") || path.equals("/nos-ouvrages") || path.equals("/a-paraitre")
                    || path.equals("/presse") || path.equals("/a-propos") || path.equals("/a-propos-1")
                    || path.equals("/contact") || path.equals("/cart") || path.equals("/acceuil")
                    || path.equals("/mentions-legales")) {
                continue;
            }

            String fullBookUrl = BASE_URL + path;
            if (seen.add(fullBookUrl)) {
                links.add(fullBookUrl);
            }
        }

        return links;
    }

    public List<ScrapedBookDTO> scrapeAParaitre(BooleanSupplier isStopped) {
        List<ScrapedBookDTO> list = new ArrayList<>();
        Document doc = fetchDocument(A_PARAITRE_URL);
        if (doc == null) return list;

        Element container = doc.selectFirst(".user-items-list-item-container[data-current-context]");
        if (container != null && container.hasAttr("data-current-context")) {
            try {
                JsonNode root = objectMapper.readTree(container.attr("data-current-context"));
                JsonNode userItems = root.path("userItems");
                if (userItems.isArray()) {
                    for (JsonNode item : userItems) {
                        if (isStopped != null && isStopped.getAsBoolean()) break;
                        String title = item.path("title").asText("").trim();
                        if (title.isEmpty()) continue;

                        String descHtml = item.path("description").asText("");
                        String descText = TextCleaner.cleanText(descHtml.replaceAll("<[^>]+>", " "));

                        // Parse author & release date from description
                        List<ScrapedAuthorDTO> authors = new ArrayList<>();
                        Matcher authM = Pattern.compile("(?i)De\\s+([^\\n\\r]+?)(?=\\s*\\b(?:Janvier|Février|Mars|Avril|Mai|Juin|Juillet|Août|Septembre|Octobre|Novembre|Décembre|\\d{4})|$)").matcher(descText);
                        if (authM.find()) {
                            String authStr = authM.group(1).trim();
                            for (String a : authStr.split("(?i)\\s+(?:et|,)\\s+")) {
                                addAuthorIfValid(authors, a.trim(), "Writer");
                            }
                        }

                        LocalDate relDate = null;
                        Matcher dateM = Pattern.compile("(?i)\\b(Janvier|Février|Mars|Avril|Mai|Juin|Juillet|Août|Septembre|Octobre|Novembre|Décembre)\\s+(\\d{4})\\b").matcher(descText);
                        if (dateM.find()) {
                            relDate = FrenchDateParser.parse(dateM.group(0));
                        }

                        String coverUrl = item.path("image").path("assetUrl").asText(null);
                        if (coverUrl == null || coverUrl.isBlank()) {
                            coverUrl = item.path("assetUrl").asText(null);
                        }

                        String seriesName = title;
                        Integer volume = null;
                        Matcher volMatcher = RE_VOL.matcher(title);
                        if (volMatcher.find()) {
                            try { volume = Integer.parseInt(volMatcher.group(1)); } catch (Exception ignored) {}
                            seriesName = RE_VOL_STRIP.matcher(title).replaceAll("").trim();
                        }

                        ScrapedBookDTO dto = ScrapedBookDTO.builder()
                                .title(TextCleaner.truncate(title, 255))
                                .seriesName(TextCleaner.truncate(seriesName, 255))
                                .volume(volume)
                                .editorName("Bubble Editions")
                                .categoryName("Bande dessinée")
                                .bookType("Cartonné")
                                .coverUrl(coverUrl)
                                .releaseDate(relDate)
                                .authors(authors)
                                .description(descText)
                                .sourceUrl(A_PARAITRE_URL)
                                .build();
                        list.add(dto);
                    }
                }
            } catch (Exception e) {
                log.warn("[BubbleEditions] Error parsing JSON context from a-paraitre: {}", e.getMessage());
            }
        }

        return list;
    }

    public ScrapedBookDTO scrapeBookPage(String url) {
        Document doc = fetchDocument(url);
        if (doc == null) return null;

        // 1. Title
        String rawTitle = "";
        Element ogTitle = doc.selectFirst("meta[property='og:title']");
        if (ogTitle != null && !ogTitle.attr("content").isBlank()) {
            rawTitle = ogTitle.attr("content").replaceAll("—.*$", "").trim();
        }
        if (rawTitle.isEmpty()) {
            Element h1 = doc.selectFirst("h1");
            if (h1 != null) {
                rawTitle = h1.text().trim();
            }
        }
        rawTitle = TextCleaner.cleanText(rawTitle);
        if (rawTitle.isEmpty()) {
            return null;
        }

        // 2. Description & Full text
        String description = "";
        List<Element> contentBlocks = doc.select("div.sqs-html-content");
        for (Element block : contentBlocks) {
            String bt = block.text().trim();
            if (bt.length() > 60 && !bt.contains("Caractéristiques") && !bt.contains("Bubble - Tous droits") && !bt.contains("Mentions légales")) {
                if (description.isEmpty() || bt.length() > description.length()) {
                    description = TextCleaner.cleanText(bt);
                }
            }
        }

        // 3. Metadata from Caractéristiques block or full doc
        String metaText = "";
        for (Element block : contentBlocks) {
            String bt = block.text();
            if (bt.contains("Auteurs") || bt.contains("ISBN") || bt.contains("Date de parution") || bt.contains("Nombre de pages")) {
                metaText = bt;
                break;
            }
        }
        if (metaText.isEmpty()) {
            metaText = doc.text();
        }

        // ISBN
        String isbn = null;
        Matcher isbnM = RE_ISBN.matcher(metaText);
        if (isbnM.find()) {
            isbn = isbnM.group(1).replaceAll("[^0-9Xx]", "");
        } else {
            Matcher rawIsbnM = Pattern.compile("(97[89][0-9Xx\\- ]{10,18})").matcher(metaText);
            if (rawIsbnM.find()) {
                isbn = rawIsbnM.group(1).replaceAll("[^0-9Xx]", "");
            }
        }

        // Price
        Integer price = null;
        Matcher priceM = RE_PRICE.matcher(doc.text());
        if (priceM.find()) {
            try {
                price = (int) Math.round(Double.parseDouble(priceM.group(1).replace(',', '.')));
            } catch (Exception ignored) {}
        }

        // Pages
        Integer pageCount = null;
        Matcher pagesM = RE_PAGES.matcher(metaText);
        if (pagesM.find()) {
            try {
                pageCount = Integer.parseInt(pagesM.group(1));
            } catch (Exception ignored) {}
        }

        // Release date
        LocalDate releaseDate = null;
        Matcher dateM = RE_DATE.matcher(metaText);
        if (dateM.find()) {
            releaseDate = FrenchDateParser.parse(dateM.group(1));
        }

        // Authors
        List<ScrapedAuthorDTO> authors = new ArrayList<>();
        Matcher authM = RE_AUTHORS.matcher(metaText);
        if (authM.find()) {
            String aStr = authM.group(1).trim();
            for (String aName : aStr.split("(?i)\\s+(?:et|&)\\s+|,\\s*")) {
                addAuthorIfValid(authors, aName.trim(), "Writer");
            }
        }

        // Cover URL
        // In Squarespace, the book cover is inside the first image block (.sqs-block-image img)
        String coverUrl = null;
        for (Element img : doc.select(".sqs-block-image img[data-src], .sqs-block-image img[data-image], .sqs-block-image img[src]")) {
            String src = img.hasAttr("data-src") && !img.attr("data-src").isBlank()
                    ? img.attr("data-src")
                    : (img.hasAttr("data-image") && !img.attr("data-image").isBlank() ? img.attr("data-image") : img.attr("src"));
            if (src != null && !src.isBlank() && !src.contains("logo")) {
                coverUrl = src;
                break;
            }
        }
        if (coverUrl == null) {
            for (Element img : doc.select("img[elementtiming='system-image-block']")) {
                String src = img.hasAttr("data-src") && !img.attr("data-src").isBlank()
                        ? img.attr("data-src")
                        : (img.hasAttr("data-image") && !img.attr("data-image").isBlank() ? img.attr("data-image") : img.attr("src"));
                if (src != null && !src.isBlank() && !src.contains("logo")) {
                    coverUrl = src;
                    break;
                }
            }
        }
        if (coverUrl == null) {
            for (Element img : doc.select("img")) {
                String src = img.hasAttr("data-src") ? img.attr("data-src") : img.attr("src");
                if (src != null && !src.contains("logo") && !src.contains("nbf-background") && (src.contains("Cover") || src.contains("couv") || src.contains("content/v1/"))) {
                    coverUrl = src;
                    break;
                }
            }
        }
        if (coverUrl == null) {
            Element ogImg = doc.selectFirst("meta[property='og:image']");
            if (ogImg != null) {
                coverUrl = ogImg.attr("content");
            }
        }

        // Series & Volume
        String seriesName = rawTitle;
        Integer volume = null;
        Matcher volMatcher = RE_VOL.matcher(rawTitle);
        if (volMatcher.find()) {
            try {
                volume = Integer.parseInt(volMatcher.group(1));
            } catch (Exception ignored) {}
            seriesName = RE_VOL_STRIP.matcher(rawTitle).replaceAll("").trim();
            seriesName = seriesName.replaceAll("^[ :\\-]+|[ :\\-]+$", "").trim();
        }

        return ScrapedBookDTO.builder()
                .title(TextCleaner.truncate(rawTitle, 255))
                .seriesName(TextCleaner.truncate(seriesName, 255))
                .volume(volume)
                .isbn(isbn)
                .editorName("Bubble Editions")
                .categoryName("Bande dessinée")
                .pageCount(pageCount)
                .price(price)
                .description(description)
                .coverUrl(coverUrl)
                .releaseDate(releaseDate)
                .bookType("Cartonné")
                .authors(authors)
                .sourceUrl(url)
                .build();
    }

    private void addAuthorIfValid(List<ScrapedAuthorDTO> authors, String fullName, String role) {
        if (fullName == null || fullName.isBlank() || fullName.equalsIgnoreCase("Bubble") || fullName.equalsIgnoreCase("Matagot")) {
            return;
        }
        String[] split = TextCleaner.splitAuthorName(fullName);
        if (split[1] != null && !split[1].isBlank()) {
            authors.add(new ScrapedAuthorDTO(split[0], split[1], role));
        }
    }
}
