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

@Slf4j
@Component
public class MonsieurToussaintLouvertureSource extends AbstractHttpSource {

    private static final Map<String, Integer> ROMAN_NUMS = Map.of(
            "i", 1, "ii", 2, "iii", 3, "iv", 4, "v", 5, "vi", 6, "vii", 7, "viii", 8, "ix", 9, "x", 10
    );

    private static final Map<String, Integer> FRENCH_ORDINALS = Map.ofEntries(
            Map.entry("premier", 1), Map.entry("premiere", 1), Map.entry("première", 1),
            Map.entry("deuxieme", 2), Map.entry("deuxième", 2), Map.entry("second", 2), Map.entry("seconde", 2),
            Map.entry("troisieme", 3), Map.entry("troisième", 3),
            Map.entry("quatrieme", 4), Map.entry("quatrième", 4),
            Map.entry("cinquieme", 5), Map.entry("cinquième", 5)
    );

    private static final List<String> OBJET_KEYWORDS = List.of(
            "sérigraphie", "serigraphie", "carnet", "tasse", "t-shirt", "affiche",
            "badge", "marque-page", "miniature", "(vide)", " vide", "tote bag", "ex-libris"
    );

    private static final Pattern RE_MTL_VOL = Pattern.compile("(?i)[\\s–\\-]+(?:Volume|Tome|T\\.?)\\s*0?(\\d+)");
    private static final Pattern RE_MTL_FRAC = Pattern.compile("[\\s–\\-]+.*?(\\d+)\\s*/\\s*\\d+");
    private static final Pattern RE_MTL_FRAC_S = Pattern.compile("^(.*?)(?:[\\s–\\-]+Rapport|[\\s–\\-]+\\d+\\s*/)");
    private static final Pattern RE_MTL_ROMAN = Pattern.compile("(?i)\\b(Blackwater|Swan Song)\\s+([IVX]+)\\b");
    private static final Pattern RE_MTL_ORDINAL = Pattern.compile("(?i)[\\s–\\-]+Livre\\s+(premier|premi[eè]re|deuxi[eè]me|second|seconde|troisi[eè]me|quatri[eè]me|\\d+)");

    private static final Pattern RE_MTL_EAN = Pattern.compile("EAN\\s*:\\s*([0-9]{13})");
    private static final Pattern RE_MTL_ISBN = Pattern.compile("\\b(97[89][0-9]{10})\\b");
    private static final Pattern RE_MTL_SUB_STRIP = Pattern.compile("(?i)[\\s–\\-]+(?:[ée]dition|collection).*");
    private static final Pattern RE_MTL_AUTHOR = Pattern.compile("(?i)(?:Écrit et dessiné|Écrit|Roman de|Un roman de)\\s+par\\s+([^.,\\n\\r]+)");
    private static final Pattern RE_MTL_PRICE = Pattern.compile("(\\d+)(?:[,\\.]\\d+)?");
    private static final Pattern RE_MTL_PAGES_SPEC = Pattern.compile("(?i)(\\d+)\\s*pages(?:\\s+couleurs?)?\\.?\\s*(?:Format|\\d+\\s*x\\s*\\d+|Couverture|Prix|\\.)");
    private static final Pattern RE_MTL_PAGES_ALL = Pattern.compile("(?i)(\\d{2,4})\\s*pages");
    private static final Pattern RE_MTL_DATE = Pattern.compile("(?i)Date de (?:parution|publication)\\s*[:\\s]+\\s*([0-9]{1,2}\\s+[a-zà-ÿ]+\\s+[0-9]{4})");
    private static final Pattern RE_MTL_YEAR = Pattern.compile("\\b(20[12][0-9])\\b");

    private record MtlCollectionConfig(String url, String collection, String category) {}

