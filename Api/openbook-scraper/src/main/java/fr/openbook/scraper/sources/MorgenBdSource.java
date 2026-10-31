package fr.openbook.scraper.sources;

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
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Component
public class MorgenBdSource extends AbstractHttpSource {

    private static final String BASE_URL = "https://www.morgen-bd.com";
    private static final Pattern RE_ALBUM_HREF = Pattern.compile("href=[\"'](/livres/[^\"']+)[\"']");
    private static final Pattern RE_ISBN = Pattern.compile("(97[89][-\\s0-9]{10,15})");
    private static final Pattern RE_PRICE = Pattern.compile("(?i)prix\\s*:\\s*([0-9]+)[,\\.]([0-9]+)\\s*€");
    private static final Pattern RE_PAGES = Pattern.compile("(?i)numérique\\s*:\\s*([0-9]+)");
    private static final Pattern RE_DATE = Pattern.compile("(?i)parution\\s*([0-9]{2}/[0-9]{2}/[0-9]{4})");
    private static final Pattern RE_AUTHOR = Pattern.compile("Black Orion([A-Za-zÀ-ÿ\\s]+)prix");
    private static final Pattern RE_VOL = Pattern.compile("(?i)tome\\s*(\\d+)");
    private static final Pattern RE_VOL_STRIP = Pattern.compile("(?i)tome\\s*\\d+.*");

    public MorgenBdSource(ScraperProperties properties) {
        super(properties);
    }

    @Override
    public String getId() {
        return "morgen_bd";
    }

    @Override
    public String getName() {
        return "Morgen BD";
    }

    @Override
    public String getDescription() {
        return "Boutique & nouveautés indés Morgen";
    }

    @Override
    public String getColor() {
        return "#8b5cf6";
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

        String listingUrl = BASE_URL + "/nos-albums";
        log.info("[MorgenBD] Fetching listing {}", listingUrl);
        String body = fetchString(listingUrl);
        if (body == null || body.isBlank()) {
            return results;
        }

        Matcher matcher = RE_ALBUM_HREF.matcher(body);
        Set<String> seen = new HashSet<>();
        List<String> paths = new ArrayList<>();
        while (matcher.find()) {
            String path = matcher.group(1);
            if (seen.add(path)) {
                paths.add(path);
            }
        }
        Collections.sort(paths);
        log.info("[MorgenBD] Found {} album links", paths.size());

        for (String relPath : paths) {
            if (isStopped != null && isStopped.getAsBoolean()) {
                break;
            }
            if (!fullScan && results.size() >= maxItems) {
                break;
            }

            String bookUrl = BASE_URL + relPath;
            ScrapedBookDTO book = scrapeBookPage(bookUrl);
            if (book != null) {
                results.add(book);
                if (onBookFound != null) {
                    onBookFound.accept(book);
                }
            }
        }

        log.info("[MorgenBD] Scrape completed: {} books", results.size());
        return results;
    }

    private ScrapedBookDTO scrapeBookPage(String url) {
        Document doc = fetchDocument(url);
        if (doc == null) {
            return null;
        }

        // 1. Title
        String title = "";
        for (Element h : doc.select("h1, h2")) {
            String t = h.text().trim();
            String low = t.toLowerCase();
            if (!t.isBlank() && !low.contains("résumé") && !low.contains("documentaire")
                    && !low.contains("auteurs") && !low.contains("découvrir")
                    && !low.contains("série") && !low.contains("morgen")) {
                title = TextCleaner.cleanText(t);
                break;
            }
        }
        if (title.isBlank()) {
            String slug = url.substring(url.lastIndexOf('/') + 1);
            title = TextCleaner.titleCase(slug.replace('-', ' '));
        }

        // 2. Cover image
        String coverUrl = "";
        for (Element img : doc.select("img")) {
            String src = img.attr("src");
            String low = src.toLowerCase();
            if (src.contains("CV_") || low.contains("couv") || src.contains("website-files.com")) {
                if (!low.contains("favicon") && !low.contains("icon") && !low.contains("logo")
                        && !low.contains("whatssap") && !low.contains("facebook")) {
                    coverUrl = src;
                    break;
                }
            }
        }

        // 3. Text metadata
        String fullText = doc.text();

        String isbn = "";
        Matcher isbnMatcher = RE_ISBN.matcher(fullText);
        if (isbnMatcher.find()) {
            isbn = isbnMatcher.group(1).replaceAll("[-\\s]", "");
        }

        int price = 0;
        Matcher priceMatcher = RE_PRICE.matcher(fullText);
        if (priceMatcher.find()) {
            try {
                price = Integer.parseInt(priceMatcher.group(1));
            } catch (NumberFormatException ignored) {}
        }

        int pageCount = 0;
        Matcher pagesMatcher = RE_PAGES.matcher(fullText);
        if (pagesMatcher.find()) {
            try {
                pageCount = Integer.parseInt(pagesMatcher.group(1));
            } catch (NumberFormatException ignored) {}
        }

        LocalDate releaseDate = null;
        Matcher dateMatcher = RE_DATE.matcher(fullText);
        if (dateMatcher.find()) {
            releaseDate = FrenchDateParser.parse(dateMatcher.group(1));
        }
        

        // 4. Description
        String description = "";
        for (Element p : doc.select("p")) {
            String t = p.text().trim();
            String low = t.toLowerCase();
            if (t.length() > 60 && !low.contains("cookie") && !low.contains("droits réservés") && !low.contains("newsletter")) {
                description = TextCleaner.cleanText(t);
                break;
            }
        }

        // 5. Authors
        List<ScrapedAuthorDTO> authors = new ArrayList<>();
        Matcher authMatcher = RE_AUTHOR.matcher(fullText);
        if (authMatcher.find()) {
            String name = authMatcher.group(1).trim();
            String[] split = TextCleaner.splitAuthorName(name);
            if (!split[1].isBlank()) {
                authors.add(new ScrapedAuthorDTO(split[0], split[1], "Writer"));
            }
        }

        // 6. Series & Volume
        String seriesName = title;
        Integer volume = null;
        Matcher volMatcher = RE_VOL.matcher(title);
        if (volMatcher.find()) {
            try {
                volume = Integer.parseInt(volMatcher.group(1));
            } catch (NumberFormatException ignored) {}
            seriesName = RE_VOL_STRIP.matcher(title).replaceAll("").replaceAll("^[ :\\-]+|[ :\\-]+$", "").trim();
        }

        return ScrapedBookDTO.builder()
                .title(TextCleaner.truncate(title, 255))
                .seriesName(TextCleaner.truncate(seriesName, 255))
                .volume(volume)
                .isbn(isbn)
                .editorName("Morgen BD")
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
}
