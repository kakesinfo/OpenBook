package fr.openbook.api.importing.bnf;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.StringReader;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Component
public class BnfClient {

    private static final String BNF_SRU_BASE_URL = "https://catalogue.bnf.fr/api/SRU";
    private static final String BNF_USER_AGENT = "YetAnotherLibrary/1.0 (https://github.com/yet-another-library)";

    private static final Pattern RE_BNF_PUB_CLEANUP = Pattern.compile("(?i)\\b(?:comics|éditions|editions|manga|bd|publishing|presse)\\b");
    private static final Pattern RE_BNF_CQL_CHARS = Pattern.compile("[\"\\(\\)\\{\\}\\[\\]:\\-<>=\\/\\\\]");
    private static final Pattern RE_BNF_CREATOR_ROLES = Pattern.compile("(?i)[\\.\\s]*(?:\\((?:auteur|illustrateur|coloriste|traducteur|directeur)[^\\)]*\\)|\\b(?:auteur|illustrateur|coloriste|traducteur)(?:\\s+du\\s+texte)?\\b)[\\.\\s]*");
    private static final Pattern RE_BNF_CREATOR_DATES = Pattern.compile("\\(\\s*[\\d\\.]{2,4}\\s*-[^\\)]*\\)");
    private static final Pattern RE_BNF_CREATOR_FUNC = Pattern.compile("(?i)[\\.\\s]*\\b(?:fonction\\s+indéterminée|collaborateur\\s+au\\s+texte|préfacier|directeur\\s+de\\s+publication)\\b.*");
    private static final Pattern RE_BNF_PAGE_COUNT = Pattern.compile("(?i)\\[?(?:ca\\s*)?(\\d{2,4})\\]?\\s*p(?:ages?)?\\.?\\b");
    private static final Pattern RE_BNF_YEAR = Pattern.compile("\\b(19\\d{2}|20\\d{2})\\b");
    private static final Pattern RE_BNF_FULL_DATE = Pattern.compile("(\\d{4})-(\\d{2})-(\\d{2})");
    private static final Pattern RE_BNF_ISBN_IDENTIFIER = Pattern.compile("(?:ISBN|EAN)\\s*([0-9Xx\\-]{10,17})");
    private static final Pattern RE_BNF_NON_ISBN = Pattern.compile("[^0-9Xx]");
    private static final Pattern RE_BNF_COLLECTION = Pattern.compile("(?i)Collection\\s*:\\s*([^;,\\n]+)");
    private static final Pattern RE_PRICE = Pattern.compile("([0-9]+(?:[.,][0-9]{1,2})?)");
    private static final Pattern RE_DIGITS = Pattern.compile("(\\d+)");
    private static final Pattern RE_DIMENSIONS_CM = Pattern.compile("(\\d+(?:[.,]\\d+)?)\\s*cm", Pattern.CASE_INSENSITIVE);
    private static final Pattern RE_FULL_DATE_COMPACT = Pattern.compile("^(\\d{4})(\\d{2})(\\d{2})$");

    private final RestTemplate restTemplate;

    public BnfClient(RestTemplateBuilder builder) {
        this.restTemplate = builder
                .setConnectTimeout(Duration.ofSeconds(6))
                .setReadTimeout(Duration.ofSeconds(10))
                .build();
    }

