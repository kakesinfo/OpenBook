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
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
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
        String urlStr = String.format(
                "%s?version=1.2&operation=searchRetrieve&recordSchema=dublincore&maximumRecords=%d&query=%s",
                BNF_SRU_BASE_URL, maxRecords, URLEncoder.encode(queryStr, StandardCharsets.UTF_8)
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
}
