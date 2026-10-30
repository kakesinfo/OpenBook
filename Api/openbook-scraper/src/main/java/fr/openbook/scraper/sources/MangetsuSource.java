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

import java.net.URI;
import java.time.LocalDate;
import java.util.*;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Component
public class MangetsuSource extends AbstractHttpSource {

    private static final String BASE_URL = "https://mangetsu-manga.fr";
    private static final Pattern RE_CAT_LINK = Pattern.compile("/catalogue/978\\d+");
    private static final Pattern RE_CAT_ISBN = Pattern.compile("/catalogue/(978\\d{10})");
    private static final Pattern RE_PAGE_PARAM = Pattern.compile("[?&]page=(\\d+)");
    private static final Pattern RE_PAGE_STRIP = Pattern.compile("[?&]page=\\d+");
    private static final Pattern RE_SLUG_NUM_STRIP = Pattern.compile("^\\d+-");
    private static final Pattern RE_ISBN = Pattern.compile("(978[-\\s0-9]{10,15})");
    private static final Pattern RE_PAGES = Pattern.compile("(?i)Nombre de pages\\s*([0-9]+)");
    private static final Pattern RE_PARUTION = Pattern.compile("(?i)Parution\\s*:\\s*([^<\\n\\r]+)");
    private static final Pattern RE_PRICE = Pattern.compile("(\\d+)[,.]?(\\d+)?");
    private static final Pattern RE_VOL = Pattern.compile("(?i)T(?:ome|\\.)?\\s*0?(\\d+)");
    private static final Pattern RE_VOL_STRIP = Pattern.compile("(?i)T(?:ome)?\\s*0?\\d+.*");

    private record CardHint(String dateStr, String title, String tome, String authorStr, String coverUrl) {}

    public MangetsuSource(ScraperProperties properties) {
        super(properties);
    }

    @Override
    public String getId() {
        return "mangetsu";
    }

    @Override
    public String getName() {
        return "Mangetsu";
    }

    @Override
    public String getDescription() {
        return "Mangas seinen, shonen & nouveautés japonaises";
    }

    @Override
    public String getColor() {
        return "#f59e0b";
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

        Set<String> seenLinks = new HashSet<>();
        List<String> productLinks = new ArrayList<>();
        Map<String, CardHint> cardHints = new HashMap<>();

        List<String> startUrls = List.of(BASE_URL + "/a-paraitre/", BASE_URL + "/catalogue/");
        log.info("[Mangetsu] Starting listing crawl (fullScan={}, maxItems={})", fullScan, maxItems);

        for (String startUrl : startUrls) {
            if (isStopped != null && isStopped.getAsBoolean()) break;
            if (!fullScan && productLinks.size() >= maxItems) break;

            String currentUrl = startUrl;
            Set<String> visitedPages = new HashSet<>();

            while (currentUrl != null && !currentUrl.isBlank() && visitedPages.add(currentUrl)) {
                if (isStopped != null && isStopped.getAsBoolean()) break;
                if (!fullScan && productLinks.size() >= maxItems) break;

                log.info("[Mangetsu] Fetching listing page: {}", currentUrl);
                Document doc = fetchDocument(currentUrl);
                if (doc == null) break;

                // Extract card hints
                for (Element card : doc.select(".book-card")) {
                    String href = card.attr("href");
                    if (RE_CAT_LINK.matcher(href).find()) {
                        String fullUrl = resolveUrl(BASE_URL, href);
                        if (seenLinks.add(fullUrl)) {
                            productLinks.add(fullUrl);
                        }

                        Element dEl = card.select(".book-card__date").first();
                        Element tEl = card.select(".book-card__title").first();
                        Element tmEl = card.select(".book-card__tome").first();
                        Element aEl = card.select(".book-card__author").first();
                        Element imgEl = card.select(".book-card__img").first();

                        cardHints.put(fullUrl, new CardHint(
                                dEl != null ? TextCleaner.cleanText(dEl.text()) : "",
                                tEl != null ? TextCleaner.cleanText(tEl.text()) : "",
                                tmEl != null ? TextCleaner.cleanText(tmEl.text()) : "",
                                aEl != null ? TextCleaner.cleanText(aEl.text()) : "",
                                imgEl != null ? imgEl.attr("src") : ""
                        ));

                        if (!fullScan && productLinks.size() >= maxItems) {
                            break;
                        }
                    }
                }

                currentUrl = extractNextPageUrl(doc, currentUrl, visitedPages);
            }
        }

        log.info("[Mangetsu] Found {} product pages to scrape", productLinks.size());

        for (String prodUrl : productLinks) {
            if (isStopped != null && isStopped.getAsBoolean()) break;

            CardHint hint = cardHints.get(prodUrl);
            ScrapedBookDTO book = scrapeBookPage(prodUrl, hint);
            if (book != null) {
                books.add(book);
                if (onBookFound != null) {
                    onBookFound.accept(book);
                }
            }
        }

        log.info("[Mangetsu] Finished: {} books", books.size());
        return books;
    }

