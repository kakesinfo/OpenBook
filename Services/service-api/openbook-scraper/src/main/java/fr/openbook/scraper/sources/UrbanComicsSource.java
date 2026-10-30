package fr.openbook.scraper.sources;

import fr.openbook.scraper.config.ScraperProperties;
import fr.openbook.scraper.model.ScanOptions;
import fr.openbook.scraper.model.ScrapedAuthorDTO;
import fr.openbook.scraper.model.ScrapedBookDTO;
import fr.openbook.scraper.utils.FrenchDateParser;
import fr.openbook.scraper.utils.TextCleaner;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.nodes.Node;
import org.jsoup.nodes.TextNode;
import org.jsoup.parser.Parser;
import org.jsoup.select.Elements;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Component
public class UrbanComicsSource extends AbstractHttpSource {

    private static final List<String> ALL_MONTH_SLUGS = List.of(
            "janvier", "fevrier", "mars", "avril", "mai", "juin",
            "juillet", "aout", "septembre", "octobre", "novembre", "decembre"
    );

    private static final Pattern RE_URBAN_SERIE_PREFIX = Pattern.compile("(?i)^S[eé]rie\\s*:\\s*");
    private static final Pattern RE_URBAN_VOL_MATCH = Pattern.compile("(?i)\\b(?:Tome|Vol(?:ume)?\\.?|T)\\s*(\\d+)\\b");
    private static final Pattern RE_URBAN_INT_MATCH = Pattern.compile("(?i)Int[eé]grale\\s*(\\d+)");
    private static final Pattern RE_URBAN_VOL_STRIP = Pattern.compile("(?i)\\b(?:Tome|Vol(?:ume)?\\.?|T)\\s*\\d+.*");
    private static final Pattern RE_URBAN_INT_STRIP = Pattern.compile("(?i)Int[eé]grale.*");
    private static final Pattern RE_URBAN_INTEGRALE = Pattern.compile("(?i)Int[eé]grale");

    private static final Pattern RE_DIGITS_ONLY = Pattern.compile("(\\d+)");
    private static final Pattern RE_PRICE_DECIMAL = Pattern.compile("(\\d+)[,\\.](\\d+)");
    private static final Pattern RE_URBAN_EAN = Pattern.compile("(?i)<b>(?:EAN|ISBN)\\s*:</b>\\s*([0-9]{10,13})");
    private static final Pattern RE_URBAN_ALBUM_EAN = Pattern.compile("/album/([0-9]{10,13})/");
    private static final Pattern RE_URBAN_PAGINATION = Pattern.compile("(?i)<b>Pagination\\s*:</b>\\s*([0-9]+)\\s*page");
    private static final Pattern RE_URBAN_PRICE_HTML = Pattern.compile("class=[\"'](?:woocommerce-Price-amount amount|price)[\"'][^>]*>([0-9]+)[,\\.]([0-9]+)");
    private static final Pattern RE_URBAN_RAW_PRICE = Pattern.compile("Prix\\s*:\\s*([0-9]+)[,\\.]([0-9]+)");
    private static final Pattern RE_URBAN_RELEASE_DATE = Pattern.compile("(?i)<b>Date de sortie\\s*:</b>\\s*([^<]+)");
    private static final Pattern RE_URBAN_COLLECTION = Pattern.compile("(?i)<b>Collection\\s*:</b>\\s*([^<]+)");

    private record TargetHint(String title, String coverUrl, int price, LocalDate releaseDate, String isbn) {}

    public UrbanComicsSource(ScraperProperties properties) {
        super(properties);
    }

    @Override
    public String getId() {
        return "urban_comics";
    }

    @Override
    public String getName() {
        return "Urban Comics";
    }

    @Override
    public String getDescription() {
        return "Comics DC, Indies, Urban Link";
    }

    @Override
    public String getColor() {
        return "#3b82f6";
    }