    @Cacheable(
            cacheNames = "bnf-search",
            key = "#title + '|' + #author + '|' + #editorName + '|' + #volume",
            sync = true
    )
    public BnfBookData searchBook(String title, String author, String editorName, Integer volume, int timeoutSec) {
        String cleanT = cleanTitleForCQL(title);
        if (cleanT.isBlank()) {
            return null;
        }

        String publisherTerm = cleanPublisherForCQL(editorName);
        String authorTerm = cleanAuthorForCQL(author);

        List<String> queries = new ArrayList<>();
        if (!publisherTerm.isBlank() && !authorTerm.isBlank()) {
            queries.add(String.format("(bib.title all \"%s\") and (bib.publisher all \"%s\") and (bib.author all \"%s\")", cleanT, publisherTerm, authorTerm));
        }
        if (!publisherTerm.isBlank()) {
            queries.add(String.format("(bib.title all \"%s\") and (bib.publisher all \"%s\")", cleanT, publisherTerm));
        }
        if (!authorTerm.isBlank()) {
            queries.add(String.format("(bib.title all \"%s\") and (bib.author all \"%s\")", cleanT, authorTerm));
        }
        queries.add(String.format("(bib.title all \"%s\")", cleanT));

        List<Element> records = new ArrayList<>();
        for (String q : queries) {
            try {
                records = fetchBnfRecords(q, 8);
                if (!records.isEmpty()) {
                    break;
                }
            } catch (Exception ex) {
                log.debug("[BNF] SRU query failed for '{}': {}", q, ex.getMessage());
            }
        }

        if (records.isEmpty()) {
            return null;
        }

        for (Element rec : records) {
            BnfBookData data = parseRecord(rec, volume);
            if (data != null) {
                return data;
            }
        }

        return null;
    }

    @Cacheable(
            cacheNames = "bnf-isbn",
            key = "#isbn",
            sync = true
    )
    public BnfBookData lookupByIsbn(String isbn) {
        if (isbn == null || isbn.isBlank()) {
            return null;
        }
        String cleanISBN = RE_BNF_NON_ISBN.matcher(isbn).replaceAll("");
        if (cleanISBN.length() != 10 && cleanISBN.length() != 13) {
            return null;
        }

        List<Element> records;
        try {
            records = fetchBnfRecords(String.format("bib.isbn all \"%s\"", cleanISBN), 5);
        } catch (Exception e) {
            log.warn("BNF ISBN lookup failed for {}: {}", cleanISBN, e.getMessage());
            return null;
        }

        for (Element rec : records) {
            BnfBookData data = parseRecord(rec, null);
            if (data != null) {
                return data;
            }
        }
        return null;
    }

    private BnfBookData parseRecord(Element rec, Integer volume) {
        List<String> titles = getTagValues(rec, "title");
        if (titles.isEmpty()) return null;

        List<String> types = getTagValues(rec, "type");
        for (String t : types) {
            String lt = t.toLowerCase();
            if (lt.contains("enregistrement sonore") || lt.contains("sound recording") || lt.contains("vidéo") || lt.contains("carte") || lt.contains("musique")) {
                return null;
            }
        }

        List<String> identifiers = getTagValues(rec, "identifier");
        List<String> isbns = new ArrayList<>();
        for (String idTxt : identifiers) {
            Matcher m = RE_BNF_ISBN_IDENTIFIER.matcher(idTxt);
            if (m.find()) {
                String cleanISBN = RE_BNF_NON_ISBN.matcher(m.group(1)).replaceAll("");
                if (cleanISBN.length() == 10 || cleanISBN.length() == 13) {
                    isbns.add(cleanISBN);
                }
            }
        }
        if (isbns.isEmpty()) return null;

        Integer pageCount = null;
        List<String> formats = getTagValues(rec, "format");
        for (String fmtStr : formats) {
            Integer pc = parseBnfPageCount(fmtStr);
            if (pc != null) {
                pageCount = pc;
                break;
            }
        }

        Instant releaseDate = null;
        List<String> dates = getTagValues(rec, "date");
        if (!dates.isEmpty()) {
            releaseDate = parseBnfDate(dates.get(0));
        }

        List<String> authors = new ArrayList<>();
        List<String> allCreators = new ArrayList<>();
        allCreators.addAll(getTagValues(rec, "creator"));
        allCreators.addAll(getTagValues(rec, "contributor"));
        for (String cr : allCreators) {
            String auth = parseBnfCreator(cr);
            if (!auth.isBlank()) {
                authors.add(auth);
            }
        }

        String docType = "";
        List<String> descriptions = getTagValues(rec, "description");
        List<String> subjects = getTagValues(rec, "subject");
        String fullMeta = (String.join(" ", titles) + " " + String.join(" ", formats) + " " + String.join(" ", descriptions) + " " + String.join(" ", subjects)).toLowerCase();

        if (fullMeta.contains("bande dessinée") || fullMeta.contains("bandes dessinées") || fullMeta.contains("bande-dessinée")) {
            docType = "Bande dessinée";
        } else if (fullMeta.contains("manga")) {
            docType = "Manga";
        } else if (fullMeta.contains("comic")) {
            docType = "Comics";
        } else if (fullMeta.contains("roman") || fullMeta.contains("fiction") || fullMeta.contains("nouvelles") || fullMeta.contains("récit")) {
            docType = "Roman";
        }

        String collectionName = parseBnfCollection(descriptions);

        BnfBookData bookData = new BnfBookData();
        bookData.setIsbn(isbns.get(0));
        bookData.setTitle(cleanText(titles.get(0)));
        bookData.setVolume(volume);
        bookData.setPageCount(pageCount);
        bookData.setReleaseDate(releaseDate);
        bookData.setAuthors(authors);
        bookData.setDocType(docType);
        bookData.setCollectionName(collectionName);
        return bookData;
    }

