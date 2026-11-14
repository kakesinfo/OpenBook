package fr.openbook.api.importing.service;

import fr.openbook.api.importing.bnf.BnfBookData;
import fr.openbook.api.importing.bnf.BnfClient;
import fr.openbook.api.importing.job.ImportJob;
import fr.openbook.api.importing.job.ImportJobManager;
import fr.openbook.api.importing.job.ImportOptions;
import fr.openbook.api.importing.job.ImportResponse;
import fr.openbook.api.importing.model.*;
import fr.openbook.api.importing.parser.BookmoryZipParser;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.*;

@Slf4j
@Service
public class BookmoryImportService {

    private final BookmoryZipParser zipParser;
    private final BnfClient bnfClient;
    private final ImportMediaService mediaService;
    private final BookmoryDbService dbService;
    private final ImportJobManager jobManager;

    private final ExecutorService executorService;
    private final Semaphore mediaSemaphore;
    private final int maxMediaConcurrency;

    public BookmoryImportService(
            BookmoryZipParser zipParser,
            BnfClient bnfClient,
            ImportMediaService mediaService,
            BookmoryDbService dbService,
            ImportJobManager jobManager,
            @Value("${import.media.concurrency:5}") int maxMediaConcurrency
    ) {
        this.zipParser = zipParser;
        this.bnfClient = bnfClient;
        this.mediaService = mediaService;
        this.dbService = dbService;
        this.jobManager = jobManager;
        this.executorService = Executors.newCachedThreadPool();
        this.maxMediaConcurrency = Math.max(1, maxMediaConcurrency);
        this.mediaSemaphore = new Semaphore(this.maxMediaConcurrency);
    }

    public ImportJob getJob(String jobId) {
        return jobManager.getJob(jobId);
    }

    public ImportResponse startImport(File tempFile, Long userId, boolean wait) {
        return startImport(tempFile, userId, wait, new ImportOptions());
    }

    public ImportResponse startImport(File tempFile, Long userId, boolean wait, ImportOptions options) {
        ImportOptions effectiveOptions = options != null ? options : new ImportOptions();
        ImportJob job = jobManager.createJob(userId);

        if (wait) {
            runImportSync(job, tempFile, effectiveOptions);
            return ImportResponse.builder()
                    .success("completed".equals(job.getStatus()))
                    .message(String.format("Import terminé: %d créés, %d mis à jour, %d notes", job.getCreatedBooks(), job.getUpdatedBooks(), job.getImportedNotes()))
                    .job(job)
                    .build();
        }

        executorService.submit(() -> {
            try {
                runImportSync(job, tempFile, effectiveOptions);
            } catch (Throwable t) {
                log.error("[Importer] Unhandled error during import job {}: {}", job.getId(), t.getMessage(), t);
                job.setStatus("failed");
                job.getErrors().add("Erreur inattendue: " + t.getMessage());
                job.setCurrentStep("Échec de l'import: " + t.getMessage());
                job.setFinishedAt(Instant.now());
            } finally {
                if (tempFile.exists()) {
                    tempFile.delete();
                }
            }
        });

        return ImportResponse.builder()
                .success(true)
                .message("Import démarré")
                .job(job)
                .build();
    }

    public void runImportSync(ImportJob job, File zipFile) {
        runImportSync(job, zipFile, new ImportOptions());
    }