    private static final List<MtlCollectionConfig> MTL_COLLECTIONS = List.of(
            new MtlCollectionConfig("https://www.monsieurtoussaintlouverture.com/categorie-produit/boutique/bibliotheque-mccammon/", "Bibliothèque McCammon", "Roman"),
            new MtlCollectionConfig("https://www.monsieurtoussaintlouverture.com/categorie-produit/boutique/grands-romans/", "Grands Romans", "Roman"),
            new MtlCollectionConfig("https://www.monsieurtoussaintlouverture.com/categorie-produit/boutique/monsieur-toussaint-laventure/", "Monsieur Toussaint Laventure", "Roman"),
            new MtlCollectionConfig("https://www.monsieurtoussaintlouverture.com/categorie-produit/boutique/blackwater/", "Bibliothèque McDowell", "Roman"),
            new MtlCollectionConfig("https://www.monsieurtoussaintlouverture.com/categorie-produit/boutique/grands-animaux/", "Les Grands Animaux", "Roman"),
            new MtlCollectionConfig("https://www.monsieurtoussaintlouverture.com/categorie-produit/boutique/romans-graphiques/", "Romans Graphiques", "Roman Graphique")
    );

    public MonsieurToussaintLouvertureSource(ScraperProperties properties) {
        super(properties);
    }

    @Override
    public String getId() {
        return "monsieur_toussaint_louverture";
    }

    @Override
    public String getName() {
        return "Monsieur Toussaint Louverture";
    }

    @Override
    public String getDescription() {
        return "Romans, littératures de l'imaginaire, aventures et romans graphiques (Blackwater, McCammon, etc.)";
    }

    @Override
    public String getColor() {
        return "#d97706";
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

        record ProdEntry(String url, String category) {}
        List<ProdEntry> entries = new ArrayList<>();
        Set<String> seenUrls = new HashSet<>();

        log.info("[MTL] Gathering books from 6 authorized boutique collections (fullScan={}, maxItems={})", fullScan, maxItems);

        for (MtlCollectionConfig colInfo : MTL_COLLECTIONS) {
            if (isStopped != null && isStopped.getAsBoolean()) break;
            if (!fullScan && entries.size() >= maxItems) break;

            int page = 1;
            while (true) {
                if (isStopped != null && isStopped.getAsBoolean()) break;
                if (!fullScan && entries.size() >= maxItems) break;

                String pageUrl = colInfo.url();
                if (page > 1) {
                    String clean = pageUrl.replaceAll("/+$", "");
                    pageUrl = clean + "/page/" + page + "/";
                }

                Document doc = fetchDocument(pageUrl);
                if (doc == null) break;

                Elements productCards = doc.select(".product");
                if (productCards.isEmpty()) break;

                int foundOnPage = 0;
                for (Element card : productCards) {
                    Element a = card.select("a[href]").first();
                    if (a == null) continue;

                    String href = a.attr("href").split("\\?")[0].replaceAll("/+$", "") + "/";
                    if (!href.contains("/produit/") || seenUrls.contains(href)) {
                        continue;
                    }

                    String cardText = card.text().toLowerCase().trim();
                    if (containsAny(cardText, OBJET_KEYWORDS) || href.contains("objets") || href.contains("coffret-lheure-du-loup-vide")) {
                        continue;
                    }
                    if (cardText.contains("/ epub") || cardText.contains("livre numérique") || cardText.contains("livres numériques") || href.contains("/epub")) {
                        continue;
                    }

                    seenUrls.add(href);
                    entries.add(new ProdEntry(href, colInfo.category()));
                    foundOnPage++;

                    if (!fullScan && entries.size() >= maxItems) {
                        break;
                    }
                }

                boolean hasNext = !doc.select("a[class*='next']").isEmpty();
                if (!hasNext || foundOnPage == 0) {
                    break;
                }
                page++;
            }
        }

        log.info("[MTL] Found {} product URLs to process", entries.size());

        for (ProdEntry entry : entries) {
            if (isStopped != null && isStopped.getAsBoolean()) break;

            ScrapedBookDTO book = scrapeBookPage(entry.url(), entry.category());
            if (book != null) {
                books.add(book);
                if (onBookFound != null) {
                    onBookFound.accept(book);
                }
                if (!fullScan && books.size() >= maxItems) {
                    break;
                }
            }
        }

        log.info("[MTL] Finished: {} books", books.size());
        return books;
    }

