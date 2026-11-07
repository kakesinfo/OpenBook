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
import java.util.*;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Scraper source for Komics Initiative (https://www.komics-initiative.com).
 * Scrapes both:
 * 1. Comics à venir: https://www.komics-initiative.com/categorie-produit/comics-a-venir/
 * 2. Catalogue d'ouvrages: https://www.komics-initiative.com/catalogue-ouvrages-comics/
 */
@Slf4j
@Component
public class KomicsInitiativeSource extends AbstractHttpSource {

    private static final String BASE_URL = "https://www.komics-initiative.com";
    private static final String CATALOGUE_URL = BASE_URL + "/catalogue-ouvrages-comics/";
    private static final String A_VENIR_URL = BASE_URL + "/categorie-produit/comics-a-venir/";

    private static final Pattern RE_PRICE = Pattern.compile("([0-9]+(?:[.,][0-9]{1,2})?)");
    private static final Pattern RE_ISBN = Pattern.compile("(?i)(?:ISBN|EAN)\\s*:\\s*([0-9Xx\\- ]{10,20})");
    private static final Pattern RE_PAGES = Pattern.compile("(?i)Pages?\\s*:\\s*([0-9]+)");
    private static final Pattern RE_DATE = Pattern.compile("(?i)Sortie\\s*:\\s*([0-9]{1,2}/[0-9]{1,2}/[0-9]{4})");
    private static final Pattern RE_FORMAT = Pattern.compile("(?i)Format\\s*:\\s*([^<\\n\\r]+)");
    private static final Pattern RE_COVER_TYPE = Pattern.compile("(?i)Couverture\\s*:\\s*([^<\\n\\r]+)");
    private static final Pattern RE_VOL = Pattern.compile("(?i)\\b(?:tome|t\\.?|volume|vol\\.?)\\s*(\\d+)\\b");
    private static final Pattern RE_VOL_STRIP = Pattern.compile("(?i)\\s*[-–—]?\\s*\\b(?:tome|t\\.?|volume|vol\\.?)\\s*\\d+\\b.*");

    public KomicsInitiativeSource(ScraperProperties properties) {
        super(properties);
    }

    @Override
    public String getId() {
        return "komics_initiative";
    }

    @Override
    public String getName() {
        return "Komics Initiative";
    }

    @Override
    public String getDescription() {
        return "Catalogue d'ouvrages et sorties à venir de Komics Initiative";
    }

    @Override
    public String getColor() {
        return "#eab308"; // Brand yellow/amber color
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

        log.info("[KomicsInitiative] Starting scrape (fullScan={}, maxItems={})", fullScan, maxItems);

        // 1. First scrape 'comics à venir'
        List<String> aVenirLinks = collectLinksFromListing(A_VENIR_URL, fullScan, isStopped);
        log.info("[KomicsInitiative] Found {} links in comics-a-venir", aVenirLinks.size());

        // 2. Next scrape catalogue
        List<String> catalogueLinks = collectLinksFromListing(CATALOGUE_URL, fullScan, isStopped);
        log.info("[KomicsInitiative] Found {} links in catalogue", catalogueLinks.size());

        // Merge keeping order: a-venir first, then catalogue
        List<String> allLinks = new ArrayList<>();
        for (String url : aVenirLinks) {
            if (processedUrls.add(url)) {
                allLinks.add(url);
            }
        }
        for (String url : catalogueLinks) {
            if (processedUrls.add(url)) {
                allLinks.add(url);
            }
        }

        log.info("[KomicsInitiative] Total unique product links to scrape: {}", allLinks.size());

        for (String url : allLinks) {
            if (isStopped != null && isStopped.getAsBoolean()) {
                log.info("[KomicsInitiative] Stop requested by user");
                break;
            }
            if (!fullScan && results.size() >= maxItems) {
                log.info("[KomicsInitiative] Reached max items limit ({})", maxItems);
                break;
            }

            try {
                ScrapedBookDTO book = scrapeProductPage(url);
                if (book != null) {
                    results.add(book);
                    if (onBookFound != null) {
                        onBookFound.accept(book);
                    }
                }
            } catch (Exception e) {
                log.warn("[KomicsInitiative] Error scraping product {}: {}", url, e.getMessage());
            }

            // Polite crawl delay between items
            try {
                Thread.sleep(150);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }

        log.info("[KomicsInitiative] Finished scrape. Extracted {} books.", results.size());
        return results;
    }

    private List<String> collectLinksFromListing(String startUrl, boolean fullScan, BooleanSupplier isStopped) {
        List<String> links = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        int page = 1;

        while (true) {
            if (isStopped != null && isStopped.getAsBoolean()) {
                break;
            }

            String pageUrl = (page == 1) ? startUrl : (startUrl.replaceAll("/$", "") + "/page/" + page + "/");
            log.info("[KomicsInitiative] Fetching listing page {}: {}", page, pageUrl);

            Document doc = fetchDocument(pageUrl);
            if (doc == null) {
                break;
            }

            // Find product card links
            Elements productLinks = doc.select(".product-card a.woocommerce-LoopProduct-link, .products .product a[href*='/catalogue-ouvrages-comics/'], .products a[href*='/produit/']");
            if (productLinks.isEmpty()) {
                // Fallback: search all links in main content
                productLinks = doc.select("main a[href*='/catalogue-ouvrages-comics/']");
            }

            int foundOnPage = 0;
            for (Element a : productLinks) {
                String href = a.absUrl("href").trim();
                // Strip anchor and query params
                int queryIdx = href.indexOf('?');
                if (queryIdx >= 0) href = href.substring(0, queryIdx);
                int hashIdx = href.indexOf('#');
                if (hashIdx >= 0) href = href.substring(0, hashIdx);

                if (href.isBlank() || href.equals(CATALOGUE_URL) || href.equals(A_VENIR_URL) || href.contains("/page/")) {
                    continue;
                }

                // Exclude known non-book test products
                if (href.contains("produit-derive-test")) {
                    continue;
                }

                if (seen.add(href)) {
                    links.add(href);
                    foundOnPage++;
                }
            }

            if (foundOnPage == 0) {
                log.info("[KomicsInitiative] No products found on page {}, stopping pagination", page);
                break;
            }

            // If not fullScan and we already got the first page of listing, we can stop
            if (!fullScan) {
                break;
            }

            // Check if there is a next page
            Element nextPageEl = doc.selectFirst(".woocommerce-pagination a.next, a.page-numbers.next");
            if (nextPageEl == null) {
                // Or check if a link to page+1 exists
                String nextPageUrlPart = "/page/" + (page + 1) + "/";
                Element hasNext = doc.selectFirst("a[href*='" + nextPageUrlPart + "']");
                if (hasNext == null) {
                    break;
                }
            }

            page++;
        }

        return links;
    }

    public ScrapedBookDTO scrapeProductPage(String url) {
        Document doc = fetchDocument(url);
        if (doc == null) {
            return null;
        }

        // 1. Title
        Element titleEl = doc.selectFirst("h1.product_title, h1.entry-title, h1");
        if (titleEl == null) {
            return null;
        }
        String rawTitle = TextCleaner.cleanText(titleEl.text());
        if (rawTitle.isEmpty()) {
            return null;
        }

        // 2. Authors
        List<ScrapedAuthorDTO> authors = new ArrayList<>();
        Element distEl = doc.selectFirst(".distribution_produit, .distribution");
        if (distEl != null) {
            authors.addAll(parseAuthors(distEl));
        }

        // 3. Price
        Integer price = null;
        Element priceEl = doc.selectFirst("p.price, .summary .price");
        if (priceEl != null) {
            // Pick the last price (in case of sale/discount: del then ins)
            Element insEl = priceEl.selectFirst("ins .woocommerce-Price-amount");
            String pText = (insEl != null) ? insEl.text() : priceEl.text();
            Matcher pm = RE_PRICE.matcher(pText.replace(',', '.'));
            if (pm.find()) {
                try {
                    price = (int) Math.round(Double.parseDouble(pm.group(1)));
                } catch (Exception ignored) {}
            }
        }

        // 4. Details section (ISBN, Pages, Format, Release date, Cover type)
        Element detailsEl = doc.selectFirst(".details_produit, .product_meta");
        String detailsText = (detailsEl != null) ? detailsEl.text() : doc.text();

        String isbn = null;
        Matcher isbnMatcher = RE_ISBN.matcher(detailsText);
        if (isbnMatcher.find()) {
            isbn = isbnMatcher.group(1).replaceAll("[^0-9Xx]", "");
        }

        Integer pageCount = null;
        Matcher pageMatcher = RE_PAGES.matcher(detailsText);
        if (pageMatcher.find()) {
            try {
                pageCount = Integer.parseInt(pageMatcher.group(1));
            } catch (NumberFormatException ignored) {}
        }

        LocalDate releaseDate = null;
        Matcher dateMatcher = RE_DATE.matcher(detailsText);
        if (dateMatcher.find()) {
            releaseDate = FrenchDateParser.parse(dateMatcher.group(1));
        }

        String bookType = "Cartonné";
        Matcher coverMatcher = RE_COVER_TYPE.matcher(detailsText);
        if (coverMatcher.find()) {
            String cType = coverMatcher.group(1).trim();
            if (cType.toLowerCase().contains("souple")) {
                bookType = "Broché";
            } else if (cType.toLowerCase().contains("carton")) {
                bookType = "Cartonné";
            }
        }

        // 5. Category (Kitsune -> Manga, Comics, etc.)
        String categoryName = "Comics"; // default for Komics Initiative
        if (detailsEl != null) {
            Elements catLinks = detailsEl.select(".posted_in a, a[rel='tag']");
            for (Element cLink : catLinks) {
                String cName = cLink.text().toLowerCase();
                if (cName.contains("kitsune") || cName.contains("manga")) {
                    categoryName = "Manga";
                    break;
                }
                if (cName.contains("jeunesse") || cName.contains("kids")) {
                    categoryName = "Bande dessinée";
                }
            }
        }

        // 6. Cover image URL
        String coverUrl = null;
        Element imgEl = doc.selectFirst(".woocommerce-product-gallery__image a, .woocommerce-product-gallery img, img.wp-post-image");
        if (imgEl != null) {
            if ("a".equalsIgnoreCase(imgEl.tagName())) {
                coverUrl = imgEl.absUrl("href");
            } else {
                coverUrl = imgEl.absUrl("src");
            }
        }
        if (coverUrl == null || coverUrl.isBlank()) {
            // fallback og:image
            Element ogImg = doc.selectFirst("meta[property='og:image']");
            if (ogImg != null) {
                coverUrl = ogImg.attr("content");
            }
        }

        // 7. Description / Summary
        String description = "";
        Element resumeEl = doc.selectFirst(".resume_produit, .woocommerce-product-details__short-description, #tab-description");
        if (resumeEl != null) {
            // Extract paragraphs, skip heading
            Elements ps = resumeEl.select("p");
            StringBuilder sb = new StringBuilder();
            for (Element p : ps) {
                String pt = p.text().trim();
                if (!pt.isEmpty() && !pt.startsWith("Max Faraday") && !pt.startsWith("BD16")) {
                    if (!sb.isEmpty()) sb.append("\n\n");
                    sb.append(pt);
                }
            }
            description = TextCleaner.cleanText(sb.toString());
        }

        // 8. Series & Volume
        String seriesName = rawTitle;
        Integer volume = null;
        Matcher volMatcher = RE_VOL.matcher(rawTitle);
        if (volMatcher.find()) {
            try {
                volume = Integer.parseInt(volMatcher.group(1));
            } catch (NumberFormatException ignored) {}
            seriesName = RE_VOL_STRIP.matcher(rawTitle).replaceAll("").trim();
            seriesName = seriesName.replaceAll("^[ :\\-]+|[ :\\-]+$", "").trim();
        }

        return ScrapedBookDTO.builder()
                .title(TextCleaner.truncate(rawTitle, 255))
                .seriesName(TextCleaner.truncate(seriesName, 255))
                .volume(volume)
                .isbn(isbn)
                .editorName("Komics Initiative")
                .categoryName(categoryName)
                .pageCount(pageCount)
                .price(price)
                .description(description)
                .coverUrl(coverUrl)
                .releaseDate(releaseDate)
                .bookType(bookType)
                .authors(authors)
                .sourceUrl(url)
                .build();
    }

    private List<ScrapedAuthorDTO> parseAuthors(Element distEl) {
        List<ScrapedAuthorDTO> authors = new ArrayList<>();
        Elements ps = distEl.select("p");
        for (Element p : ps) {
            String text = p.text().trim();
            String low = text.toLowerCase();

            // Check author lines starting with "Par ..." or containing <b>
            if (low.startsWith("par ") || low.startsWith("de ") || p.selectFirst("b") != null) {
                Elements bTags = p.select("b, strong");
                if (!bTags.isEmpty()) {
                    for (Element b : bTags) {
                        String aName = b.text().replaceAll("[.,;]+$", "").trim();
                        addAuthorIfValid(authors, aName, "Writer");
                    }
                } else {
                    // Try splitting by comma, " et ", "&"
                    String clean = text.replaceFirst("(?i)^(?:par|de)\\s+", "").replaceAll("[.,;]+$", "").trim();
                    String[] parts = clean.split("(?i)\\s+(?:et|&)\\s+|,\\s*");
                    for (String part : parts) {
                        addAuthorIfValid(authors, part.trim(), "Writer");
                    }
                }
            }
        }
        return authors;
    }

    private void addAuthorIfValid(List<ScrapedAuthorDTO> authors, String fullName, String role) {
        if (fullName == null || fullName.isBlank() || fullName.equalsIgnoreCase("Komics Initiative")) {
            return;
        }
        String[] split = TextCleaner.splitAuthorName(fullName);
        if (split[1] != null && !split[1].isBlank()) {
            authors.add(new ScrapedAuthorDTO(split[0], split[1], role));
        }
    }
}
