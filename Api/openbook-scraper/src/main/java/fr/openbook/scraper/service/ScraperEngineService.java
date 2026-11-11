package fr.openbook.scraper.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import fr.openbook.scraper.config.ScraperProperties;
import fr.openbook.scraper.model.ScanOptions;
import fr.openbook.scraper.model.ScrapedAuthorDTO;
import fr.openbook.scraper.model.ScrapedBookDTO;
import fr.openbook.scraper.sources.ScraperSource;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.time.Instant;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

@Slf4j
@Service
@RequiredArgsConstructor
public class ScraperEngineService {

    private static final List<String> PREFERRED_ORDER = List.of(
            "urban_comics",
            "panini",
            "mangetsu",
            "morgen_bd",
            "label619",
            "monsieur_toussaint_louverture",
            "komics_initiative",
            "bubble_editions"
    );

    private final ScraperProperties properties;
    private final ScraperDbService scraperDbService;
    private final List<ScraperSource> scraperSources;
    private final ObjectMapper objectMapper;

    private final Map<String, ScraperSource> sourceMap = new LinkedHashMap<>();
    private final Set<String> disabledSources = ConcurrentHashMap.newKeySet();

    private final AtomicBoolean isRunning = new AtomicBoolean(false);
    private final AtomicBoolean stopRequested = new AtomicBoolean(false);
    private volatile String currentJob = null;
    private volatile Instant lastRun = null;
    private volatile String lastStatus = "idle";
    private final List<Map<String, Object>> history = Collections.synchronizedList(new ArrayList<>());
    private final Map<String, Object> liveScan = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        for (ScraperSource src : scraperSources) {
            sourceMap.put(src.getId(), src);
        }
        loadDisabledSources();
        resetLiveScan();
        initRecentBooksFromDb();
        log.info("ScraperEngineService initialized with {} registered sources: {}", sourceMap.size(), sourceMap.keySet());
    }

    private void resetLiveScan() {
        liveScan.put("is_running", false);
        liveScan.put("job_name", "");
        liveScan.put("current_source", "");
        liveScan.put("current_step", "");
        liveScan.put("current_source_name", "");
        liveScan.put("current_source_color", "#6366f1");
        liveScan.put("total_found", 0);
        liveScan.put("total_saved", 0);
        liveScan.put("recent_books", new ArrayList<Map<String, Object>>());
        liveScan.put("started_at", "");
        liveScan.put("ended_at", "");
        liveScan.put("last_error", "");
    }

    private void initRecentBooksFromDb() {
        try {
            List<Map<String, Object>> dbBooks = scraperDbService.getRecentBooks(10);
            if (dbBooks.isEmpty()) return;

            List<Map<String, Object>> recent = new ArrayList<>();
            for (Map<String, Object> b : dbBooks) {
                String edName = (String) b.get("editor_name");
                String srcName = (edName != null && !edName.isBlank()) ? edName : "Catalogue";

                Map<String, Object> item = new LinkedHashMap<>();
                item.put("id", b.get("id"));
                item.put("title", b.get("title"));
                item.put("series_name", b.get("series_name"));
                item.put("volume", b.get("volume"));
                item.put("isbn", b.get("isbn"));
                item.put("editor_name", edName);
                item.put("cover_url", b.get("cover_url"));
                item.put("price", b.get("price"));
                item.put("authors", List.of());
                item.put("source_id", null);
                item.put("source_name", srcName);
                item.put("source_color", "#6366f1");
                item.put("found_at", null);
                recent.add(item);
            }
            liveScan.put("recent_books", recent);
            liveScan.put("total_found", recent.size());
        } catch (Exception e) {
            log.warn("Could not preload recent books from DB: {}", e.getMessage());
        }
    }

    private File getConfigFile() {
        return new File("sources_config.json");
    }

    private void loadDisabledSources() {
        File file = getConfigFile();
        if (!file.exists()) {
            return;
        }
        try {
            Map<String, Object> data = objectMapper.readValue(file, new TypeReference<>() {});
            if (data.containsKey("disabled_sources") && data.get("disabled_sources") instanceof List<?> list) {
                for (Object item : list) {
                    disabledSources.add(item.toString());
                }
            }
            log.info("Loaded disabled sources configuration: {}", disabledSources);
        } catch (Exception e) {
            log.warn("Could not load sources_config.json: {}", e.getMessage());
        }
    }

    private void saveDisabledSources() {
        File file = getConfigFile();
        try {
            Map<String, Object> data = Map.of("disabled_sources", new ArrayList<>(disabledSources));
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(file, data);
        } catch (IOException e) {
            log.warn("Could not save sources_config.json: {}", e.getMessage());
        }
    }

    public List<String> getAllSourceIds() {
        List<String> ids = new ArrayList<>();
        for (String id : PREFERRED_ORDER) {
            if (sourceMap.containsKey(id)) {
                ids.add(id);
            }
        }
        for (String id : sourceMap.keySet()) {
            if (!ids.contains(id)) {
                ids.add(id);
            }
        }
        return ids;
    }

    public List<Map<String, Object>> getSources() {
        Map<String, Integer> editorCounts = scraperDbService.getBookCountsByEditor();
        List<Map<String, Object>> list = new ArrayList<>();
        for (String id : getAllSourceIds()) {
            ScraperSource src = sourceMap.get(id);
            if (src == null) continue;
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", src.getId());
            item.put("name", src.getName());
            item.put("desc", src.getDescription());
            item.put("color", src.getColor());
            item.put("enabled", !disabledSources.contains(src.getId()));

            int bookCount = 0;
            if (src.getName() != null) {
                String key = src.getName().trim().toLowerCase();
                bookCount = editorCounts.getOrDefault(key, 0);
            }
            item.put("book_count", bookCount);
            list.add(item);
        }
        return list;
    }

    public Map<String, Object> toggleSource(String source, boolean enabled) {
        if (enabled) {
            disabledSources.remove(source);
        } else {
            disabledSources.add(source);
        }
        saveDisabledSources();
        log.info("Source '{}' status changed: enabled={}", source, enabled);
        return Map.of("source", source, "enabled", enabled, "sources", getSources());
    }

    public Map<String, Object> getStatus() {
        List<String> disabledList = new ArrayList<>(disabledSources);
        List<String> allIds = getAllSourceIds();
        List<String> enabledList = new ArrayList<>();
        for (String s : allIds) {
            if (!disabledSources.contains(s) && sourceMap.containsKey(s)) {
                enabledList.add(s);
            }
        }

        List<Map<String, Object>> recentHist;
        synchronized (history) {
            recentHist = new ArrayList<>(history.subList(0, Math.min(5, history.size())));
        }

        Map<String, Object> status = new LinkedHashMap<>();
        status.put("is_running", isRunning.get());
        status.put("current_job", currentJob);
        status.put("last_run", lastRun != null ? lastRun.toString() : null);
        status.put("last_status", lastStatus);
        status.put("sources", getSources());
        status.put("available_sources", allIds);
        status.put("disabled_sources", disabledList);
        status.put("enabled_sources", enabledList);
        String cron = properties.getScheduleCron() != null ? properties.getScheduleCron() : "0 0 3 * * *";
        status.put("schedule", Map.of(
                "cron", cron,
                "daily_at", extractDailyAtFromCron(cron),
                "scrape_on_startup", properties.isScrapeOnStartup()
        ));
        status.put("recent_history", recentHist);
        status.put("live_scan", new LinkedHashMap<>(liveScan));
        return status;
    }

    private String extractDailyAtFromCron(String cron) {
        if (cron == null || cron.isBlank()) return "03:00";
        String[] parts = cron.trim().split("\\s+");
        if (parts.length == 6 && "*".equals(parts[3]) && "*".equals(parts[4]) && ("*".equals(parts[5]) || "?".equals(parts[5]))) {
            try {
                int min = Integer.parseInt(parts[1]);
                int hour = Integer.parseInt(parts[2]);
                return String.format("%02d:%02d", hour, min);
            } catch (NumberFormatException ignored) {
            }
        }
        return cron;
    }

    public Map<String, Object> stopScan() {
        if (!isRunning.get()) {
            return Map.of("status", "not_running", "message", "Aucun scan n'est actuellement en cours.");
        }
        stopRequested.set(true);
        return Map.of("status", "stopping", "message", "Arrêt du scan demandé.");
    }

    public Map<String, Object> triggerScrape(List<String> sources, boolean fullScan) {
        if (!isRunning.compareAndSet(false, true)) {
            return Map.of(
                    "status", "already_running",
                    "current_job", currentJob != null ? currentJob : "",
                    "message", "A scraping job is already in progress."
            );
        }

        stopRequested.set(false);

        String targetDesc;
        if (sources != null && !sources.isEmpty()) {
            targetDesc = String.join(", ", sources);
        } else {
            targetDesc = "all active";
        }
        if (fullScan) {
            targetDesc += " (full)";
        }

        currentJob = targetDesc;
        lastStatus = "running";

        resetLiveScan();
        liveScan.put("is_running", true);
        liveScan.put("job_name", currentJob);
        liveScan.put("started_at", Instant.now().toString());

        Thread.ofVirtual().name("scraper-worker").start(() -> runScrape(sources, fullScan, currentJob));

        String modeStr = fullScan ? "full catalog scan" : "standard scan";
        return Map.of(
                "status", "started",
                "source", targetDesc,
                "full_scan", fullScan,
                "message", String.format("Scraping job started for %s (%s).", targetDesc, modeStr)
        );
    }

    private void runScrape(List<String> requestedSources, boolean fullScan, String jobName) {
        Instant startTime = Instant.now();
        List<String> sourcesToRun = new ArrayList<>();

        if (requestedSources != null && !requestedSources.isEmpty()) {
            for (String s : requestedSources) {
                if (sourceMap.containsKey(s)) {
                    sourcesToRun.add(s);
                }
            }
        } else {
            for (String s : getAllSourceIds()) {
                if (!disabledSources.contains(s) && sourceMap.containsKey(s)) {
                    sourcesToRun.add(s);
                }
            }
        }

        // 1. Clean existing mojibake before crawl
        try {
            scraperDbService.repairMojibake();
        } catch (Exception e) {
            log.warn("Error running Mojibake repair before scrape: {}", e.getMessage());
        }

        String sourceLabel = sourcesToRun.isEmpty() ? "none" : String.join(", ", sourcesToRun);
        Map<String, Object> resultsMap = new LinkedHashMap<>();
        List<String> errorsList = new ArrayList<>();

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("start_time", startTime.toString());
        summary.put("source", sourceLabel);
        summary.put("full_scan", fullScan);
        summary.put("results", resultsMap);
        summary.put("total_scraped", 0);
        summary.put("total_saved", 0);
        summary.put("errors", errorsList);

        String firstSrcName = "";
        String firstSrcColor = "#6366f1";
        if (!sourcesToRun.isEmpty()) {
            ScraperSource s0 = sourceMap.get(sourcesToRun.get(0));
            if (s0 != null) {
                firstSrcName = s0.getName();
                firstSrcColor = s0.getColor();
            }
        }

        liveScan.put("is_running", true);
        liveScan.put("job_name", jobName);
        liveScan.put("current_source", sourcesToRun.isEmpty() ? "" : sourcesToRun.get(0));
        liveScan.put("current_source_name", firstSrcName);
        liveScan.put("current_source_color", firstSrcColor);
        liveScan.put("current_step", "Exploration du catalogue...");
        liveScan.put("total_found", 0);
        liveScan.put("total_saved", 0);
        liveScan.put("recent_books", new ArrayList<Map<String, Object>>());
        liveScan.put("started_at", startTime.toString());
        liveScan.put("ended_at", "");
        liveScan.put("last_error", "");

        log.info("Starting scrape process for sources: {} (full_scan={})", sourcesToRun, fullScan);

        int totalScraped = 0;
        int totalSaved = 0;
        boolean cancelled = false;

        try {
            for (String sName : sourcesToRun) {
                if (stopRequested.get()) {
                    log.info("Scrape halted early by user request before running {}", sName);
                    summary.put("status", "cancelled");
                    cancelled = true;
                    break;
                }

                ScraperSource source = sourceMap.get(sName);
                if (source == null) continue;

                log.info("Running scraper: {}", sName);
                liveScan.put("current_source", sName);
                liveScan.put("current_source_name", source.getName());
                liveScan.put("current_source_color", source.getColor());
                liveScan.put("current_step", "Exploration du catalogue...");

                int limit = fullScan ? 50000 : properties.getMaxBooksPerSource();
                final int[] savedThisSource = {0};
                Set<String> seenInCallback = ConcurrentHashMap.newKeySet();

                java.util.function.Consumer<ScrapedBookDTO> onBookFound = book -> {
                    if (stopRequested.get()) return;

                    Integer bookId = scraperDbService.upsertBook(book);
                    boolean isSaved = bookId != null;

                    String ident = (book.getIsbn() != null && !book.getIsbn().isBlank())
                            ? book.getIsbn().trim()
                            : book.getTitle();

                    if (isSaved && seenInCallback.add(ident)) {
                        savedThisSource[0]++;
                    }

                    int curFound = (int) liveScan.getOrDefault("total_found", 0);
                    liveScan.put("total_found", curFound + 1);
                    if (curFound == 0) {
                        liveScan.put("current_step", "Indexation des albums...");
                    }

                    if (isSaved) {
                        int curSaved = (int) liveScan.getOrDefault("total_saved", 0);
                        liveScan.put("total_saved", curSaved + 1);
                    }

                    String edName = (book.getEditorName() != null && !book.getEditorName().isBlank())
                            ? book.getEditorName()
                            : source.getName();

                    List<String> authorStrings = new ArrayList<>();
                    if (book.getAuthors() != null) {
                        for (ScrapedAuthorDTO a : book.getAuthors()) {
                            if (a.getLastname() != null && !a.getLastname().isBlank()) {
                                authorStrings.add((a.getFirstname() + " " + a.getLastname()).trim());
                            }
                        }
                    }

                    Map<String, Object> bookItem = new LinkedHashMap<>();
                    bookItem.put("id", bookId);
                    bookItem.put("title", book.getTitle());
                    bookItem.put("series_name", book.getSeriesName());
                    bookItem.put("volume", book.getVolume());
                    bookItem.put("isbn", book.getIsbn());
                    bookItem.put("editor_name", edName);
                    bookItem.put("cover_url", book.getCoverUrl());
                    bookItem.put("price", book.getPrice());
                    bookItem.put("page_count", book.getPageCount());
                    bookItem.put("authors", authorStrings);
                    bookItem.put("source_id", sName);
                    bookItem.put("source_name", source.getName());
                    bookItem.put("source_color", source.getColor());
                    bookItem.put("found_at", LocalTime.now().format(DateTimeFormatter.ofPattern("HH:mm:ss")));

                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> recList = (List<Map<String, Object>>) liveScan.get("recent_books");
                    if (recList != null) {
                        synchronized (recList) {
                            recList.add(0, bookItem);
                            if (recList.size() > 10) {
                                recList.remove(recList.size() - 1);
                            }
                        }
                    }
                };

                List<ScrapedBookDTO> books;
                try {
                    books = source.scrape(new ScanOptions(fullScan, limit), onBookFound, stopRequested::get);
                } catch (Exception e) {
                    String errMsg = "Error in scraper " + sName + ": " + e.getMessage();
                    log.error(errMsg, e);
                    errorsList.add(errMsg);
                    resultsMap.put(sName, Map.of(
                            "scraped", 0,
                            "saved", 0,
                            "status", "error",
                            "error", e.getMessage() != null ? e.getMessage() : "Unknown error"
                    ));
                    liveScan.put("last_error", e.getMessage() != null ? e.getMessage() : "Error");
                    continue;
                }

                if (stopRequested.get()) {
                    log.info("Scraper {} stopped early by user request", sName);
                    resultsMap.put(sName, Map.of(
                            "scraped", books != null ? books.size() : 0,
                            "saved", savedThisSource[0],
                            "status", "cancelled"
                    ));
                    summary.put("status", "cancelled");
                    cancelled = true;
                    break;
                }

                // Safeguard in case any book was omitted from callback
                if (books != null) {
                    for (ScrapedBookDTO b : books) {
                        String ident = (b.getIsbn() != null && !b.getIsbn().isBlank()) ? b.getIsbn().trim() : b.getTitle();
                        if (!seenInCallback.contains(ident)) {
                            onBookFound.accept(b);
                        }
                    }
                }

                int booksCount = books != null ? books.size() : 0;
                resultsMap.put(sName, Map.of(
                        "scraped", booksCount,
                        "saved", savedThisSource[0],
                        "status", "success"
                ));
                totalScraped += booksCount;
                totalSaved += savedThisSource[0];
                summary.put("total_scraped", totalScraped);
                summary.put("total_saved", totalSaved);
                log.info("Scraper {} finished: {} scraped, {} saved/updated", sName, booksCount, savedThisSource[0]);
            }

            // Post-scan BNF enrichment pass for books with missing ISBN
            log.info("Executing post-scan BNF enrichment pass...");
            try {
                Map<String, Object> bnfRes = scraperDbService.enrichBooksFromBnf(100);
                summary.put("bnf_enrichment", bnfRes);
                log.info("BNF enrichment pass completed: {}", bnfRes);
            } catch (Exception e) {
                log.warn("Error during post-scan BNF enrichment pass: {}", e.getMessage());
            }

        } finally {
            Instant endTime = Instant.now();
            summary.put("end_time", endTime.toString());

            if (!cancelled) {
                if (errorsList.isEmpty()) {
                    summary.put("status", "success");
                    lastStatus = "success";
                } else {
                    summary.put("status", "completed_with_errors");
                    lastStatus = "completed_with_errors";
                }
            } else {
                summary.put("status", "cancelled");
                lastStatus = "cancelled";
            }

            isRunning.set(false);
            currentJob = null;
            lastRun = endTime;

            liveScan.put("is_running", false);
            liveScan.put("current_source", "");
            liveScan.put("current_step", "");
            liveScan.put("ended_at", endTime.toString());

            synchronized (history) {
                history.add(0, summary);
                if (history.size() > 20) {
                    history.remove(history.size() - 1);
                }
            }

            log.info("Scrape process ended: {} scraped, {} saved in status {}",
                    summary.get("total_scraped"),
                    summary.get("total_saved"),
                    summary.get("status")
            );
        }
    }
}