    public void runImportSync(ImportJob job, File zipFile, ImportOptions options) {
        job.setStatus("processing");
        job.setCurrentStep("Décompression et lecture de l'archive...");

        try (ParsedBookmory parsed = zipParser.parse(zipFile)) {
            List<BookmoryBook> booksToProcess = new ArrayList<>();
            for (BookmoryBook b : parsed.getBooks()) {
                if (shouldProcessBook(b, parsed, options)) {
                    booksToProcess.add(b);
                }
            }

            int total = booksToProcess.size();
            job.setTotalBooks(total);
            job.setCurrentStep(buildStepLabel(total, options));

            log.info("[Importer] Starting parallel import ({} threads) of {} books (out of {} in backup) for user {} (job {})",
                    maxMediaConcurrency, total, parsed.getBooks().size(), job.getUserId(), job.getId());

            ExecutorService bookPool = Executors.newFixedThreadPool(maxMediaConcurrency);
            try {
                List<Future<?>> futures = new ArrayList<>(total);
                for (BookmoryBook b : booksToProcess) {
                    futures.add(bookPool.submit(() -> {
                        try {
                            processSingleBook(job, b, parsed, options);
                        } catch (Throwable ex) {
                            log.error("[Importer] Error processing book '{}': {}", b.getTitle(), ex.getMessage(), ex);
                            synchronized (job) {
                                job.getErrors().add(String.format("Erreur '%s': %s", b.getTitle(), ex.getMessage()));
                            }
                        } finally {
                            synchronized (job) {
                                job.setProcessedBooks(job.getProcessedBooks() + 1);
                            }
                        }
                    }));
                }

                for (Future<?> f : futures) {
                    f.get();
                }
            } finally {
                bookPool.shutdownNow();
            }

            job.setStatus("completed");
            job.setCurrentStep("Importation terminée avec succès.");
            job.setFinishedAt(Instant.now());

            log.info("[Importer] Job {} completed: {} created, {} updated, {} purchases, {} reading sessions, {} notes",
                    job.getId(), job.getCreatedBooks(), job.getUpdatedBooks(), job.getImportedPurchases(), job.getImportedReadingSessions(), job.getImportedNotes());

        } catch (Throwable ex) {
            log.error("[Importer] Import failed for job {}: {}", job.getId(), ex.getMessage(), ex);
            job.setStatus("failed");
            job.getErrors().add("Erreur de lecture du fichier .bookmory: " + ex.getMessage());
            job.setFinishedAt(Instant.now());
        }
    }