    private String parseBnfCollection(List<String> descriptions) {
        for (String desc : descriptions) {
            Matcher m = RE_BNF_COLLECTION.matcher(desc);
            if (m.find()) {
                String col = cleanText(m.group(1)).replaceAll("^[\\s.]+|[\\s.]+$", "");
                if (col.contains(".")) {
                    String[] parts = col.split("\\.");
                    for (int i = parts.length - 1; i >= 0; i--) {
                        String p = parts[i].trim();
                        if (!p.isBlank()) {
                            return p;
                        }
                    }
                }
                return col;
            }
        }
        return null;
    }

    private List<Element> fetchBnfRecords(String queryStr, int maxRecords) throws Exception {
        return fetchBnfRecords(queryStr, "dublincore", maxRecords);
    }

    private List<String> getTagValues(Element parent, String localName) {
        List<String> results = new ArrayList<>();
        NodeList nl = parent.getElementsByTagNameNS("*", localName);
        for (int i = 0; i < nl.getLength(); i++) {
            String text = nl.item(i).getTextContent();
            if (text != null && !text.isBlank()) {
                results.add(text.trim());
            }
        }
        return results;
    }

    private String cleanText(String s) {
        if (s == null) return "";
        return s.trim().replaceAll("\\s+", " ");
    }

    private String cleanTitleForCQL(String text) {
        String cleaned = cleanText(text);
        cleaned = RE_BNF_CQL_CHARS.matcher(cleaned).replaceAll(" ");
        return cleaned.replaceAll("\\s+", " ").trim();
    }

    private String cleanAuthorForCQL(String author) {
        String cleaned = cleanText(author);
        cleaned = RE_BNF_CQL_CHARS.matcher(cleaned).replaceAll(" ");
        String[] parts = cleaned.trim().split("\\s+");
        if (parts.length == 0 || parts[0].isBlank()) {
            return "";
        }
        return parts[parts.length - 1];
    }

    private String cleanPublisherForCQL(String editorName) {
        if (editorName == null || editorName.isBlank()) return "";
        String ed = editorName.trim();
        String low = ed.toLowerCase();
        if (low.contains("panini")) return "Panini";
        if (low.contains("urban")) return "Urban";
        if (low.contains("mangetsu")) return "Mangetsu";
        if (low.contains("toussaint")) return "Toussaint";
        if (low.contains("laffont")) return "Laffont";
        if (low.contains("bourgois")) return "Bourgois";
        if (low.contains("albin")) return "Albin";
        if (low.contains("bragelonne")) return "Bragelonne";
        if (low.contains("tripode")) return "Tripode";
        if (low.contains("fayard")) return "Fayard";
        if (low.contains("gallimard")) return "Gallimard";
        if (low.contains("pocket")) return "Pocket";

        ed = RE_BNF_PUB_CLEANUP.matcher(ed).replaceAll("").trim();
        return ed.replaceAll("^[\\s\\-:]+|[\\s\\-:]+$", "");
    }