    private String extractNextPageUrl(Document doc, String currentUrl, Set<String> visitedPages) {
        Element pagination = doc.select("div.pagination").first();
        if (pagination == null) return null;

        for (Element a : pagination.select("a[href]")) {
            String rel = a.attr("rel");
            String cls = a.attr("class").toLowerCase();
            String txt = a.text().trim().toLowerCase();
            if ("next".equalsIgnoreCase(rel) || cls.contains("next") || txt.contains("next")) {
                String nextHref = a.attr("href").trim();
                if (!nextHref.isBlank()) {
                    String nextUrl = resolveUrl(BASE_URL, nextHref);
                    if (!visitedPages.contains(nextUrl)) {
                        return nextUrl;
                    }
                }
            }
        }

        // Fallback by page param
        int curPage = 1;
        Matcher m = RE_PAGE_PARAM.matcher(currentUrl);
        if (m.find()) {
            try {
                curPage = Integer.parseInt(m.group(1));
            } catch (NumberFormatException ignored) {}
        }

        int maxPage = curPage;
        for (Element a : pagination.select("a[href]")) {
            Matcher pm = RE_PAGE_PARAM.matcher(a.attr("href"));
            if (pm.find()) {
                try {
                    int p = Integer.parseInt(pm.group(1));
                    if (p > maxPage) maxPage = p;
                } catch (NumberFormatException ignored) {}
            }
        }

        if (curPage < maxPage) {
            String cleanBase = RE_PAGE_STRIP.matcher(currentUrl).replaceAll("");
            String sep = cleanBase.contains("?") ? "&" : "?";
            String candidate = cleanBase + sep + "page=" + (curPage + 1);
            if (!visitedPages.contains(candidate)) {
                return candidate;
            }
        }

        return null;
    }