    private void processSingleBook(ImportJob job, BookmoryBook b, ParsedBookmory parsed, ImportOptions options) {
        String cleanT = BookmoryDbService.cleanText(b.getTitle());
        if (cleanT.isBlank()) {
            return;
        }

        Long bookId;
        if (!options.isImportBooks()) {
            ExistingBook existing = dbService.findBook(b.getIsbn(), cleanT);
            if (existing == null) {
                return;
            }
            bookId = existing.getId();
        } else {

        // 1. Process cover image with concurrency control
        String coverURL = "";
        if (b.getImage() != null && !b.getImage().isBlank()) {
            try {
                mediaSemaphore.acquire();
                try {
                    coverURL = mediaService.processBookCover(b.getImage(), parsed.getZipImages(), parsed.getZipFile());
                } finally {
                    mediaSemaphore.release();
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }

        // 2. Resolve Publisher / Editor
        Long editorId = null;
        if (b.getPublisher() != null && !b.getPublisher().isBlank()) {
            editorId = dbService.findOrCreateEditor(b.getPublisher());
        }

        // 3. Resolve Series
        Long seriesId = null;
        String seriesName = "";
        if (b.getSeriesKey() != null && !b.getSeriesKey().isBlank()) {
            seriesName = parsed.getSeries().get(b.getSeriesKey());
        }
        if (seriesName != null && !seriesName.isBlank()) {
            seriesId = dbService.findOrCreateSeries(seriesName);
        }

        // 4. Personal collections from Bookmory are NOT imported as publisher collections

        // 5. Query BNF whenever any key field is missing (ISBN, pages, release date, author, or publisher/type hint)
        BnfBookData bnfData = null;
        String isbn = b.getIsbn() != null ? b.getIsbn().trim() : "";
        boolean missingPages = (b.getRealTotalPage() == null || b.getRealTotalPage() == 0) &&
                (b.getTotalPage() == null || b.getTotalPage() == 0);
        boolean missingPubDate = b.getPublicationDate() == null || b.getPublicationDate().isBlank();
        boolean missingAuthor = (b.getAuthor() == null || b.getAuthor().isBlank()) &&
                (b.getAuthors() == null || b.getAuthors().isEmpty());
        boolean missingPublisher = b.getPublisher() == null || b.getPublisher().isBlank();

        if (isbn.isBlank() || missingPages || missingPubDate || missingAuthor || missingPublisher) {
            if (!isbn.isBlank()) {
                bnfData = bnfClient.lookupByIsbn(isbn);
            }
            if (bnfData == null) {
                int vol = BookmoryDbService.parseVolume(b.getSeriesNumber(), b.getSeriesNumberDecimal(), cleanT);
                Integer volPtr = vol > 0 ? vol : null;
                bnfData = bnfClient.searchBook(cleanT, b.getAuthor(), b.getPublisher(), volPtr, 6);
            }
            if (bnfData != null) {
                if (isbn.isBlank() && bnfData.getIsbn() != null && !bnfData.getIsbn().isBlank()) {
                    log.info("[Importer] Enriched '{}' with BNF ISBN: {}", cleanT, bnfData.getIsbn());
                    b.setIsbn(bnfData.getIsbn());
                }
                if (missingPages && bnfData.getPageCount() != null) {
                    b.setRealTotalPage(bnfData.getPageCount().doubleValue());
                }
                if (missingPubDate && bnfData.getReleaseDate() != null) {
                    b.setPublicationDate(DateTimeFormatter.ISO_LOCAL_DATE.withZone(ZoneOffset.UTC).format(bnfData.getReleaseDate()));
                }
            }
        }

        // 6. Determine Book Type
        List<String> bookTags = parsed.getBookTags().getOrDefault(b.getKey(), Collections.emptyList());
        String bookType = determineBookType(b, b.getPublisher(), bnfData, bookTags);

        // 7. Release date
        Instant relDate = parseReleaseDate(b.getPublicationDate(), b.getCreatedAt());

        // 8. Check if Book already exists in database
        ExistingBook existing = dbService.findBook(b.getIsbn(), cleanT);

        if (existing != null) {
            bookId = existing.getId();
            boolean updated = dbService.updateExistingBook(existing, b, coverURL, editorId, seriesId, relDate, bookType);
            if (updated) {
                synchronized (job) { job.setUpdatedBooks(job.getUpdatedBooks() + 1); }
            }
        } else {
            bookId = dbService.createNewBook(b, coverURL, editorId, seriesId, relDate, bookType);
            synchronized (job) { job.setCreatedBooks(job.getCreatedBooks() + 1); }
        }

        // 9. Authors & Illustrators
        List<String> allAuthors = new ArrayList<>();
        if (b.getAuthors() != null && !b.getAuthors().isEmpty()) {
            allAuthors.addAll(b.getAuthors());
        } else if (b.getAuthor() != null && !b.getAuthor().isBlank()) {
            allAuthors.add(b.getAuthor());
        }
        if (allAuthors.isEmpty() && bnfData != null && bnfData.getAuthors() != null) {
            allAuthors.addAll(bnfData.getAuthors());
        }

        for (String authorName : allAuthors) {
            Long aid = dbService.findOrCreateAuthor(authorName);
            if (aid != null) {
                dbService.linkBookAuthor(bookId, aid, 1); // 1 = Writer
            }
        }

            if (b.getIllustrators() != null) {
                for (String illName : b.getIllustrators()) {
                    Long aid = dbService.findOrCreateAuthor(illName);
                    if (aid != null) {
                        dbService.linkBookAuthor(bookId, aid, 2); // 2 = Illustrator
                    }
                }
            }
        }

        // 10. User ownership & reading status
        if (options.isImportStatuses() && job.getUserId() != null && job.getUserId() > 0) {
            dbService.upsertUserOwnsBook(job.getUserId(), bookId, b.getWishlist());

            String readingStatus = determineReadingStatus(b);
            dbService.upsertBookStatus(job.getUserId(), bookId, readingStatus);
        }

        // 11. Purchases
        if (options.isImportPurchases() && hasPurchaseData(b) && job.getUserId() != null && job.getUserId() > 0) {
            for (BookmoryPurchase purchase : b.getPurchases()) {
                if (dbService.importPurchase(job.getUserId(), bookId, purchase)) {
                    synchronized (job) { job.setImportedPurchases(job.getImportedPurchases() + 1); }
                }
            }
        }

        // 12. Reading sessions
        if (options.isImportReadingSessions() && hasReadingSessionData(b) && job.getUserId() != null && job.getUserId() > 0) {
            Long earliestSessionMs = null;
            for (BookmoryRead read : b.getReads()) {
                if (read.getReadTimerList() != null) {
                    for (BookmoryReadTimer timer : read.getReadTimerList()) {
                        if (timer.getElapsedSec() != null && timer.getElapsedSec() > 0) {
                            Long timerTime = timer.getReadStartedAt() != null && timer.getReadStartedAt() > 0
                                    ? timer.getReadStartedAt()
                                    : timer.getCreatedAt();
                            if (timerTime != null && timerTime > 0) {
                                if (earliestSessionMs == null || timerTime < earliestSessionMs) {
                                    earliestSessionMs = timerTime;
                                }
                            }
                        }
                    }
                }
            }

            if (earliestSessionMs != null) {
                dbService.ensureReadingStartSession(job.getUserId(), bookId, Instant.ofEpochMilli(earliestSessionMs).minusMillis(1));
            }

            for (BookmoryRead read : b.getReads()) {
                Map<Long, Integer> pageByTime = new HashMap<>();
                if (read.getPageLogList() != null) {
                    for (BookmoryPageLog pl : read.getPageLogList()) {
                        if (pl.getCreatedAt() != null && pl.getPage() != null) {
                            pageByTime.put(pl.getCreatedAt(), pl.getPage().intValue());
                        }
                    }
                }

                if (read.getReadTimerList() != null) {
                    for (BookmoryReadTimer timer : read.getReadTimerList()) {
                        int page = b.getCurPage() != null ? b.getCurPage().intValue() : 0;
                        if (timer.getCreatedAt() != null && pageByTime.containsKey(timer.getCreatedAt()) && pageByTime.get(timer.getCreatedAt()) > 0) {
                            page = pageByTime.get(timer.getCreatedAt());
                        } else if (read.getPage() != null && read.getPage() > 0) {
                            page = read.getPage().intValue();
                        } else if (b.getRealTotalPage() != null && b.getRealTotalPage() > 0) {
                            page = b.getRealTotalPage().intValue();
                        }

                        if (dbService.importReadingSession(job.getUserId(), bookId, timer, page)) {
                            synchronized (job) { job.setImportedReadingSessions(job.getImportedReadingSessions() + 1); }
                        }
                    }
                }
            }
        }

        // 13. Book notes (from store 'notes' and optional reading comments)
        if (!options.isImportNotes() || !hasNoteData(b, parsed)) {
            return;
        }
        List<BookmoryNote> notesForBook = parsed.getBookNotes() != null
                ? parsed.getBookNotes().get(b.getKey())
                : null;
        List<String> readComments = new ArrayList<>();
        if (b.getReads() != null) {
            for (BookmoryRead read : b.getReads()) {
                if (read.getComment() != null && !read.getComment().isBlank()) {
                    readComments.add(read.getComment());
                }
            }
        }
        if (dbService.importBookNote(job.getUserId(), bookId, notesForBook, readComments)) {
            synchronized (job) { job.setImportedNotes(job.getImportedNotes() + 1); }
        }
    }

    private static boolean hasPurchaseData(BookmoryBook b) {
        return b.getPurchases() != null && !b.getPurchases().isEmpty();
    }

    private static boolean hasReadingSessionData(BookmoryBook b) {
        if (b.getReads() == null) {
            return false;
        }
        for (BookmoryRead read : b.getReads()) {
            if (read != null && read.getReadTimerList() != null) {
                for (BookmoryReadTimer timer : read.getReadTimerList()) {
                    if (timer != null && timer.getElapsedSec() != null && timer.getElapsedSec() > 0) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    private static boolean hasNoteData(BookmoryBook b, ParsedBookmory parsed) {
        if (parsed.getBookNotes() != null && b.getKey() != null) {
            List<BookmoryNote> notesForBook = parsed.getBookNotes().get(b.getKey());
            if (notesForBook != null) {
                for (BookmoryNote n : notesForBook) {
                    if (n != null && n.getParsedContent() != null && !n.getParsedContent().isBlank()) {
                        return true;
                    }
                }
            }
        }
        if (b.getReads() != null) {
            for (BookmoryRead read : b.getReads()) {
                if (read != null && read.getComment() != null && !read.getComment().isBlank()) {
                    return true;
                }
            }
        }
        return false;
    }

    private static boolean shouldProcessBook(BookmoryBook b, ParsedBookmory parsed, ImportOptions options) {
        if (BookmoryDbService.cleanText(b.getTitle()).isBlank()) {
            return false;
        }
        if (options.isImportBooks() || options.isImportStatuses()) {
            return true;
        }
        return (options.isImportPurchases() && hasPurchaseData(b))
                || (options.isImportReadingSessions() && hasReadingSessionData(b))
                || (options.isImportNotes() && hasNoteData(b, parsed));
    }

    private static String buildStepLabel(int total, ImportOptions options) {
        if (!options.isImportBooks() && !options.isImportStatuses()) {
            String plural = total > 1 ? "s" : "";
            int enabledCount = (options.isImportNotes() ? 1 : 0)
                    + (options.isImportPurchases() ? 1 : 0)
                    + (options.isImportReadingSessions() ? 1 : 0);
            if (enabledCount == 1) {
                if (options.isImportNotes()) {
                    return String.format("Importation des notes (%d album%s concerné%s)...", total, plural, plural);
                }
                if (options.isImportPurchases()) {
                    return String.format("Importation des achats (%d album%s concerné%s)...", total, plural, plural);
                }
                if (options.isImportReadingSessions()) {
                    return String.format("Importation des sessions de lecture (%d album%s concerné%s)...", total, plural, plural);
                }
            }
            return String.format("Importation des données sélectionnées (%d album%s concerné%s)...", total, plural, plural);
        }
        if (!options.isImportBooks() && options.isImportStatuses()) {
            return String.format("Mise à jour des statuts et données (%d albums)...", total);
        }
        return String.format("Importation des %d albums...", total);
    }

    private static String normalizeText(String s) {
        if (s == null) return "";
        s = s.toLowerCase().trim();
        return s.replace("é", "e").replace("è", "e").replace("ê", "e").replace("ë", "e")
                .replace("à", "a").replace("â", "a").replace("ä", "a")
                .replace("î", "i").replace("ï", "i")
                .replace("ô", "o").replace("ö", "o")
                .replace("û", "u").replace("ü", "u")
                .replace("-", " ").replace("_", " ").replace(".", " ");
    }

    private static String determineTypeFromPublisher(String pub) {
        String norm = normalizeText(pub);
        if (norm.isBlank()) return "";

        String[] mangaPubs = {
                "mangetsu", "kaze", "kurokawa", "ki oon", "kana", "pika",
                "akata", "meian", "taifu", "ototo", "nobi nobi", "vega", "kbooks",
                "panini manga", "glenat manga", "komikku", "crunchyroll"
        };
        for (String p : mangaPubs) {
            if (norm.contains(p)) return "Manga";
        }

        String[] romanPubs = {
                "robert laffont", "laffont", "albin michel", "bourgois", "bragelonne", "fayard",
                "le tripode", "tripode", "gallimard", "pocket", "j'ai lu", "flammarion", "actes sud",
                "seuil", "livre de poche", "toussaint louverture", "10 18",
                "archipoche", "belfond", "berkley", "castelmore", "cherche midi",
                "city", "denoel", "gallmeister", "milady", "sonatine",
                "folio", "bloomsbury", "barnes & noble", "entangled",
                "red tower", "de la martiniere jeunesse", "ecole des loisirs", "calix",
                "gloriana", "astrolabe", "ed du masque", "jove", "harpercollins",
                "penguin", "pocket jeunesse", "pkj", "hachette", "grasset",
                "rivages", "plon", "calmann levy", "l'atalante",
                "atalante", "mnemos", "belial", "critic",
                "odile jacob", "puf", "les belles lettres", "payot", "la dispute"
        };
        for (String p : romanPubs) {
            if (norm.contains(p)) return "Roman";
        }

        String[] comicsPubs = {
                "urban comics", "urban", "panini comics", "panini", "dc comics",
                "marvel", "image", "dark horse", "bliss comics", "bliss", "hicomics",
                "bubble editions", "bubble", "caurette", "404 editions",
                "komics initiative", "komics initiati", "komics",
                "huginn", "muninn", "delirium", "black river", "kinaye"
        };
        for (String p : comicsPubs) {
            if (norm.contains(p)) return "Comics";
        }

        String[] bdPubs = {
                "dargaud", "le lombard", "lombard", "dupuis", "casterman",
                "rue de sevres", "sevres", "humanoide", "humanoïdes",
                "soleil", "futuropolis", "bamboo",
                "cornelius", "ankama", "glenat", "label 619"
        };
        for (String p : bdPubs) {
            if (norm.contains(p)) return "Bande dessinée";
        }

        return "";
    }

    private static String determineBookType(BookmoryBook b, String editorName, BnfBookData bnfData, List<String> bookTags) {
        List<String> allTagParts = new ArrayList<>();
        if (b.getTags() != null && !b.getTags().isBlank()) {
            allTagParts.add(b.getTags());
        }
        if (bookTags != null) {
            allTagParts.addAll(bookTags);
        }
        String allTags = normalizeText(String.join(" ", allTagParts)).replace("#", " ").replace("&", " ");
        Set<String> tagTokens = new HashSet<>();
        for (String tok : allTags.split("\\s+")) {
            if (!tok.isBlank()) {
                tagTokens.add(tok);
            }
        }

        // 1. Specific publisher check first (most reliable, avoids noisy Goodreads tags like #ComicsManga)
        String pubNorm = normalizeText(editorName);
        boolean isAmbiguousPublisher = pubNorm.equals("panini") || pubNorm.equals("glenat") || pubNorm.equals("le tripode") || pubNorm.equals("tripode");
        String pubType = determineTypeFromPublisher(editorName);
        if (!pubType.isBlank() && !isAmbiguousPublisher) {
            return pubType;
        }

        // 2. Tag-based detection using whole tokens and clear precedence
        boolean hasSuperheroTag = tagTokens.contains("superheros") || tagTokens.contains("superheroes") ||
                allTags.contains("super heroes") || tagTokens.contains("marvel") ||
                tagTokens.contains("xmen") || tagTokens.contains("wonderwoman") ||
                tagTokens.contains("batman") || tagTokens.contains("superman") ||
                tagTokens.contains("dccomics");
        if (hasSuperheroTag) {
            return "Comics";
        }

        boolean hasMangaTag = tagTokens.contains("manga") || tagTokens.contains("mangas") ||
                tagTokens.contains("shonen") || tagTokens.contains("seinen") ||
                tagTokens.contains("shojo") || tagTokens.contains("josei");
        if (hasMangaTag) {
            return "Manga";
        }

        if (tagTokens.contains("bandedessinee") || tagTokens.contains("bandesdessinees") ||
                allTags.contains("bande dessinee") || allTags.contains("bandes dessinees") ||
                tagTokens.contains("bd")) {
            return "Bande dessinée";
        }

        if (tagTokens.contains("novel") || tagTokens.contains("novels") || tagTokens.contains("roman") ||
                tagTokens.contains("romans") || tagTokens.contains("nonfiction") || tagTokens.contains("biography") ||
                tagTokens.contains("biographymemoir") || tagTokens.contains("memoir") ||
                tagTokens.contains("classic") || tagTokens.contains("classics") ||
                tagTokens.contains("frenchliterature") || tagTokens.contains("philosophy") ||
                tagTokens.contains("anthropology") || tagTokens.contains("sociology") ||
                tagTokens.contains("psychology") || tagTokens.contains("history") ||
                tagTokens.contains("science") || tagTokens.contains("scienceshumaines") ||
                tagTokens.contains("sciencespolitiques") || tagTokens.contains("business") ||
                tagTokens.contains("audiobook") || tagTokens.contains("bookclub") ||
                tagTokens.contains("highfantasy") || tagTokens.contains("spaceopera")) {
            return "Roman";
        }

        if (tagTokens.contains("comics") || tagTokens.contains("comicbook") || tagTokens.contains("graphicnovels")) {
            return "Comics";
        }

        // 3. Fallback to ambiguous publisher (e.g. Panini, Glénat, Le Tripode)
        if (!pubType.isBlank()) {
            return pubType;
        }

        // 4. BNF document type if available
        if (bnfData != null && bnfData.getDocType() != null && !bnfData.getDocType().isBlank()) {
            return bnfData.getDocType();
        }

        // 5. Default fallback for unclassified books
        return "Roman";
    }

    private static Instant parseReleaseDate(String pubDate, Long createdAtMs) {
        if (pubDate != null && !pubDate.isBlank()) {
            String clean = pubDate.trim().replace('-', '/');
            String[] parts = clean.split("/");
            try {
                if (parts.length == 3) {
                    return LocalDate.parse(clean, DateTimeFormatter.ofPattern("yyyy/MM/dd")).atStartOfDay(ZoneOffset.UTC).toInstant();
                } else if (parts.length == 2) {
                    return LocalDate.parse(clean + "/01", DateTimeFormatter.ofPattern("yyyy/MM/dd")).atStartOfDay(ZoneOffset.UTC).toInstant();
                } else if (parts.length == 1 && clean.length() == 4) {
                    return LocalDate.parse(clean + "/01/01", DateTimeFormatter.ofPattern("yyyy/MM/dd")).atStartOfDay(ZoneOffset.UTC).toInstant();
                }
            } catch (Exception ignored) {}
        }
        if (createdAtMs != null && createdAtMs > 0) {
            return Instant.ofEpochMilli(createdAtMs);
        }
        return Instant.now();
    }

    private static String determineReadingStatus(BookmoryBook b) {
        if (b.getStatusList() != null) {
            for (String s : b.getStatusList()) {
                if (s == null) continue;
                switch (s.trim().toUpperCase()) {
                    case "DONE": return "READ";
                    case "READING": return "READING";
                    case "PAUSE":
                    case "PAUSED": return "PAUSED";
                    case "ABANDONED":
                    case "GIVE_UP":
                    case "STOP":
                    case "DROPPED": return "ABANDONED";
                    case "NOT_STARTED": return "UNREAD";
                }
            }
        }

        if (b.getReads() != null) {
            for (BookmoryRead rd : b.getReads()) {
                if (rd.getStatus() == null) continue;
                switch (rd.getStatus().trim().toUpperCase()) {
                    case "DONE": return "READ";
                    case "READING": return "READING";
                    case "PAUSE":
                    case "PAUSED": return "PAUSED";
                    case "ABANDONED":
                    case "GIVE_UP":
                    case "STOP":
                    case "DROPPED": return "ABANDONED";
                }
            }
        }

        if (b.getCurPage() != null && b.getCurPage() > 0) {
            if (b.getRealTotalPage() != null && b.getRealTotalPage() > 0 && b.getCurPage() >= b.getRealTotalPage()) {
                return "READ";
            }
            return "READING";
        }

        return "UNREAD";
    }
}
