package fr.openbook.scraper.sources;

import fr.openbook.scraper.config.ScraperProperties;
import fr.openbook.scraper.model.ScanOptions;
import fr.openbook.scraper.model.ScrapedAuthorDTO;
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
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDate;
import java.util.*;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Scraper source for Éditions Astrolabe via Leslibraires.fr (https://www.leslibraires.fr/editeur/astrolabe/).
 */
@Slf4j
@Component
public class AstrolabeSource extends AbstractHttpSource {

    public static final String BASE_URL = "https://www.leslibraires.fr";
    public static final String CATALOG_URL = BASE_URL + "/editeur/astrolabe/";

    private static final Pattern RE_LEADING_VOL_PREFIX = Pattern.compile("^(\\d+)\\s*(?:[-–—]|,)\\s*");
    private static final Pattern RE_SERIE_VOL_PAREN = Pattern.compile("\\((\\d+)\\)\\s*$");
    private static final Pattern RE_VOL_IN_TITLE = Pattern.compile("(?i)\\b(?:tome|t\\.?|volume|vol\\.?)\\s*0?(\\d+)\\b");
    private static final Pattern RE_VOL_STRIP = Pattern.compile("(?i)\\s*[-–—,:]?\\s*\\b(?:tome|t\\.?|volume|vol\\.?)\\s*0?\\d+\\b.*");
    private static final Pattern RE_PRICE = Pattern.compile("(\\d+(?:[.,]\\d{1,2})?)");
    private static final Pattern RE_ISBN = Pattern.compile("(97[89][0-9Xx\\- ]{10,18})");
    private static final Set<String> ROMAN_OR_SUFFIXES = Set.of("II", "III", "IV", "V", "JR", "SR");

    public record CardHint(
            String url,
            String title,
            Integer volumeHint,
            String authorRaw,
            Integer price,
            String coverUrl
    ) {}

    public AstrolabeSource(ScraperProperties properties) {
        super(properties);
    }

    @Override
    public String getId() {
        return "astrolabe";
    }

    @Override
    public String getName() {
        return "Astrolabe";
    }

    @Override
    public String getDescription() {
        return "Catalogue et nouveautés des éditions Astrolabe via Leslibraires.fr";
    }

    @Override
    public String getColor() {
        return "#14b8a6";
    }

    @Override
    protected Document fetchDocument(String url) {
        int maxAttempts = 3;
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                        .GET()
                        .timeout(Duration.ofSeconds(properties.getRequestTimeout()))
                        .header("User-Agent", properties.getUserAgent())
                        .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8")
                        .header("Accept-Language", "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7")
                        .header("Referer", CATALOG_URL)
                        .build();

                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                int status = response.statusCode();
                if (status >= 200 && status < 300) {
                    return Jsoup.parse(response.body(), url);
                }
                if ((status == 503 || status == 429) && attempt < maxAttempts) {
                    log.debug("[{}] HTTP {} for {} (attempt {}/{}), backing off before retry...", getId(), status, url, attempt, maxAttempts);
                    Thread.sleep(1500L * attempt);
                    continue;
                }
                log.warn("[{}] HTTP {} for {}", getId(), status, url);
                return null;
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                return null;
            } catch (Exception e) {
                log.warn("[{}] Error fetching {}: {}", getId(), url, e.getMessage());
                return null;
            }
        }
        return null;
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
        Map<String, CardHint> discoveredCards = new LinkedHashMap<>();

        String currentPageUrl = CATALOG_URL;
        Set<String> visitedPages = new HashSet<>();

        log.info("[Astrolabe] Starting scrape from {} (fullScan={}, maxItems={})", CATALOG_URL, fullScan, maxItems);

        while (currentPageUrl != null && !currentPageUrl.isBlank() && visitedPages.add(currentPageUrl)) {
            if (isStopped != null && isStopped.getAsBoolean()) break;
            if (!fullScan && discoveredCards.size() >= maxItems) break;

            log.info("[Astrolabe] Fetching listing page: {}", currentPageUrl);
            Document doc = fetchDocument(currentPageUrl);
            if (doc == null) {
                break;
            }

            Elements cards = doc.select("article.card-product");
            if (cards.isEmpty()) {
                log.info("[Astrolabe] No product cards found on {}, stopping pagination", currentPageUrl);
                break;
            }

            for (Element card : cards) {
                if (isStopped != null && isStopped.getAsBoolean()) break;
                CardHint hint = parseCard(card, currentPageUrl);
                if (hint != null && !hint.url().isBlank()) {
                    discoveredCards.putIfAbsent(hint.url(), hint);
                    if (!fullScan && discoveredCards.size() >= maxItems) {
                        break;
                    }
                }
            }

            currentPageUrl = extractNextPageUrl(doc, currentPageUrl);
            if (currentPageUrl != null && !currentPageUrl.isBlank()) {
                if (!sleepPolitely(1200, isStopped)) {
                    break;
                }
            }
        }

        log.info("[Astrolabe] Discovered {} book URLs to scrape", discoveredCards.size());

        int index = 0;
        for (CardHint hint : discoveredCards.values()) {
            if (isStopped != null && isStopped.getAsBoolean()) {
                log.info("[Astrolabe] Stop requested");
                break;
            }
            if (!fullScan && results.size() >= maxItems) {
                break;
            }

            if (index > 0 && !sleepPolitely(1200, isStopped)) {
                break;
            }
            index++;

            try {
                ScrapedBookDTO book = scrapeBookPage(hint.url(), hint);
                if (book != null) {
                    results.add(book);
                    if (onBookFound != null) {
                        onBookFound.accept(book);
                    }
                }
            } catch (Exception e) {
                log.warn("[Astrolabe] Error scraping book page {}: {}", hint.url(), e.getMessage());
            }
        }

        log.info("[Astrolabe] Finished scrape: {} books extracted", results.size());
        return results;
    }

    public CardHint parseCard(Element card, String baseUrl) {
        if (card == null) return null;

        Element titleLink = card.selectFirst(".card-product__title a[href], a[href*='/livre/']");
        if (titleLink == null) return null;

        String href = titleLink.attr("href").trim();
        if (href.isBlank()) return null;
        String fullUrl = resolveUrl(baseUrl, href);

        String rawTitle = TextCleaner.cleanText(titleLink.text());
        Integer volumeHint = null;
        Matcher leadM = RE_LEADING_VOL_PREFIX.matcher(rawTitle);
        if (leadM.find()) {
            try {
                volumeHint = Integer.parseInt(leadM.group(1));
            } catch (NumberFormatException ignored) {}
            rawTitle = rawTitle.substring(leadM.end()).trim();
        }

        String authorRaw = "";
        Element authorEl = card.selectFirst(".card-product__author, [itemprop='author']");
        if (authorEl != null) {
            authorRaw = TextCleaner.cleanText(authorEl.text());
        }

        Integer price = null;
        Element priceEl = card.selectFirst(".product-price, .price-wrapper");
        if (priceEl != null) {
            price = parsePriceEuros(priceEl.text());
        }

        String coverUrl = null;
        Element imgEl = card.selectFirst(".card-product__media img[src], img[itemprop='image']");
        if (imgEl != null) {
            String src = normalizeImageUrl(imgEl.attr("src"), baseUrl);
            if (!isPlaceholderCover(src)) {
                coverUrl = src;
            }
        }

        return new CardHint(fullUrl, rawTitle, volumeHint, authorRaw, price, coverUrl);
    }

    public ScrapedBookDTO scrapeBookPage(String url) {
        return scrapeBookPage(url, null);
    }

    public ScrapedBookDTO scrapeBookPage(String url, CardHint hint) {
        Document doc = fetchDocument(url);
        if (doc == null) {
            if (hint != null && !hint.title().isBlank()) {
                return buildFallbackFromHint(hint);
            }
            return null;
        }
        return parseBookDocument(doc, url, hint);
    }

    public ScrapedBookDTO parseBookDocument(Document doc, String url, CardHint hint) {
        if (doc == null) return null;

        // 1. Title & leading volume hint
        String rawTitle = "";
        Integer volumeHint = hint != null ? hint.volumeHint() : null;

        Element h1 = doc.selectFirst("h1.product-details__title, h1[itemprop='name'], h1");
        if (h1 != null) {
            // Use ownText() first so embedded <a href="#">SeriesName</a> inside h1 is not prepended to the title
            String own = TextCleaner.cleanText(h1.ownText());
            rawTitle = !own.isBlank() ? own : TextCleaner.cleanText(h1.text());
        }
        if (rawTitle.isBlank() && hint != null) {
            rawTitle = hint.title();
        }
        if (rawTitle.isBlank()) {
            return null;
        }

        Matcher leadM = RE_LEADING_VOL_PREFIX.matcher(rawTitle);
        if (leadM.find()) {
            if (volumeHint == null) {
                try {
                    volumeHint = Integer.parseInt(leadM.group(1));
                } catch (NumberFormatException ignored) {}
            }
            rawTitle = rawTitle.substring(leadM.end()).trim();
        }

        String cleanTitle = TextCleaner.cleanText(rawTitle);
        if (cleanTitle.isBlank()) {
            return null;
        }

        // 2. Caractéristiques table & schema.org metadata
        String isbn = null;
        Element gtinMeta = doc.selectFirst("meta[itemprop='gtin13'], meta[itemprop='sku'], meta[itemprop='productID']");
        if (gtinMeta != null && !gtinMeta.attr("content").isBlank()) {
            isbn = gtinMeta.attr("content").replaceAll("[^0-9Xx]", "");
        }
        if (isbn == null || isbn.isBlank()) {
            Element gtinTd = doc.selectFirst("td[itemprop='gtin13'], td[itemprop='isbn']");
            if (gtinTd != null) {
                isbn = gtinTd.text().replaceAll("[^0-9Xx]", "");
            }
        }
        if (isbn == null || isbn.isBlank()) {
            Matcher m = RE_ISBN.matcher(doc.text());
            if (m.find()) {
                isbn = m.group(1).replaceAll("[^0-9Xx]", "");
            }
        }

        // 3. Release Date
        LocalDate releaseDate = null;
        Element dateTd = doc.selectFirst("td[itemprop='datePublished'], [itemprop='datePublished']");
        if (dateTd != null) {
            String dtAttr = dateTd.attr("datetime").trim();
            if (!dtAttr.isBlank()) {
                releaseDate = FrenchDateParser.parse(dtAttr);
            }
            if (releaseDate == null) {
                releaseDate = FrenchDateParser.parse(dateTd.text());
            }
        }

        // 4. Page Count
        Integer pageCount = 0;
        Element pagesTd = doc.selectFirst("td[itemprop='numberOfPages'], [itemprop='numberOfPages']");
        if (pagesTd != null) {
            try {
                pageCount = Integer.parseInt(pagesTd.text().replaceAll("[^0-9]", ""));
            } catch (NumberFormatException ignored) {}
        }

        // 5. Features table rows (Format, Collection, Série)
        String formatStr = "";
        String collectionName = "";
        String explicitSeries = "";
        Integer explicitVolume = null;

        for (Element tr : doc.select(".product-features table tr, table.table tr")) {
            Element th = tr.selectFirst("th");
            Element td = tr.selectFirst("td");
            if (th == null || td == null) continue;

            String label = th.text().trim().toLowerCase(Locale.ROOT);
            if (label.contains("format")) {
                formatStr = TextCleaner.cleanText(td.text());
            } else if (label.contains("collection")) {
                collectionName = TextCleaner.cleanText(td.text());
            } else if (label.contains("série") || label.contains("serie")) {
                Element serieLink = td.selectFirst("a");
                if (serieLink != null) {
                    explicitSeries = TextCleaner.cleanText(serieLink.text());
                } else {
                    explicitSeries = TextCleaner.cleanText(td.text().replaceAll("\\(\\d+\\)\\s*$", ""));
                }
                Matcher vm = RE_SERIE_VOL_PAREN.matcher(td.text().trim());
                if (vm.find()) {
                    try {
                        explicitVolume = Integer.parseInt(vm.group(1));
                    } catch (NumberFormatException ignored) {}
                }
            }
        }

        if (collectionName.isBlank()) {
            Element colSpan = doc.selectFirst(".product-details__collection a");
            if (colSpan != null) {
                collectionName = TextCleaner.cleanText(colSpan.text());
            }
        }

        if (explicitSeries.isBlank()) {
            Element serieSpan = doc.selectFirst(".product-details__serie a");
            if (serieSpan != null) {
                explicitSeries = TextCleaner.cleanText(serieSpan.text());
            }
        }

        // 6. Price
        Integer price = null;
        Element priceMeta = doc.selectFirst("meta[itemprop='price']");
        if (priceMeta != null && !priceMeta.attr("content").isBlank()) {
            price = parsePriceEuros(priceMeta.attr("content"));
        }
        if (price == null) {
            Element priceDiv = doc.selectFirst(".product-price");
            if (priceDiv != null) {
                price = parsePriceEuros(priceDiv.text());
            }
        }
        if (price == null && hint != null) {
            price = hint.price();
        }
        if (price == null) {
            price = 0;
        }

        // 7. Cover Image (prefer high-res 800x800 from product-media)
        String coverUrl = null;
        Element prodImgDiv = doc.selectFirst(".product-media .product-image[data-src]");
        if (prodImgDiv != null) {
            String candidate = normalizeImageUrl(prodImgDiv.attr("data-src"), url);
            if (!isPlaceholderCover(candidate)) {
                coverUrl = candidate;
            }
        }
        if (coverUrl == null) {
            Element prodImg = doc.selectFirst(".product-media img[itemprop='image'], .product-media img[src]");
            if (prodImg != null) {
                String candidate = normalizeImageUrl(prodImg.attr("src"), url);
                if (!isPlaceholderCover(candidate)) {
                    coverUrl = candidate;
                }
            }
        }
        if (coverUrl == null && hint != null && hint.coverUrl() != null && !isPlaceholderCover(hint.coverUrl())) {
            coverUrl = hint.coverUrl();
        }
        if (coverUrl == null) {
            coverUrl = "";
        }

        // 8. Description
        String description = "";
        Element descEl = doc.selectFirst("[itemprop='description'], article.product-description .inside");
        if (descEl != null) {
            description = TextCleaner.cleanText(descEl.text());
        }

        // 9. Authors
        List<ScrapedAuthorDTO> authors = parseAuthors(doc, hint);

        // 10. Series & Volume resolution
        Integer volume = explicitVolume;
        if (volume == null) {
            Matcher titleVolM = RE_VOL_IN_TITLE.matcher(cleanTitle);
            if (titleVolM.find()) {
                try {
                    volume = Integer.parseInt(titleVolM.group(1));
                } catch (NumberFormatException ignored) {}
            }
        }
        if (volume == null && volumeHint != null && volumeHint > 0) {
            volume = volumeHint;
        }

        String seriesName = explicitSeries;
        if (seriesName.isBlank()) {
            if (RE_VOL_IN_TITLE.matcher(cleanTitle).find()) {
                seriesName = RE_VOL_STRIP.matcher(cleanTitle).replaceAll("").replaceAll("^[ :\\-–—]+|[ :\\-–—]+$", "").trim();
            } else {
                VariantDetector.SeriesVolume sv = VariantDetector.extractCanonicalSeriesAndVolume(cleanTitle);
                seriesName = sv.series();
                if (volume == null && sv.volume() != null) {
                    volume = sv.volume();
                }
            }
        }
        if (seriesName.isBlank()) {
            seriesName = cleanTitle;
        }

        // 11. Category & BookType
        String categoryName = "Bande dessinée";
        for (Element crumb : doc.select("nav[aria-label='breadcrumb'] li a")) {
            String href = crumb.attr("href").toLowerCase(Locale.ROOT);
            String text = crumb.text().trim().toLowerCase(Locale.ROOT);
            if (text.contains("bd, comics")) {
                continue;
            }
            if (href.contains("/manga") || text.equals("mangas") || text.equals("manga")) {
                categoryName = "Manga";
                break;
            }
            if (href.contains("/comics") || text.equals("comics")) {
                categoryName = "Comics";
                break;
            }
            if (href.contains("/bandes-dessinees") || text.contains("bandes dessinées")) {
                categoryName = "Bande dessinée";
                break;
            }
        }

        String bookType = "Cartonné";
        if (formatStr.toLowerCase(Locale.ROOT).contains("broch") || formatStr.toLowerCase(Locale.ROOT).contains("souple") || formatStr.toLowerCase(Locale.ROOT).contains("poche")) {
            bookType = "Broché";
        }

        return ScrapedBookDTO.builder()
                .title(TextCleaner.truncate(cleanTitle, 255))
                .seriesName(TextCleaner.truncate(seriesName, 255))
                .volume(volume)
                .isbn(isbn != null ? isbn : "")
                .editorName("Astrolabe")
                .collectionName(collectionName.isBlank() ? null : collectionName)
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

    private ScrapedBookDTO buildFallbackFromHint(CardHint hint) {
        String cleanTitle = TextCleaner.cleanText(hint.title());
        VariantDetector.SeriesVolume sv = VariantDetector.extractCanonicalSeriesAndVolume(cleanTitle);
        String seriesName = sv.series().isBlank() ? cleanTitle : sv.series();
        Integer volume = sv.volume() != null ? sv.volume() : hint.volumeHint();

        List<ScrapedAuthorDTO> authors = new ArrayList<>();
        Set<String> seenKeys = new HashSet<>();
        if (hint.authorRaw() != null && !hint.authorRaw().isBlank()) {
            addParsedAuthorsFromString(authors, seenKeys, hint.authorRaw(), "Writer");
        }

        return ScrapedBookDTO.builder()
                .title(TextCleaner.truncate(cleanTitle, 255))
                .seriesName(TextCleaner.truncate(seriesName, 255))
                .volume(volume)
                .isbn("")
                .editorName("Astrolabe")
                .categoryName("Bande dessinée")
                .pageCount(0)
                .price(hint.price() != null ? hint.price() : 0)
                .description("")
                .coverUrl(hint.coverUrl() != null ? hint.coverUrl() : "")
                .bookType("Cartonné")
                .authors(authors)
                .sourceUrl(hint.url())
                .build();
    }

    public static List<ScrapedAuthorDTO> parseAuthors(Document doc, CardHint hint) {
        List<ScrapedAuthorDTO> authors = new ArrayList<>();
        Set<String> seenAuthorKeys = new HashSet<>();

        // 1. Prefer linked person tags on detail page (e.g. <a href="/personne/...">Matteo Scalera</a>)
        //    which are consistently in natural Firstname Lastname order.
        if (doc != null) {
            for (Element h2 : doc.select("h2.product-details__author")) {
                String fullH2Text = h2.text().toLowerCase(Locale.ROOT);
                String role = determineRole(fullH2Text);
                Elements personLinks = h2.select("a[href*='/personne/']");
                for (Element a : personLinks) {
                    addParsedAuthorsFromString(authors, seenAuthorKeys, a.text(), role);
                }
            }
        }

        // 2. Listing card author hint (also in natural order or slash-separated, e.g. "Sean Gordon Murphy", "TYNION IV/LEHMAN")
        if (hint != null && hint.authorRaw() != null && !hint.authorRaw().isBlank()) {
            addParsedAuthorsFromString(authors, seenAuthorKeys, hint.authorRaw(), "Writer");
        }

        // 3. Plain text h2.product-details__author elements (e.g. when no card hint or extra authors on detail page)
        if (doc != null) {
            for (Element h2 : doc.select("h2.product-details__author")) {
                if (!h2.select("a[href*='/personne/']").isEmpty()) {
                    continue;
                }
                String role = determineRole(h2.text().toLowerCase(Locale.ROOT));
                addParsedAuthorsFromString(authors, seenAuthorKeys, h2.text(), role);
            }
        }

        return authors;
    }

    private static String determineRole(String lowerText) {
        if (lowerText.contains("illustrat") || lowerText.contains("dessin")) {
            return "Illustrator";
        }
        if (lowerText.contains("color") || lowerText.contains("couleur")) {
            return "Colorist";
        }
        return "Writer";
    }

    private static void addParsedAuthorsFromString(
            List<ScrapedAuthorDTO> authors,
            Set<String> seenKeys,
            String rawAuthorString,
            String role
    ) {
        if (rawAuthorString == null || rawAuthorString.isBlank()) return;

        String cleaned = TextCleaner.cleanAuthorName(rawAuthorString);
        if (cleaned.isBlank()) return;

        // Split multiple authors separated by "/", ",", " et ", "&"
        String[] parts = cleaned.split("(?i)\\s*(?:/|,|\\bet\\b|&)\\s*");
        for (String part : parts) {
            String single = TextCleaner.cleanAuthorName(part);
            if (single.isBlank() || single.equalsIgnoreCase("Astrolabe")) {
                continue;
            }

            String[] fnLn = normalizeAndSplitAuthor(single);
            String fn = fnLn[0];
            String ln = fnLn[1];
            if (ln.isBlank()) continue;

            String tokenKey = canonicalAuthorKey(fn, ln);
            if (seenKeys.add(tokenKey)) {
                authors.add(new ScrapedAuthorDTO(fn, ln, role));
            }
        }
    }

    /**
     * Normalizes an author name from Leslibraires.fr into [firstname, lastname]:
     * - Detects "LASTNAME Firstname" (e.g. "SCALERA Matteo" -> ["Matteo", "Scalera"])
     * - Preserves Roman numerals/suffixes (e.g. "Tynion IV" -> ["", "Tynion IV"])
     * - Converts ALL-CAPS tokens to Title Case
     */
    static String[] normalizeAndSplitAuthor(String rawName) {
        String[] tokens = rawName.trim().split("\\s+");
        if (tokens.length == 0) {
            return new String[]{"", ""};
        }
        if (tokens.length == 1) {
            return new String[]{"", formatNameToken(tokens[0])};
        }

        // Case: 2 tokens where second token is a Roman numeral suffix (e.g. "TYNION IV" or "Tynion Iv")
        if (tokens.length == 2 && ROMAN_OR_SUFFIXES.contains(tokens[1].toUpperCase(Locale.ROOT))) {
            return new String[]{"", formatNameToken(tokens[0]) + " " + tokens[1].toUpperCase(Locale.ROOT)};
        }

        // Case: 2 tokens in "LASTNAME Firstname" format where token[0] is ALL CAPS and token[1] is mixed case (e.g. "SCALERA Matteo")
        if (tokens.length == 2 && isAllUpperCaseWord(tokens[0]) && !isAllUpperCaseWord(tokens[1])) {
            return new String[]{formatNameToken(tokens[1]), formatNameToken(tokens[0])};
        }

        String firstname = formatNameToken(tokens[0]);
        StringBuilder lastnameSb = new StringBuilder();
        for (int i = 1; i < tokens.length; i++) {
            if (i > 1) lastnameSb.append(" ");
            String t = tokens[i];
            if (ROMAN_OR_SUFFIXES.contains(t.toUpperCase(Locale.ROOT))) {
                lastnameSb.append(t.toUpperCase(Locale.ROOT));
            } else {
                lastnameSb.append(formatNameToken(t));
            }
        }
        return new String[]{firstname, lastnameSb.toString()};
    }

    private static boolean isAllUpperCaseWord(String word) {
        if (word == null || word.length() < 2) return false;
        boolean hasLetter = false;
        for (int i = 0; i < word.length(); i++) {
            char c = word.charAt(i);
            if (Character.isLetter(c)) {
                hasLetter = true;
                if (!Character.isUpperCase(c)) {
                    return false;
                }
            }
        }
        return hasLetter;
    }

    private static String formatNameToken(String token) {
        if (token == null || token.isBlank()) return "";
        if (ROMAN_OR_SUFFIXES.contains(token.toUpperCase(Locale.ROOT))) {
            return token.toUpperCase(Locale.ROOT);
        }
        if (token.contains("-")) {
            String[] hyph = token.split("-");
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < hyph.length; i++) {
                if (i > 0) sb.append("-");
                sb.append(TextCleaner.capitalize(hyph[i]));
            }
            return sb.toString();
        }
        return TextCleaner.capitalize(token);
    }

    private static String canonicalAuthorKey(String fn, String ln) {
        String combined = ((fn != null ? fn : "") + " " + (ln != null ? ln : "")).toLowerCase(Locale.ROOT).trim();
        String[] tokens = combined.replaceAll("[^a-z0-9à-ÿ]+", " ").trim().split("\\s+");
        Arrays.sort(tokens);
        return String.join(" ", tokens);
    }

    public static String extractNextPageUrl(Document doc, String currentUrl) {
        if (doc == null) return null;
        Element nextLink = doc.selectFirst("nav.pagination a[href*='page='], .pagination a[rel='next'], a.next[href]");
        if (nextLink != null) {
            String href = nextLink.attr("href").trim();
            if (!href.isBlank()) {
                return resolveUrl(currentUrl, href);
            }
        }
        return null;
    }

    private static Integer parsePriceEuros(String text) {
        if (text == null || text.isBlank()) return null;
        Matcher m = RE_PRICE.matcher(text.replace('\u00a0', ' '));
        if (m.find()) {
            try {
                return (int) Math.round(Double.parseDouble(m.group(1).replace(',', '.')));
            } catch (NumberFormatException ignored) {}
        }
        return null;
    }

    private static String normalizeImageUrl(String rawUrl, String baseUrl) {
        if (rawUrl == null || rawUrl.isBlank()) return "";
        String trimmed = rawUrl.trim();
        if (trimmed.startsWith("//")) {
            return "https:" + trimmed;
        }
        return resolveUrl(baseUrl, trimmed);
    }

    private static boolean isPlaceholderCover(String url) {
        if (url == null || url.isBlank()) return true;
        String low = url.toLowerCase(Locale.ROOT);
        return low.contains("icons/default/book") || low.contains("default/book.avif") || low.contains("placeholder");
    }

    private static String resolveUrl(String base, String rel) {
        if (rel == null || rel.isBlank()) return "";
        String trimmed = rel.trim();
        if (trimmed.startsWith("//")) {
            return "https:" + trimmed;
        }
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
            return trimmed;
        }
        try {
            return URI.create(base).resolve(trimmed).toString();
        } catch (Exception e) {
            return BASE_URL + (trimmed.startsWith("/") ? trimmed : "/" + trimmed);
        }
    }

    private boolean sleepPolitely(long millis, BooleanSupplier isStopped) {
        if (isStopped != null && isStopped.getAsBoolean()) return false;
        try {
            Thread.sleep(millis);
            return isStopped == null || !isStopped.getAsBoolean();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }
}