    private String parseBnfCreator(String raw) {
        String rawClean = cleanText(raw);
        String cleaned = RE_BNF_CREATOR_ROLES.matcher(rawClean).replaceAll("");
        cleaned = RE_BNF_CREATOR_DATES.matcher(cleaned).replaceAll("");
        cleaned = RE_BNF_CREATOR_FUNC.matcher(cleaned).replaceAll("");
        cleaned = cleaned.replaceAll("^[\\s\\.,;:\\-]+|[\\s\\.,;:\\-]+$", "");

        String[] parts = cleaned.split(",", 2);
        if (parts.length == 2) {
            String last = parts[0].trim();
            String first = RE_BNF_CREATOR_DATES.matcher(parts[1].trim()).replaceAll("").trim();
            return (first + " " + last).trim();
        }
        return cleaned.trim();
    }

    private Integer parseBnfPageCount(String formatStr) {
        if (formatStr == null || formatStr.isBlank()) return null;
        Matcher m = RE_BNF_PAGE_COUNT.matcher(formatStr);
        if (m.find()) {
            try {
                return Integer.parseInt(m.group(1));
            } catch (NumberFormatException ignored) {}
        }
        return null;
    }

    private Instant parseBnfDate(String dateStr) {
        if (dateStr == null || dateStr.isBlank()) return null;
        String cleaned = dateStr.trim();
        Matcher mFull = RE_BNF_FULL_DATE.matcher(cleaned);
        if (mFull.find()) {
            try {
                int y = Integer.parseInt(mFull.group(1));
                int mo = Integer.parseInt(mFull.group(2));
                int d = Integer.parseInt(mFull.group(3));
                if (y > 0 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
                    return LocalDate.of(y, mo, d).atStartOfDay(ZoneOffset.UTC).toInstant();
                }
            } catch (Exception ignored) {}
        }
        Matcher mYear = RE_BNF_YEAR.matcher(cleaned);
        if (mYear.find()) {
            try {
                int y = Integer.parseInt(mYear.group(1));
                return LocalDate.of(y, 1, 1).atStartOfDay(ZoneOffset.UTC).toInstant();
            } catch (Exception ignored) {}
        }
        return null;
    }

    @Cacheable(
            cacheNames = "bnf-quick-search",
            key = "#rawQuery == null ? '' : #rawQuery.trim().toLowerCase()",
            sync = true
    )
    public List<BnfSearchResult> searchQuick(String rawQuery) {
        if (rawQuery == null || rawQuery.trim().isEmpty()) {
            return List.of();
        }
        String trimmed = rawQuery.trim();

        if (isIsbnInput(trimmed)) {
            String clean = cleanIsbnInput(trimmed);
            List<String> candidates = new ArrayList<>();
            candidates.add(clean);
            if (clean.length() == 10) {
                String alt13 = isbn10ToIsbn13(clean);
                if (alt13 != null && !candidates.contains(alt13)) {
                    candidates.add(alt13);
                }
            } else if (clean.length() == 13 && clean.startsWith("978")) {
                String alt10 = isbn13ToIsbn10(clean);
                if (alt10 != null && !candidates.contains(alt10)) {
                    candidates.add(alt10);
                }
            }

            for (String candidate : candidates) {
                try {
                    List<Element> records = fetchBnfRecords(
                            String.format("bib.isbn all \"%s\"", candidate),
                            "unimarcxchange",
                            1
                    );
                    if (!records.isEmpty()) {
                        BnfSearchResult parsed = parseUnimarcRecord(records.get(0), clean);
                        if (parsed != null) {
                            return List.of(parsed);
                        }
                    }
                } catch (Exception ex) {
                    log.debug("[BNF] Quick ISBN search failed for '{}': {}", candidate, ex.getMessage());
                }
            }
            return List.of();
        }

        String cleanTitle = cleanTitleForCQL(trimmed);
        if (cleanTitle.isBlank()) {
            return List.of();
        }

        try {
            List<Element> records = fetchBnfRecords(
                    String.format("bib.title all \"%s\"", cleanTitle),
                    "unimarcxchange",
                    50
            );
            if (records.isEmpty()) {
                return List.of();
            }

            Map<String, BnfSearchResult> unique = new LinkedHashMap<>();
            for (Element rec : records) {
                BnfSearchResult parsed = parseUnimarcRecord(rec, "");
                if (parsed == null) continue;
                String key = (parsed.getIsbn() != null && !parsed.getIsbn().isEmpty())
                        ? "isbn:" + parsed.getIsbn()
                        : "title:" + normalizeForRelevance(parsed.getTitle());
                unique.putIfAbsent(key, parsed);
            }

            List<BnfSearchResult> sorted = new ArrayList<>(unique.values());
            sorted.sort(Comparator.comparingInt((BnfSearchResult r) -> titleDistance(trimmed, r)));
            return sorted;
        } catch (Exception ex) {
            log.warn("[BNF] Quick title search failed for '{}': {}", trimmed, ex.getMessage());
            return List.of();
        }
    }