    @Override
    public List<ScrapedBookDTO> scrape(
            ScanOptions options,
            Consumer<ScrapedBookDTO> onBookFound,
            BooleanSupplier isStopped
    ) {
        int maxItems = options.getMaxItems() > 0 ? options.getMaxItems() : properties.getMaxBooksPerSource();
        boolean fullScan = options.isFullScan();

        Map<String, TargetHint> targets = new LinkedHashMap<>();

        log.info("[UrbanComics] Starting crawl (fullScan={}, maxItems={})...", fullScan, maxItems);

        // 1. Crawl À paraître
        crawlAParaitre(fullScan, isStopped, targets);
        log.info("[UrbanComics] Targets after à paraître: {}", targets.size());

        if (isStopped != null && isStopped.getAsBoolean()) return Collections.emptyList();

        // 2. Crawl Shop
        crawlShop(fullScan, isStopped, targets);
        log.info("[UrbanComics] Targets after shop: {}", targets.size());

        if (isStopped != null && isStopped.getAsBoolean()) return Collections.emptyList();

        // 3. Sitemaps
        if (fullScan || targets.size() < maxItems) {
            crawlSitemaps(fullScan, isStopped, targets);
            log.info("[UrbanComics] Targets after sitemaps: {}", targets.size());
        }

        if (isStopped != null && isStopped.getAsBoolean()) return Collections.emptyList();

        if (targets.isEmpty()) {
            log.warn("[UrbanComics] No targets discovered on Urban Comics website");
            return Collections.emptyList();
        }

        List<Map.Entry<String, TargetHint>> targetList = new ArrayList<>(targets.entrySet());
        if (!fullScan && targetList.size() > maxItems) {
            targetList = targetList.subList(0, maxItems);
        }

        log.info("[UrbanComics] Processing {} target detail pages...", targetList.size());

        List<ScrapedBookDTO> books = Collections.synchronizedList(new ArrayList<>());

        try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
            for (Map.Entry<String, TargetHint> entry : targetList) {
                if (isStopped != null && isStopped.getAsBoolean()) break;

                executor.submit(() -> {
                    if (isStopped != null && isStopped.getAsBoolean()) return;

                    ScrapedBookDTO book = scrapeProductPage(entry.getKey(), entry.getValue());
                    if (book != null) {
                        books.add(book);
                        if (onBookFound != null) {
                            onBookFound.accept(book);
                        }
                    }
                });
            }
        }