    private ScrapedBookDTO scrapeBookPage(String url, CardHint hint) {
        Document doc = fetchDocument(url);
        if (doc == null) return null;

        String pageContent = doc.html();

        // 1. Title
        String title = "";
        Element h1 = doc.select("h1").first();
        if (h1 != null) {
            title = TextCleaner.cleanText(h1.text());
        }
        if (title.isBlank() && hint != null && !hint.title().isBlank()) {
            title = hint.title();
        }
        if (title.isBlank()) {
            String slug = url.replaceAll("/+$", "");
            slug = slug.substring(slug.lastIndexOf('/') + 1);
            slug = RE_SLUG_NUM_STRIP.matcher(slug).replaceAll("");
            title = TextCleaner.titleCase(slug.replace('-', ' '));
        }

        // 2. ISBN
        String isbn = "";
        Matcher im = RE_ISBN.matcher(pageContent);
        if (im.find()) {
            isbn = im.group(1).replaceAll("[-\\s]", "");
        } else {
            Matcher uim = RE_CAT_ISBN.matcher(url);
            if (uim.find()) {
                isbn = uim.group(1);
            }
        }

        // 3. Cover
        String coverUrl = "";
        if (!isbn.isBlank()) {
            for (Element img : doc.select("img")) {
                String src = img.attr("src");
                if (src.contains(isbn)) {
                    coverUrl = src;
                    break;
                }
            }
        }
        if (coverUrl.isBlank()) {
            for (Element img : doc.select("img")) {
                String src = img.attr("src");
                if (src.contains("/media/cache/")) {
                    coverUrl = src;
                    break;
                }
            }
        }
        if (coverUrl.isBlank() && hint != null) {
            coverUrl = hint.coverUrl();
        }

        // 4. Pages
        int pageCount = 0;
        Matcher pgm = RE_PAGES.matcher(pageContent);
        if (pgm.find()) {
            try {
                pageCount = Integer.parseInt(pgm.group(1));
            } catch (NumberFormatException ignored) {}
        }

        // 5. Release Date
        LocalDate releaseDate = null;
        Matcher rdm = RE_PARUTION.matcher(pageContent);
        if (rdm.find()) {
            releaseDate = FrenchDateParser.parse(rdm.group(1));
        }
        if (releaseDate == null && hint != null && !hint.dateStr().isBlank()) {
            releaseDate = FrenchDateParser.parse(hint.dateStr());
        }
        if (releaseDate == null) {
            releaseDate = LocalDate.now();
        }

        // 6. Description
        String description = "";
        Element descEl = doc.select("div[class*='description'], div[class*='resume'], div[class*='synopsis']").first();
        if (descEl != null) {
            description = TextCleaner.cleanText(descEl.text());
        }
        if (description.isBlank()) {
            for (Element p : doc.select("p")) {
                String t = p.text().trim();
                String low = t.toLowerCase();
                if (t.length() > 80 && !low.contains("cookie") && !low.contains("contact") && !low.contains("newsletter")) {
                    description = TextCleaner.cleanText(t);
                    break;
                }
            }
        }

        // 7. Authors
        List<ScrapedAuthorDTO> authors = new ArrayList<>();
        Elements authorCards = doc.select(".author-card__name");
        if (!authorCards.isEmpty()) {
            for (Element ac : authorCards) {
                String aName = TextCleaner.cleanText(ac.text());
                if (!aName.isBlank()) {
                    String[] sp = TextCleaner.splitAuthorName(aName);
                    if (!sp[1].isBlank() || !sp[0].isBlank()) {
                        authors.add(new ScrapedAuthorDTO(sp[0], sp[1], "Writer"));
                    }
                }
            }
        }
        if (authors.isEmpty()) {
            Element h2 = doc.select("h2.book__author").first();
            if (h2 != null) {
                for (String part : h2.text().split(",")) {
                    String aName = TextCleaner.cleanText(part);
                    if (!aName.isBlank()) {
                        String[] sp = TextCleaner.splitAuthorName(aName);
                        if (!sp[1].isBlank() || !sp[0].isBlank()) {
                            authors.add(new ScrapedAuthorDTO(sp[0], sp[1], "Writer"));
                        }
                    }
                }
            }
        }
        if (authors.isEmpty() && hint != null && !hint.authorStr().isBlank()) {
            for (String part : hint.authorStr().split(",")) {
                String aName = TextCleaner.cleanText(part);
                if (!aName.isBlank()) {
                    String[] sp = TextCleaner.splitAuthorName(aName);
                    if (!sp[1].isBlank() || !sp[0].isBlank()) {
                        authors.add(new ScrapedAuthorDTO(sp[0], sp[1], "Writer"));
                    }
                }
            }
        }

        // 8. Price
        int price = 8;
        Element priceEl = doc.select(".price__value").first();
        if (priceEl != null) {
            Matcher prm = RE_PRICE.matcher(priceEl.text());
            if (prm.find()) {
                try {
                    price = Integer.parseInt(prm.group(1));
                } catch (NumberFormatException ignored) {}
            }
        }

        // 9. Series & Volume
        String seriesName = title;
        Integer volume = null;
        Matcher vm = RE_VOL.matcher(title);
        if (!vm.find() && hint != null && !hint.tome().isBlank()) {
            vm = RE_VOL.matcher(hint.tome());
        } else {
            vm.reset();
        }
        if (vm.find()) {
            try {
                volume = Integer.parseInt(vm.group(1));
            } catch (NumberFormatException ignored) {}
            seriesName = RE_VOL_STRIP.matcher(title).replaceAll("").replaceAll("^[ :\\-]+|[ :\\-]+$", "").trim();
        }

        // 10. Collection
        String collectionName = "";
        for (Element info : doc.select(".book__info")) {
            Element lbl = info.select(".book__info__label").first();
            if (lbl != null && lbl.text().toLowerCase().contains("collection")) {
                String rawCol = info.text().replace(lbl.text(), "").trim();
                collectionName = TextCleaner.cleanText(rawCol);
                break;
            }
        }

        String seriesQualifier = "";
        if ((!collectionName.isBlank() && collectionName.toLowerCase().contains("junji ito") && volume != null && pageCount > 0 && pageCount <= 350 && price <= 10)
                || title.toLowerCase().contains("poche")
                || (hint != null && hint.tome().toLowerCase().contains("poche"))) {
            seriesQualifier = "Poche";
        }

        return ScrapedBookDTO.builder()
                .title(TextCleaner.truncate(title, 255))
                .seriesName(TextCleaner.truncate(seriesName, 255))
                .seriesQualifier(seriesQualifier)
                .volume(volume)
                .isbn(isbn)
                .editorName("Mangetsu")
                .collectionName(collectionName)
                .categoryName("Manga")
                .pageCount(pageCount)
                .price(price)
                .description(description)
                .coverUrl(coverUrl)
                .releaseDate(releaseDate)
                .bookType("Manga")
                .authors(authors)
                .sourceUrl(url)
                .build();
    }

    private String resolveUrl(String base, String rel) {
        if (rel.startsWith("http://") || rel.startsWith("https://")) {
            return rel;
        }
        try {
            return URI.create(base).resolve(rel).toString();
        } catch (Exception e) {
            return base + (rel.startsWith("/") ? rel : "/" + rel);
        }
    }
}