    private List<Element> fetchBnfRecords(String queryStr, String recordSchema, int maxRecords) throws Exception {
        String urlStr = String.format(
                "%s?version=1.2&operation=searchRetrieve&recordSchema=%s&maximumRecords=%d&query=%s",
                BNF_SRU_BASE_URL, recordSchema, maxRecords, URLEncoder.encode(queryStr, StandardCharsets.UTF_8)
        );

        HttpHeaders headers = new HttpHeaders();
        headers.set("User-Agent", BNF_USER_AGENT);
        HttpEntity<Void> entity = new HttpEntity<>(headers);

        ResponseEntity<String> response = restTemplate.exchange(urlStr, HttpMethod.GET, entity, String.class);
        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            return List.of();
        }

        DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
        dbf.setNamespaceAware(true);
        DocumentBuilder db = dbf.newDocumentBuilder();
        Document doc = db.parse(new InputSource(new StringReader(response.getBody())));

        NodeList recordNodes = doc.getElementsByTagNameNS("*", "record");
        List<Element> records = new ArrayList<>();
        for (int i = 0; i < recordNodes.getLength(); i++) {
            Node n = recordNodes.item(i);
            if (n instanceof Element el) {
                records.add(el);
            }
        }
        return records;
    }

    private BnfSearchResult parseUnimarcRecord(Element rec, String originalCleanIsbn) {
        // 1. Titre (tag 200)
        String title = null;
        Integer volumeFrom200 = null;
        String volumeStrFrom200 = null;
        String partTitleFrom200 = null;

        Element tag200 = findFirstDatafield(rec, "200");
        if (tag200 != null) {
            String mainTitle = getSubfieldValue(tag200, "a");
            if (mainTitle != null && !mainTitle.isBlank()) {
                String subtitle = getSubfieldValue(tag200, "e");
                if (subtitle != null && !subtitle.isBlank()) {
                    mainTitle = mainTitle + " : " + subtitle;
                }
                String subH = getSubfieldValue(tag200, "h");
                if (subH != null && !subH.isBlank()) {
                    volumeStrFrom200 = subH.trim();
                    Matcher numM = RE_DIGITS.matcher(volumeStrFrom200);
                    if (numM.find()) {
                        try {
                            volumeFrom200 = Integer.parseInt(numM.group(1));
                        } catch (NumberFormatException ignored) {}
                    }
                }
                String subI = getSubfieldValue(tag200, "i");
                if (subI != null && !subI.isBlank()) {
                    partTitleFrom200 = subI.trim();
                }

                if (volumeStrFrom200 != null && partTitleFrom200 != null) {
                    mainTitle = mainTitle + " - " + volumeStrFrom200 + " : " + partTitleFrom200;
                } else if (volumeStrFrom200 != null) {
                    mainTitle = mainTitle + " - " + volumeStrFrom200;
                } else if (partTitleFrom200 != null) {
                    mainTitle = mainTitle + " : " + partTitleFrom200;
                }
                title = mainTitle;
            }
        }

        if (title == null || title.isBlank()) {
            return null;
        }
        title = title.replaceAll("\\s*[/:]\\s*$", "").trim();

        // 2. Prix & ISBN (tag 010 / 073)
        Integer price = null;
        String extractedIsbn = "";
        Element tag010 = findFirstDatafield(rec, "010");
        if (tag010 != null) {
            String rawIsbn = getSubfieldValue(tag010, "a");
            if (rawIsbn != null) {
                String cleaned = cleanIsbnInput(rawIsbn);
                if (cleaned.length() == 10 || cleaned.length() == 13) {
                    extractedIsbn = cleaned;
                }
            }
            String rawPrice = getSubfieldValue(tag010, "d");
            if (rawPrice != null) {
                Matcher pm = RE_PRICE.matcher(rawPrice);
                if (pm.find()) {
                    try {
                        double parsed = Double.parseDouble(pm.group(1).replace(",", "."));
                        if (parsed > 0) {
                            price = (int) Math.round(parsed);
                        }
                    } catch (NumberFormatException ignored) {}
                }
            }
        }
        if (extractedIsbn.isEmpty()) {
            Element tag073 = findFirstDatafield(rec, "073");
            if (tag073 != null) {
                String rawEan = getSubfieldValue(tag073, "a");
                if (rawEan != null) {
                    String cleaned = cleanIsbnInput(rawEan);
                    if (cleaned.length() == 13 && (cleaned.startsWith("978") || cleaned.startsWith("979"))) {
                        extractedIsbn = cleaned;
                    }
                }
            }
        }

        // 3. Editeur (tag 214 ou 210 $c)
        String editorName = null;
        Element pubField = findFirstDatafield(rec, "214");
        if (pubField == null) pubField = findFirstDatafield(rec, "210");
        if (pubField != null) {
            String ed = getSubfieldValue(pubField, "c");
            if (ed != null) {
                ed = ed.replaceAll("^[.\\s,;:\\-]+|[.\\s,;:\\-]+$", "").trim();
                if (!ed.isEmpty()) editorName = ed;
            }
        }

        // 4. Collection & Tome (tag 225)
        String collectionName = null;
        Integer volume = volumeFrom200;
        Element tag225 = findFirstDatafield(rec, "225");
        if (tag225 != null) {
            String colA = getSubfieldValue(tag225, "a");
            if (colA != null) {
                colA = colA.replaceAll("^[.\\s,;:\\-]+|[.\\s,;:\\-]+$", "").trim();
                if (!colA.isEmpty()) collectionName = colA;
            }
            String subV = getSubfieldValue(tag225, "v");
            if (subV != null) {
                Matcher vm = RE_DIGITS.matcher(subV);
                if (vm.find()) {
                    try {
                        volume = Integer.parseInt(vm.group(1));
                    } catch (NumberFormatException ignored) {}
                }
            }
        }

        // 5. Pagination & Dimensions (tag 215 $a, $d)
        Integer pageCount = null;
        Integer height = null;
        Integer length = null;
        Element tag215 = findFirstDatafield(rec, "215");
        if (tag215 != null) {
            String subA = getSubfieldValue(tag215, "a");
            if (subA != null) {
                pageCount = parseBnfPageCount(subA);
            }
            String subD = getSubfieldValue(tag215, "d");
            if (subD != null) {
                Matcher dm = RE_DIMENSIONS_CM.matcher(subD);
                if (dm.find()) {
                    try {
                        height = (int) Math.round(Double.parseDouble(dm.group(1).replace(",", ".")) * 10);
                    } catch (NumberFormatException ignored) {}
                }
            }
        }

        // 6. Date de parution (tag 100 $a ou 214/210 $d)
        String releaseDate = null;
        Element tag100 = findFirstDatafield(rec, "100");
        if (tag100 != null) {
            String subA = getSubfieldValue(tag100, "a");
            if (subA != null && subA.length() >= 13) {
                String yearPart = subA.substring(9, 13);
                if (yearPart.matches("\\d{4}")) {
                    releaseDate = yearPart + "-01-01";
                }
            }
        }
        if (releaseDate == null && pubField != null) {
            String subD = getSubfieldValue(pubField, "d");
            if (subD != null) {
                Matcher ym = RE_BNF_YEAR.matcher(subD);
                if (ym.find()) {
                    releaseDate = ym.group(1) + "-01-01";
                }
            }
        }

        // 7. Résumé (tag 330 $a)
        String description = null;
        Element tag330 = findFirstDatafield(rec, "330");
        if (tag330 != null) {
            String subA = getSubfieldValue(tag330, "a");
            if (subA != null && !subA.isBlank()) {
                description = subA.trim();
            }
        }

        // 8. Auteurs (tags 700, 701, 702)
        List<BnfSearchResult.BnfAuthor> authors = new ArrayList<>();
        for (String tag : List.of("700", "701", "702")) {
            for (Element df : findDatafields(rec, tag)) {
                String lastname = cleanAuthorPart(getSubfieldValue(df, "a"));
                String firstname = cleanAuthorPart(getSubfieldValue(df, "b"));
                String roleCode = getSubfieldValue(df, "4");
                String role = mapUnimarcRole(roleCode);
                if (!lastname.isEmpty() || !firstname.isEmpty()) {
                    boolean exists = authors.stream().anyMatch(a ->
                            a.getLastname().equalsIgnoreCase(lastname) && a.getFirstname().equalsIgnoreCase(firstname)
                    );
                    if (!exists) {
                        authors.add(new BnfSearchResult.BnfAuthor(firstname, lastname, role));
                    }
                }
            }
        }

        // 9. ISBN-13 & Couverture
        String effectiveIsbn = (originalCleanIsbn != null && !originalCleanIsbn.isEmpty()) ? originalCleanIsbn : extractedIsbn;
        String isbn13 = "";
        if (!effectiveIsbn.isEmpty()) {
            if (effectiveIsbn.length() == 13) {
                isbn13 = effectiveIsbn;
            } else {
                String conv = isbn10ToIsbn13(effectiveIsbn);
                isbn13 = conv != null ? conv : effectiveIsbn;
            }
        }
        String coverUrl = !isbn13.isEmpty()
                ? "https://openapi.bnf.fr/couverture/image/image/recupererImage?ISBN=" + isbn13 + "&couverture=1&taille=originale"
                : "";

        BnfSearchResult result = new BnfSearchResult();
        result.setTitle(title);
        result.setIsbn(isbn13);
        result.setPrice(price);
        result.setCoverUrl(coverUrl);
        result.setVolume(volume);
        result.setEditorName(editorName);
        result.setCollectionName(collectionName);
        result.setPageCount(pageCount);
        result.setReleaseDate(releaseDate);
        result.setDescription(description);
        result.setHeight(height);
        result.setLength(length);
        result.setAuthors(authors);
        return result;
    }

    private Element findFirstDatafield(Element rec, String tag) {
        NodeList nl = rec.getElementsByTagNameNS("*", "datafield");
        for (int i = 0; i < nl.getLength(); i++) {
            Node n = nl.item(i);
            if (n instanceof Element el && tag.equals(el.getAttribute("tag"))) {
                return el;
            }
        }
        return null;
    }

    private List<Element> findDatafields(Element rec, String tag) {
        List<Element> list = new ArrayList<>();
        NodeList nl = rec.getElementsByTagNameNS("*", "datafield");
        for (int i = 0; i < nl.getLength(); i++) {
            Node n = nl.item(i);
            if (n instanceof Element el && tag.equals(el.getAttribute("tag"))) {
                list.add(el);
            }
        }
        return list;
    }

    private String getSubfieldValue(Element datafield, String code) {
        NodeList nl = datafield.getElementsByTagNameNS("*", "subfield");
        for (int i = 0; i < nl.getLength(); i++) {
            Node n = nl.item(i);
            if (n instanceof Element el && code.equals(el.getAttribute("code"))) {
                String text = el.getTextContent();
                if (text != null && !text.isBlank()) {
                    return cleanText(text);
                }
            }
        }
        return null;
    }

    private String cleanAuthorPart(String part) {
        if (part == null) return "";
        String cleaned = RE_BNF_CREATOR_DATES.matcher(part).replaceAll("");
        cleaned = cleaned.replaceAll("\\b\\d{4}-(?:\\d{4}|\\.{2,4})\\b", "");
        return cleaned.replaceAll("^[.\\s,;:\\-]+|[.\\s,;:\\-]+$", "").trim();
    }

    private String mapUnimarcRole(String code) {
        if (code == null) return "Writer";
        String c = code.trim();
        if ("440".equals(c) || "753".equals(c)) return "Illustrator";
        if ("205".equals(c)) return "Colorist";
        return "Writer";
    }

    private boolean isIsbnInput(String raw) {
        if (raw == null) return false;
        String trimmed = raw.trim();
        if (!trimmed.matches("^[0-9Xx\\-\\s]+$")) return false;
        String clean = cleanIsbnInput(trimmed);
        return clean.length() == 10 || clean.length() == 13;
    }

    private String cleanIsbnInput(String raw) {
        if (raw == null) return "";
        String cleaned = raw.trim().replaceAll("[^0-9Xx]", "").toUpperCase(Locale.ROOT);
        if (cleaned.length() > 13 && (cleaned.startsWith("978") || cleaned.startsWith("979"))) {
            cleaned = cleaned.substring(0, 13);
        }
        return cleaned;
    }

    private String isbn10ToIsbn13(String isbn10) {
        String clean = isbn10.replaceAll("[^0-9Xx]", "");
        if (clean.length() != 10) return null;
        String base = "978" + clean.substring(0, 9);
        int sum = 0;
        for (int i = 0; i < 12; i++) {
            int digit = Character.digit(base.charAt(i), 10);
            if (digit < 0) return null;
            sum += (i % 2 == 0) ? digit : digit * 3;
        }
        int check = (10 - (sum % 10)) % 10;
        return base + check;
    }

    private String isbn13ToIsbn10(String isbn13) {
        String clean = isbn13.replaceAll("[^0-9Xx]", "");
        if (clean.length() != 13 || !clean.startsWith("978")) return null;
        String base = clean.substring(3, 12);
        int sum = 0;
        for (int i = 0; i < 9; i++) {
            int digit = Character.digit(base.charAt(i), 10);
            if (digit < 0) return null;
            sum += digit * (10 - i);
        }
        int rem = (11 - (sum % 11)) % 11;
        String check = (rem == 10) ? "X" : String.valueOf(rem);
        return base + check;
    }

    private String normalizeForRelevance(String text) {
        if (text == null) return "";
        String decomposed = Normalizer.normalize(text, Normalizer.Form.NFD);
        return decomposed.replaceAll("\\p{InCombiningDiacriticalMarks}+", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", " ")
                .trim();
    }

    private int titleDistance(String rawQuery, BnfSearchResult result) {
        String normQuery = normalizeForRelevance(rawQuery);
        String normTitle = normalizeForRelevance(result.getTitle());
        if (normQuery.isEmpty() || normTitle.isEmpty()) {
            return Integer.MAX_VALUE;
        }
        return levenshteinDistance(normQuery, normTitle);
    }

    private int levenshteinDistance(String a, String b) {
        int m = a.length();
        int n = b.length();
        int[] prev = new int[n + 1];
        int[] curr = new int[n + 1];
        for (int j = 0; j <= n; j++) {
            prev[j] = j;
        }
        for (int i = 1; i <= m; i++) {
            curr[0] = i;
            char ca = a.charAt(i - 1);
            for (int j = 1; j <= n; j++) {
                int cost = (ca == b.charAt(j - 1)) ? 0 : 1;
                curr[j] = Math.min(
                        Math.min(curr[j - 1] + 1, prev[j] + 1),
                        prev[j - 1] + cost
                );
            }
            int[] tmp = prev;
            prev = curr;
            curr = tmp;
        }
        return prev[n];
    }
}