        log.info("[UrbanComics] Completed scrape: {} books", books.size());
        return books;
    }

    private void crawlAParaitre(boolean fullScan, BooleanSupplier isStopped, Map<String, TargetHint> targets) {
        String baseAP = "https://www.urban-comics.com/a-paraitre/";
        Document doc = fetchDocument(baseAP);
        if (doc != null) {
            extractComicsContainers(doc, targets);
        }

        if (isStopped != null && isStopped.getAsBoolean()) return;

        LocalDate now = LocalDate.now();
        int curYear = now.getYear();
        int curMonth = now.getMonthValue();

        List<int[]> monthsToVisit = new ArrayList<>();
        if (fullScan) {
            for (int y = 2012; y <= curYear + 1; y++) {
                for (int m = 0; m < 12; m++) {
                    monthsToVisit.add(new int[]{m, y});
                }
            }
        } else {
            for (int offset = -3; offset < 10; offset++) {
                int val = curMonth - 1 + offset;
                int targetMonthIdx = ((val % 12) + 12) % 12;
                int yearOffset = val < 0 ? (val - 11) / 12 : val / 12;
                monthsToVisit.add(new int[]{targetMonthIdx, curYear + yearOffset});
            }
        }

        for (int[] my : monthsToVisit) {
            if (isStopped != null && isStopped.getAsBoolean()) break;
            String monthSlug = ALL_MONTH_SLUGS.get(my[0]);
            int year = my[1];

            String url = String.format("https://www.urban-comics.com/a-paraitre/%s/%d/", monthSlug, year);
            Document mDoc = fetchDocument(url);
            if (mDoc == null) {
                String uChk = String.format("https://www.urban-comics.com/checklist/%s/%d/", monthSlug, year);
                mDoc = fetchDocument(uChk);
            }
            if (mDoc != null) {
                extractComicsContainers(mDoc, targets);
            }
        }
    }

    private void extractComicsContainers(Document doc, Map<String, TargetHint> targets) {
        for (Element container : doc.select("div.comics-container")) {
            Element a = container.select("a[href]").first();
            if (a == null) continue;

            String href = a.attr("href").split("\\?")[0].replaceAll("/+$", "") + "/";
            if (!href.contains("urban-comics.com")) continue;

            boolean skip = false;
            for (String s : List.of("/a-paraitre", "/checklist", "/shop", "/category", "/auteurs")) {
                if (href.contains(s)) {
                    skip = true;
                    break;
                }
            }
            if (skip) continue;

            LocalDate relDate = null;
            Element header = container.select("div.comics-container-header").first();
            if (header != null) {
                relDate = FrenchDateParser.parse(header.text().trim());
            }

            String coverUrl = "";
            Element img = container.select("img").first();
            if (img != null) {
                coverUrl = img.attr("src");
                if (coverUrl.isBlank()) coverUrl = img.attr("data-lazy-src");
            }

            String captionTitle = "";
            int captionPrice = 0;
            Element caption = container.select("div.caption").first();
            if (caption != null) {
                Element h = caption.select("h3, h5").first();
                if (h != null) captionTitle = TextCleaner.cleanText(h.text().trim());

                Element priceB = caption.select("div.caption-prix").first();
                if (priceB != null) {
                    Matcher m = RE_DIGITS_ONLY.matcher(priceB.text());
                    if (m.find()) {
                        try {
                            captionPrice = Integer.parseInt(m.group(1));
                        } catch (NumberFormatException ignored) {}
                    }
                }
            }

            TargetHint existing = targets.get(href);
            if (existing == null) {
                targets.put(href, new TargetHint(captionTitle, coverUrl, captionPrice, relDate, ""));
            } else {
                targets.put(href, new TargetHint(
                        existing.title().isBlank() ? captionTitle : existing.title(),
                        existing.coverUrl().isBlank() ? coverUrl : existing.coverUrl(),
                        existing.price() == 0 ? captionPrice : existing.price(),
                        existing.releaseDate() == null ? relDate : existing.releaseDate(),
                        existing.isbn()
                ));
            }
        }
    }

    private void crawlShop(boolean fullScan, BooleanSupplier isStopped, Map<String, TargetHint> targets) {
        int maxPages = fullScan ? 200 : 1;
        for (int page = 1; page <= maxPages; page++) {
            if (isStopped != null && isStopped.getAsBoolean()) break;

            String url = page > 1 ? "https://www.urban-comics.com/shop/page/" + page + "/" : "https://www.urban-comics.com/shop/";
            Document doc = fetchDocument(url);
            if (doc == null) break;

            Elements items = doc.select("li.product, div.product, article.product");
            if (items.isEmpty()) break;

            int count = 0;
            for (Element tag : items) {
                Element a = tag.select("a[href]").first();
                if (a == null) continue;

                String href = a.attr("href").split("\\?")[0].replaceAll("/+$", "") + "/";
                if (!href.contains("urban-comics.com")) continue;

                boolean skip = false;
                for (String s : List.of("/shop", "/category", "/auteurs", "/tag", "/collection")) {
                    if (href.contains(s)) {
                        skip = true;
                        break;
                    }
                }
                if (skip) continue;

                String title = "";
                Element tEl = tag.select(".woocommerce-loop-product__title, .product-title, .title, h2, h3").first();
                if (tEl != null) title = TextCleaner.cleanText(tEl.text().trim());

                String coverUrl = "";
                Element img = tag.select("img").first();
                if (img != null) {
                    for (String attr : List.of("src", "data-lazy-src", "data-src")) {
                        String v = img.attr(attr);
                        if (!v.isBlank()) {
                            coverUrl = v;
                            break;
                        }
                    }
                }

                int price = 0;
                Element pEl = tag.select(".price, .amount").first();
                if (pEl != null) {
                    Matcher m = RE_PRICE_DECIMAL.matcher(pEl.text());
                    if (m.find()) {
                        try {
                            price = Integer.parseInt(m.group(1));
                        } catch (NumberFormatException ignored) {}
                    }
                }

                TargetHint existing = targets.get(href);
                if (existing == null) {
                    targets.put(href, new TargetHint(title, coverUrl, price, null, ""));
                } else {
                    targets.put(href, new TargetHint(
                            existing.title().isBlank() ? title : existing.title(),
                            existing.coverUrl().isBlank() ? coverUrl : existing.coverUrl(),
                            existing.price() == 0 ? price : existing.price(),
                            existing.releaseDate(),
                            existing.isbn()
                    ));
                }
                count++;
            }

            if (count == 0 || !fullScan) break;
        }
    }

    private void crawlSitemaps(boolean fullScan, BooleanSupplier isStopped, Map<String, TargetHint> targets) {
        List<String> sitemaps = List.of(
                "https://www.urban-comics.com/product-sitemap3.xml",
                "https://www.urban-comics.com/product-sitemap2.xml",
                "https://www.urban-comics.com/product-sitemap1.xml",
                "https://www.urban-comics.com/post-sitemap1.xml"
        );

        for (String smUrl : sitemaps) {
            if (isStopped != null && isStopped.getAsBoolean()) break;

            String xml = fetchString(smUrl);
            if (xml == null || xml.isBlank()) continue;

            try {
                Document doc = Jsoup.parse(xml, "", Parser.xmlParser());
                for (Element urlEl : doc.select("url")) {
                    Element loc = urlEl.select("loc").first();
                    if (loc == null) continue;

                    String cleanUrl = loc.text().split("\\?")[0].replaceAll("/+$", "") + "/";
                    if (!cleanUrl.contains("urban-comics.com")) continue;

                    boolean skip = false;
                    for (String s : List.of("/shop", "/category", "/auteurs", "/tag", "/collection", "/a-paraitre", "/checklist")) {
                        if (cleanUrl.contains(s)) {
                            skip = true;
                            break;
                        }
                    }
                    if (skip) continue;

                    String imgTitle = "";
                    String imgUrl = "";
                    Element imgEl = urlEl.select("image|image, image").first();
                    if (imgEl != null) {
                        Element imgLoc = imgEl.select("image|loc, loc").first();
                        Element imgT = imgEl.select("image|title, title").first();
                        if (imgLoc != null) imgUrl = imgLoc.text().trim();
                        if (imgT != null) imgTitle = imgT.text().trim();
                    }

                    LocalDate relDate = null;
                    Element lastMod = urlEl.select("lastmod").first();
                    if (lastMod != null) {
                        String lm = lastMod.text().trim();
                        if (lm.length() >= 10) lm = lm.substring(0, 10);
                        relDate = FrenchDateParser.parse(lm);
                    }

                    TargetHint existing = targets.get(cleanUrl);
                    if (existing == null) {
                        targets.put(cleanUrl, new TargetHint(imgTitle, imgUrl, 0, relDate, ""));
                    } else {
                        targets.put(cleanUrl, new TargetHint(
                                existing.title().isBlank() ? imgTitle : existing.title(),
                                existing.coverUrl().isBlank() ? imgUrl : existing.coverUrl(),
                                existing.price(),
                                existing.releaseDate() == null ? relDate : existing.releaseDate(),
                                existing.isbn()
                        ));
                    }
                }
            } catch (Exception ignored) {}
        }
    }

    private ScrapedBookDTO scrapeProductPage(String url, TargetHint hints) {
        if (hints == null) hints = new TargetHint("", "", 0, null, "");

        Document doc = fetchDocument(url);
        if (doc == null) {
            String slug = url.replaceAll("/+$", "");
            slug = slug.substring(slug.lastIndexOf('/') + 1);
            for (String s : List.of("shop", "category", "auteurs", "tag", "collection", "cart", "mon-compte")) {
                if (slug.contains(s)) return null;
            }
            String fallbackTitle = hints.title().isBlank() ? TextCleaner.titleCase(slug.replace('-', ' ')) : hints.title();
            if (fallbackTitle.length() < 2) return null;

            SeriesVolume sv = parseSeriesAndVolume(fallbackTitle, null);
            Integer volume = sv.volume() != null ? sv.volume() : 1;
            LocalDate relDate = hints.releaseDate() != null ? hints.releaseDate() : LocalDate.now();

            return ScrapedBookDTO.builder()
                    .title(TextCleaner.truncate(TextCleaner.cleanText(fallbackTitle), 255))
                    .seriesName(TextCleaner.truncate(TextCleaner.cleanText(sv.series()), 255))
                    .volume(volume)
                    .isbn(hints.isbn())
                    .editorName("Urban Comics")
                    .categoryName("Comics")
                    .pageCount(0)
                    .price(hints.price())
                    .description("")
                    .coverUrl(hints.coverUrl())
                    .releaseDate(relDate)
                    .bookType("Comics")
                    .authors(Collections.emptyList())
                    .sourceUrl(url)
                    .build();
        }

        String pageContent = doc.html();

        // 1. Title
        String title = "";
        Element h1 = doc.select("#titre-album, h1.product_title, h1.entry-title, h1").first();
        if (h1 != null) title = h1.text().trim();
        if (title.isBlank()) {
            Element ogTitle = doc.select("meta[property='og:title']").first();
            if (ogTitle != null) {
                title = ogTitle.attr("content").split(" - Urban Comics")[0].trim();
            }
        }
        if (title.isBlank()) title = hints.title();
        if (title.isBlank()) {
            String slug = url.replaceAll("/+$", "");
            slug = slug.substring(slug.lastIndexOf('/') + 1);
            title = TextCleaner.titleCase(slug.replace('-', ' '));
        }
        title = TextCleaner.cleanText(title);

        // 2. Series & Volume
        SeriesVolume sv = parseSeriesAndVolume(title, doc);

        // 3. Metadata
        String isbn = hints.isbn();
        int pageCount = 0;
        int price = hints.price();
        LocalDate releaseDate = hints.releaseDate();

        Matcher eanM = RE_URBAN_EAN.matcher(pageContent);
        if (eanM.find()) {
            isbn = eanM.group(1);
        } else if (isbn.isBlank()) {
            Element dataEan = doc.select("[data-ean]").first();
            if (dataEan != null && !dataEan.attr("data-ean").isBlank()) {
                isbn = dataEan.attr("data-ean");
            } else {
                Matcher imgEan = RE_URBAN_ALBUM_EAN.matcher(pageContent);
                if (imgEan.find()) isbn = imgEan.group(1);
            }
        }

        Matcher pagM = RE_URBAN_PAGINATION.matcher(pageContent);
        if (pagM.find()) {
            try {
                pageCount = Integer.parseInt(pagM.group(1));
            } catch (NumberFormatException ignored) {}
        }

        Matcher prcM = RE_URBAN_PRICE_HTML.matcher(pageContent);
        if (prcM.find()) {
            try {
                price = Integer.parseInt(prcM.group(1));
            } catch (NumberFormatException ignored) {}
        } else if (price == 0) {
            Matcher rawP = RE_URBAN_RAW_PRICE.matcher(pageContent);
            if (rawP.find()) {
                try {
                    price = Integer.parseInt(rawP.group(1));
                } catch (NumberFormatException ignored) {}
            }
        }

        Matcher rdm = RE_URBAN_RELEASE_DATE.matcher(pageContent);
        if (rdm.find()) {
            LocalDate parsedD = FrenchDateParser.parse(rdm.group(1));
            if (parsedD != null) releaseDate = parsedD;
        }
        if (releaseDate == null) {
            releaseDate = LocalDate.now();
        }

        // 4. Cover
        String coverUrl = hints.coverUrl();
        Element cvImg = doc.select("img.single-product-cover, img[class*='single-product-cover']").first();
        if (cvImg != null && !cvImg.attr("src").isBlank()) {
            coverUrl = cvImg.attr("src");
        } else if (coverUrl.isBlank()) {
            Element ogImg = doc.select("meta[property='og:image']").first();
            if (ogImg != null && !ogImg.attr("content").isBlank()) {
                coverUrl = ogImg.attr("content");
            } else if (!isbn.isBlank()) {
                coverUrl = String.format("https://bdi.dlpdomain.com/album/%s/couv/M385x862/%s.jpg", isbn, slugTitle(title));
            }
        }

        // 5. Description
        String description = parseDescription(doc);

        // 6. Authors
        List<ScrapedAuthorDTO> authors = parseAuthors(doc);

        // 7. Collection
        String collectionName = "";
        Matcher colM = RE_URBAN_COLLECTION.matcher(pageContent);
        if (colM.find()) {
            collectionName = TextCleaner.cleanText(colM.group(1));
        }

        return ScrapedBookDTO.builder()
                .title(TextCleaner.truncate(title, 255))
                .seriesName(TextCleaner.truncate(sv.series(), 255))
                .volume(sv.volume())
                .isbn(isbn)
                .editorName("Urban Comics")
                .collectionName(collectionName)
                .categoryName("Comics")
                .pageCount(pageCount)
                .price(price)
                .description(description)
                .coverUrl(coverUrl)
                .releaseDate(releaseDate)
                .bookType("Comics")
                .authors(authors)
                .sourceUrl(url)
                .build();
    }

    public static record SeriesVolume(String series, Integer volume) {}

    public static SeriesVolume parseSeriesAndVolume(String title, Document doc) {
        String seriesName = "";
        Integer volume = null;

        if (doc != null) {
            Element serieDiv = doc.select("div.serie_album").first();
            if (serieDiv != null) {
                Element a = serieDiv.select("a").first();
                if (a != null && !a.text().isBlank()) {
                    seriesName = a.text().trim();
                } else {
                    seriesName = RE_URBAN_SERIE_PREFIX.matcher(serieDiv.text()).replaceAll("").trim();
                }
            }
        }

        Matcher vm = RE_URBAN_VOL_MATCH.matcher(title);
        if (vm.find()) {
            try {
                volume = Integer.parseInt(vm.group(1));
            } catch (NumberFormatException ignored) {}
        } else {
            Matcher im = RE_URBAN_INT_MATCH.matcher(title);
            if (im.find()) {
                try {
                    volume = Integer.parseInt(im.group(1));
                } catch (NumberFormatException ignored) {}
            }
        }

        if (seriesName.isBlank()) {
            if (vm.reset().find()) {
                seriesName = RE_URBAN_VOL_STRIP.matcher(title).replaceAll("").replaceAll("^[ :\\-]+|[ :\\-]+$", "").trim();
            } else if (RE_URBAN_INTEGRALE.matcher(title).find()) {
                seriesName = RE_URBAN_INT_STRIP.matcher(title).replaceAll("").replaceAll("^[ :\\-]+|[ :\\-]+$", "").trim();
            } else {
                seriesName = title;
            }
        }

        return new SeriesVolume(TextCleaner.cleanText(seriesName.isBlank() ? title : seriesName), volume);
    }

    public static List<ScrapedAuthorDTO> parseAuthors(Document doc) {
        List<ScrapedAuthorDTO> authors = new ArrayList<>();
        Element h5 = doc.select("h5.authors").first();
        if (h5 == null) return authors;

        String currentRole = "Writer";
        for (Node child : h5.childNodes()) {
            if (child instanceof TextNode textNode) {
                String txt = textNode.text().toLowerCase().trim();
                if (txt.contains("scénari") || txt.contains("scenar") || txt.contains("auteur") || txt.contains("histoire")) {
                    currentRole = "Writer";
                } else if (txt.contains("dessin") || txt.contains("illustrat") || txt.contains("artiste")) {
                    currentRole = "Illustrator";
                } else if (txt.contains("color") || txt.contains("couleur")) {
                    currentRole = "Colorist";
                } else if (txt.contains("traduct")) {
                    currentRole = "Translator";
                } else if (txt.contains("encre")) {
                    currentRole = "Inker";
                } else if (txt.contains("lettr")) {
                    currentRole = "Letterer";
                }
            } else if (child instanceof Element el && "a".equalsIgnoreCase(el.tagName())) {
                String rawName = TextCleaner.cleanText(el.text().trim());
                String low = rawName.toLowerCase();
                if (rawName.isBlank() || low.contains("interview") || low.contains("portfolio") || low.contains("auteur") || low.contains("actualité")) {
                    continue;
                }
                String[] parts = rawName.split("\\s+");
                if (parts.length >= 2) {
                    String fn = TextCleaner.capitalize(parts[0]);
                    String ln = TextCleaner.titleCase(String.join(" ", Arrays.copyOfRange(parts, 1, parts.length)));
                    authors.add(new ScrapedAuthorDTO(fn, ln, currentRole));
                } else if (parts.length == 1) {
                    authors.add(new ScrapedAuthorDTO("", TextCleaner.titleCase(parts[0]), currentRole));
                }
            }
        }
        return authors;
    }

    public static String parseDescription(Document doc) {
        Element eight = doc.select("div.eightcol").first();
        if (eight != null) {
            Element h1 = eight.select("h1, h2").first();
            boolean start = false;
            StringBuilder sb = new StringBuilder();
            for (Node child : eight.childNodes()) {
                if (h1 != null && child == h1) {
                    start = true;
                    continue;
                }
                if (start) {
                    if (child instanceof Element el) {
                        String tag = el.tagName().toLowerCase();
                        if (List.of("div", "ul", "h5", "h3", "h4", "form", "script").contains(tag)) {
                            break;
                        }
                        String t = el.text().trim();
                        if (!t.isBlank()) sb.append(t).append(" ");
                    } else if (child instanceof TextNode tn) {
                        String t = tn.text().trim();
                        if (!t.isBlank()) sb.append(t).append(" ");
                    }
                }
            }
            String desc = sb.toString().trim();
            if (desc.length() > 30) {
                return TextCleaner.cleanText(desc);
            }
        }

        Element ogDesc = doc.select("meta[property='og:description']").first();
        if (ogDesc != null && !ogDesc.attr("content").isBlank()) {
            return TextCleaner.cleanText(ogDesc.attr("content"));
        }

        Element entry = doc.select("div.entry-content").first();
        if (entry != null) {
            List<String> pTexts = new ArrayList<>();
            for (Element p : entry.select("p")) {
                String t = p.text().trim();
                if (!t.isBlank()) pTexts.add(t);
            }
            if (!pTexts.isEmpty()) {
                if (pTexts.size() > 3) pTexts = pTexts.subList(0, 3);
                return TextCleaner.cleanText(String.join("\n\n", pTexts));
            }
        }

        return "";
    }

    public static String slugTitle(String title) {
        return title.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("^-+|-+$", "");
    }
}