    private ScrapedBookDTO scrapeBookPage(String url, String defaultCategory) {
        Document doc = fetchDocument(url);
        if (doc == null) return null;

        String rawHtml = doc.html();
        String pageText = doc.text();

        // 1. Meta check
        Element metaEl = doc.select("div.product_meta").first();
        String metaText = metaEl != null ? metaEl.text().trim() : "";
        String metaLower = metaText.toLowerCase();

        if (metaLower.contains("objets") || metaLower.contains("livres numériques") || metaLower.contains("epub")) {
            return null;
        }

        // 2. Title
        Element h1 = doc.select("h1.product_title").first();
        if (h1 == null) h1 = doc.select("h1").first();
        if (h1 == null) return null;

        String title = TextCleaner.cleanText(h1.text().trim());
        if (title.isBlank() || title.toLowerCase().startsWith("oooops")) {
            return null;
        }

        String titleLower = title.toLowerCase();
        if (containsAny(titleLower, OBJET_KEYWORDS) || titleLower.contains("/ epub") || titleLower.contains("livre numérique")) {
            return null;
        }

        // 3. EAN / ISBN
        String ean = "";
        Matcher eanM = RE_MTL_EAN.matcher(metaText);
        if (eanM.find()) {
            ean = eanM.group(1);
        } else {
            Matcher isbnM = RE_MTL_ISBN.matcher(pageText);
            if (isbnM.find()) {
                ean = isbnM.group(1);
            }
        }
        if (ean.isBlank()) {
            return null;
        }

        // 4. Author
        List<ScrapedAuthorDTO> authors = new ArrayList<>();
        String authorName = "";
        Element sub = doc.select("div.mtl-product-subtitle").first();
        if (sub != null) {
            String rawSub = sub.text().trim();
            String authorStr = RE_MTL_SUB_STRIP.matcher(rawSub).replaceAll("").trim();
            String lowAuth = authorStr.toLowerCase();
            if (!authorStr.isBlank() && !lowAuth.contains("toussaint") && !lowAuth.contains("livre")
                    && !lowAuth.contains("tome") && !lowAuth.contains("volume")) {
                authorName = authorStr;
            }
        }
        if (authorName.isBlank()) {
            Matcher am = RE_MTL_AUTHOR.matcher(pageText);
            if (am.find()) {
                authorName = am.group(1).trim();
            }
        }
        if (!authorName.isBlank()) {
            String[] split = TextCleaner.splitAuthorName(authorName);
            if (!split[1].isBlank()) {
                authors.add(new ScrapedAuthorDTO(split[0], split[1], "Writer"));
            }
        }

        // 5. Price
        int price = 0;
        Element priceTag = doc.select("div.price-wrapper, p.price").first();
        if (priceTag != null) {
            Matcher pm = RE_MTL_PRICE.matcher(priceTag.text());
            if (pm.find()) {
                try {
                    price = Integer.parseInt(pm.group(1));
                } catch (NumberFormatException ignored) {}
            }
        }

        // 6. Page count
        int pageCount = 0;
        Matcher pgm = RE_MTL_PAGES_SPEC.matcher(rawHtml);
        if (pgm.find()) {
            try {
                pageCount = Integer.parseInt(pgm.group(1));
            } catch (NumberFormatException ignored) {}
        } else {
            Matcher allP = RE_MTL_PAGES_ALL.matcher(pageText);
            while (allP.find()) {
                try {
                    int p = Integer.parseInt(allP.group(1));
                    if (p >= 40) {
                        pageCount = p;
                        break;
                    }
                } catch (NumberFormatException ignored) {}
            }
        }

        // 7. Release date
        LocalDate releaseDate = null;
        Matcher rdm = RE_MTL_DATE.matcher(pageText);
        if (rdm.find()) {
            releaseDate = FrenchDateParser.parse(rdm.group(1).trim());
        }
        if (releaseDate == null) {
            Matcher ym = RE_MTL_YEAR.matcher(pageText);
            if (ym.find()) {
                try {
                    releaseDate = LocalDate.of(Integer.parseInt(ym.group(1)), 1, 1);
                } catch (Exception ignored) {}
            }
        }
        if (releaseDate == null) {
            releaseDate = LocalDate.now();
        }

        // 8. Description
        String description = "";
        Element shortDesc = doc.select("div.product-short-description").first();
        if (shortDesc != null) {
            String t = TextCleaner.cleanText(shortDesc.text().trim());
            if (t.length() > 30) description = t;
        }
        if (description.isBlank()) {
            Element descPanel = doc.select("div[class*='woocommerce-Tabs-panel--description']").first();
            if (descPanel != null) {
                for (Element p : descPanel.select("p")) {
                    String t = TextCleaner.cleanText(p.text().trim());
                    String low = t.toLowerCase();
                    if (t.length() > 60 && !low.contains("cookie") && !low.contains("newsletter") && !low.contains("harmonia mundi")) {
                        description = t;
                        break;
                    }
                }
            }
        }
        if (description.isBlank()) {
            description = "Ouvrage Monsieur Toussaint Louverture : " + title;
        }

        // 9. Cover
        String coverUrl = "";
        Element imgDiv = doc.select("div.woocommerce-product-gallery__image").first();
        if (imgDiv != null) {
            Element aImg = imgDiv.select("a[href]").first();
            if (aImg != null) {
                coverUrl = aImg.attr("href");
            } else {
                Element imgEl = imgDiv.select("img").first();
                if (imgEl != null) coverUrl = imgEl.attr("src");
            }
        }
        if (coverUrl.isBlank()) {
            Element imgTag = doc.select("img[class*='wp-post-image']").first();
            if (imgTag != null) coverUrl = imgTag.attr("src");
        }

        // 10. Series & Volume
        SeriesVolume sv = parseMTLSeriesAndVolume(title);
        String seriesName = sv.series().isBlank() ? title : sv.series();
        Integer volume = sv.volume();

        // 11. Category
        String catName = defaultCategory;
        String bookType = "Roman";
        if (metaLower.contains("bandes dessinées") || metaLower.contains("roman graphique")) {
            catName = "Roman Graphique";
            bookType = "Roman Graphique";
        }

        return ScrapedBookDTO.builder()
                .title(TextCleaner.truncate(title, 255))
                .seriesName(TextCleaner.truncate(seriesName, 255))
                .volume(volume)
                .isbn(ean)
                .editorName("Monsieur Toussaint Louverture")
                .categoryName(catName)
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

    public static record SeriesVolume(String series, Integer volume) {}

    public static SeriesVolume parseMTLSeriesAndVolume(String title) {
        String seriesName = title;

        // 1. Volume X, Tome X
        Matcher vm = RE_MTL_VOL.matcher(title);
        if (vm.find()) {
            try {
                int v = Integer.parseInt(vm.group(1));
                seriesName = title.substring(0, vm.start()).replaceAll("^[ –-:,]+|[ –-:,]+$", "").trim();
                return new SeriesVolume(seriesName, v);
            } catch (NumberFormatException ignored) {}
        }

        // 2. Fractions (e.g. 1/3, 2/3)
        Matcher fm = RE_MTL_FRAC.matcher(title);
        if (fm.find()) {
            try {
                int v = Integer.parseInt(fm.group(1));
                Matcher fms = RE_MTL_FRAC_S.matcher(title);
                if (fms.find()) {
                    seriesName = fms.group(1).replaceAll("^[ –-:,]+|[ –-:,]+$", "").trim();
                }
                return new SeriesVolume(seriesName, v);
            } catch (NumberFormatException ignored) {}
        }

        // 3. Roman numerals (Blackwater I, Swan Song II)
        Matcher rm = RE_MTL_ROMAN.matcher(title);
        if (rm.find()) {
            seriesName = rm.group(1);
            String rom = rm.group(2).toLowerCase();
            Integer v = ROMAN_NUMS.get(rom);
            return new SeriesVolume(seriesName, v);
        }

        // 4. Ordinals (Livre premier, Livre deuxième)
        Matcher om = RE_MTL_ORDINAL.matcher(title);
        if (om.find()) {
            String val = om.group(1).toLowerCase();
            Integer v = FRENCH_ORDINALS.get(val);
            if (v == null) {
                try {
                    v = Integer.parseInt(val);
                } catch (NumberFormatException ignored) {}
            }
            seriesName = title.substring(0, om.start()).replaceAll("^[ –-:,]+|[ –-:,]+$", "").trim();
            return new SeriesVolume(seriesName, v);
        }

        return new SeriesVolume(seriesName, null);
    }

    private static boolean containsAny(String text, List<String> keywords) {
        for (String k : keywords) {
            if (text.contains(k)) return true;
        }
        return false;
    }
}
