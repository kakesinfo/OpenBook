package fr.openbook.scraper.sources;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fr.openbook.scraper.config.ScraperProperties;
import fr.openbook.scraper.model.ScanOptions;
import fr.openbook.scraper.model.ScrapedAuthorDTO;
import fr.openbook.scraper.model.ScrapedBookDTO;
import fr.openbook.scraper.utils.TextCleaner;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Component
public class Label619Source extends AbstractHttpSource {

    private static final String API_BASE = "https://label619.com/sk/api/editions";
    private static final Pattern RE_VOL = Pattern.compile("(?i)T(?:ome)?\\s*0?(\\d+)");
    private static final Pattern RE_VOL_STRIP = Pattern.compile("(?i)T(?:ome)?\\s*0?\\d+.*");
    private static final Pattern RE_PRICE = Pattern.compile("(\\d+)(?:[,\\.]\\d+)?");
    private static final Pattern RE_ISBN = Pattern.compile("(97[89]\\d{10})");

    private final ObjectMapper objectMapper;

    public Label619Source(ScraperProperties properties, ObjectMapper objectMapper) {
        super(properties);
        this.objectMapper = objectMapper;
    }

    @Override
    public String getId() {
        return "label619";
    }

    @Override
    public String getName() {
        return "Label 619";
    }

    @Override
    public String getDescription() {
        return "Catalogue officiel Label 619 (Mutafukaz, Rue de Sèvres, BD alternatives)";
    }

    @Override
    public String getColor() {
        return "#ec4899";
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

        int page = 1;
        int pageSize = 40;

        log.info("[Label619] Scraping catalogue (fullScan={}, maxItems={})", fullScan, maxItems);

        while (true) {
            if (isStopped != null && isStopped.getAsBoolean()) {
                log.info("[Label619] Stop requested, halting scrape.");
                break;
            }

            String url = String.format(
                    "%s?sort[0]=date:desc&pagination[pageSize]=%d&pagination[page]=%d&populate[cover][populate]=*&populate[collections][populate]=*",
                    API_BASE, pageSize, page
            );

            String json = fetchString(url);
            if (json == null || json.isBlank()) {
                break;
            }

            try {
                JsonNode root = objectMapper.readTree(json);
                JsonNode dataNode = root.path("data");
                if (!dataNode.isArray() || dataNode.isEmpty()) {
                    break;
                }

                int pageCount = root.path("meta").path("pagination").path("pageCount").asInt(1);

                for (JsonNode item : dataNode) {
                    if (isStopped != null && isStopped.getAsBoolean()) {
                        break;
                    }

                    String rawTitle = item.path("title").asText("");
                    if (rawTitle.isBlank()) continue;

                    String title = TextCleaner.cleanText(rawTitle);
                    if (title.isBlank() || !seenTitles.add(title.toLowerCase())) {
                        continue;
                    }

                    // Volume
                    Integer volume = null;
                    JsonNode tomeNode = item.get("tome");
                    if (tomeNode != null && !tomeNode.isNull()) {
                        if (tomeNode.isNumber()) {
                            volume = tomeNode.asInt();
                        } else if (tomeNode.isTextual()) {
                            try {
                                volume = Integer.parseInt(tomeNode.asText().trim());
                            } catch (NumberFormatException ignored) {}
                        }
                    }
                    if (volume == null) {
                        Matcher vm = RE_VOL.matcher(title);
                        if (vm.find()) {
                            try {
                                volume = Integer.parseInt(vm.group(1));
                            } catch (NumberFormatException ignored) {}
                        }
                    }

                    // Series
                    String seriesName = title;
                    if (volume != null) {
                        String stripped = RE_VOL_STRIP.matcher(title).replaceAll("").replaceAll("^[ :\\-]+|[ :\\-]+$", "").trim();
                        if (!stripped.isBlank()) {
                            seriesName = TextCleaner.cleanText(stripped);
                        }
                    }

                    // Price
                    int price = 0;
                    JsonNode priceNode = item.get("price");
                    if (priceNode != null && !priceNode.isNull()) {
                        Matcher pm = RE_PRICE.matcher(priceNode.asText());
                        if (pm.find()) {
                            try {
                                price = Integer.parseInt(pm.group(1));
                            } catch (NumberFormatException ignored) {}
                        }
                    }

                    // ISBN
                    String link = item.path("link").asText("");
                    String isbn = "";
                    Matcher im = RE_ISBN.matcher(link);
                    if (im.find()) {
                        isbn = im.group(1);
                    }

                    // Cover
                    String coverUrl = "";
                    JsonNode coverNode = item.path("cover");
                    if (!coverNode.isMissingNode() && !coverNode.isNull()) {
                        JsonNode formatsNode = coverNode.path("formats");
                        for (String sz : List.of("large", "medium", "small")) {
                            String u = formatsNode.path(sz).path("url").asText("");
                            if (!u.isBlank()) {
                                coverUrl = u;
                                break;
                            }
                        }
                        if (coverUrl.isBlank()) {
                            coverUrl = coverNode.path("url").asText("");
                        }
                        if (!coverUrl.isBlank()) {
                            if (coverUrl.startsWith("http")) {
                                // already absolute
                            } else if (coverUrl.startsWith("/sk")) {
                                coverUrl = "https://label619.com" + coverUrl;
                            } else {
                                coverUrl = "https://label619.com/sk" + coverUrl;
                            }
                        }
                    }

                    // Date
                    LocalDate releaseDate = null;
                    String dateStr = item.path("date").asText("");
                    if (dateStr.length() >= 10) {
                        try {
                            releaseDate = LocalDate.parse(dateStr.substring(0, 10));
                        } catch (Exception ignored) {}
                    }
                    

                    // Description
                    String summary = item.path("summary").asText("");
                    String description = TextCleaner.cleanText(summary);
                    if (description.isBlank()) {
                        description = "Album Label 619 : " + title;
                    }

                    // Authors
                    List<ScrapedAuthorDTO> authors = new ArrayList<>();
                    JsonNode colNode = item.path("collections");
                    if (colNode.isArray()) {
                        for (JsonNode col : colNode) {
                            String authorName = col.path("name").asText("");
                            String[] split = TextCleaner.splitAuthorName(authorName);
                            if (!split[1].isBlank()) {
                                authors.add(new ScrapedAuthorDTO(split[0], split[1], "Writer"));
                            }
                        }
                    }

                    String sourceUrl = link.isBlank() ? "https://label619.com/catalogue" : link;

                    ScrapedBookDTO book = ScrapedBookDTO.builder()
                            .title(TextCleaner.truncate(title, 255))
                            .seriesName(TextCleaner.truncate(seriesName, 255))
                            .volume(volume)
                            .isbn(isbn)
                            .editorName("Label 619")
                            .categoryName("Comics")
                            .pageCount(0)
                            .price(price)
                            .description(description)
                            .coverUrl(coverUrl)
                            .releaseDate(releaseDate)
                            .bookType("Comics")
                            .authors(authors)
                            .sourceUrl(sourceUrl)
                            .build();

                    books.add(book);
                    if (onBookFound != null) {
                        onBookFound.accept(book);
                    }

                    if (!fullScan && books.size() >= maxItems) {
                        break;
                    }
                }

                if (!fullScan && books.size() >= maxItems) {
                    break;
                }
                if (page >= pageCount) {
                    break;
                }
                page++;
            } catch (Exception e) {
                log.error("[Label619] Error parsing page {}: {}", page, e.getMessage());
                break;
            }
        }

        log.info("[Label619] Finished catalogue scrape: {} books", books.size());
        return books;
    }
}
