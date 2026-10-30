package fr.openbook.scraper.service;

import fr.openbook.api.importing.bnf.BnfBookData;
import fr.openbook.api.importing.bnf.BnfClient;
import fr.openbook.api.entities.AuthorEntity;
import fr.openbook.api.services.AuthorDeduplicationService;
import fr.openbook.api.services.media.MediaService;
import fr.openbook.scraper.model.ScrapedAuthorDTO;
import fr.openbook.scraper.model.ScrapedBookDTO;
import fr.openbook.scraper.utils.FrenchDateParser;
import fr.openbook.scraper.utils.TextCleaner;
import fr.openbook.scraper.utils.VariantDetector;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ForkJoinPool;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class ScraperDbService {

    private static final Pattern RE_COVER_URL_ISBN = Pattern.compile("/(?:album|principal|prod|cache/[^/]+/[^/]+)/([0-9]{10,13})");
    private static final Set<String> BOGUS_TITLES = Set.of(
            "nos univers",
            "bronze books",
            "universal monsters",
            "adaptations littéraires",
            "la philo en bd",
            "l'école des loisirs en bd",
            "pierre lemaitre"
    );

    private static final Map<String, Integer> AUTHOR_TYPE_MAP = Map.of(
            "writer", 1,
            "scénariste", 1,
            "illustrator", 2,
            "dessinateur", 2,
            "colorist", 3,
            "coloriste", 3
    );

    private final JdbcTemplate jdbcTemplate;
    private final MediaService mediaService;
    private final BnfClient bnfClient;
    private final AuthorDeduplicationService authorDeduplicationService;

    /**
     * Download and save remote cover image directly into MediaService.
     * Returns UUID slot on success, or the original remote URL on error.
     */
    public String optimizeCover(String remoteUrl) {
        if (remoteUrl == null || !remoteUrl.startsWith("http")) {
            return remoteUrl;
        }
        try {
            String slotId = mediaService.createVirtualImage();
            mediaService.uploadRemoteUrl(slotId, remoteUrl);
            return slotId;
        } catch (Exception e) {
            log.warn("Cover optimization via MediaService failed for {}: {}", remoteUrl, e.getMessage());
            return remoteUrl;
        }
    }

    /**
     * Upserts a scraped book with multi-criteria deduplication, author linking,
     * variant resolution, and media service cover storage.
     */
    @Transactional
    public Integer upsertBook(ScrapedBookDTO book) {
        if (book == null || book.getTitle() == null || book.getTitle().isBlank()) {
            return null;
        }

        // 1. Clean strings
        String cleanTitle = TextCleaner.cleanText(book.getTitle());
        String seriesFallback = (book.getSeriesName() != null && !book.getSeriesName().isBlank())
                ? book.getSeriesName()
                : book.getTitle();
        String cleanSeriesName = TextCleaner.cleanText(seriesFallback);
        String cleanEditorName = TextCleaner.cleanText(book.getEditorName());
        String cleanDesc = TextCleaner.cleanText(book.getDescription());
        String cleanISBN = book.getIsbn() != null ? book.getIsbn().trim() : "";

        if (cleanISBN.isEmpty() && book.getCoverUrl() != null) {
            Matcher m = RE_COVER_URL_ISBN.matcher(book.getCoverUrl());
            if (m.find()) {
                cleanISBN = m.group(1);
            }
        }

        // 2. Editor
        Integer editorId = null;
        if (!cleanEditorName.isEmpty()) {
            try {
                editorId = jdbcTemplate.queryForObject(
                        "SELECT id FROM editor WHERE LOWER(name) = LOWER(?) LIMIT 1;",
                        Integer.class,
                        cleanEditorName
                );
            } catch (EmptyResultDataAccessException e) {
                try {
                    editorId = jdbcTemplate.queryForObject(
                            "INSERT INTO editor (name, created_at, updated_at) VALUES (?, NOW(), NOW()) RETURNING id;",
                            Integer.class,
                            cleanEditorName
                    );
                } catch (Exception insertEx) {
                    log.warn("Could not insert editor {}: {}", cleanEditorName, insertEx.getMessage());
                }
            }
        }

        // 3. Category (Default: Comics = 3)
        int categoryId = 3;
        String catName = TextCleaner.cleanText(book.getCategoryName());
        if (catName.isEmpty()) {
            catName = "Comics";
        }
        try {
            categoryId = jdbcTemplate.queryForObject(
                    "SELECT id FROM category WHERE LOWER(name) = LOWER(?) LIMIT 1;",
                    Integer.class,
                    catName
            );
        } catch (Exception ignored) {
            try {
                categoryId = jdbcTemplate.queryForObject(
                        "SELECT id FROM category WHERE name = 'Comics' LIMIT 1;",
                        Integer.class
                );
            } catch (Exception fallbackEx) {
                categoryId = 3;
            }
        }

        // 4. Collection
        Integer collectionId = null;
        String cleanColName = TextCleaner.cleanText(book.getCollectionName());
        if (!cleanColName.isEmpty()) {
            try {
                collectionId = jdbcTemplate.queryForObject(
                        "SELECT id FROM collection WHERE LOWER(name) = LOWER(?) LIMIT 1;",
                        Integer.class,
                        cleanColName
                );
            } catch (EmptyResultDataAccessException e) {
                try {
                    collectionId = jdbcTemplate.queryForObject(
                            "INSERT INTO collection (name, created_at, updated_at) VALUES (?, NOW(), NOW()) RETURNING id;",
                            Integer.class,
                            cleanColName
                    );
                } catch (Exception insertEx) {
                    log.warn("Could not insert collection {}: {}", cleanColName, insertEx.getMessage());
                }
            }
        }

        // 5. Extract canonical volume if needed
        Integer canonVol = VariantDetector.extractCanonicalSeriesAndVolume(cleanTitle).volume();
        if ((book.getVolume() == null || book.getVolume() == 0) && canonVol != null) {
            book.setVolume(canonVol);
        }

        boolean incomingIsVariant = VariantDetector.isVariantBook(cleanTitle, book.getCoverUrl(), "") || book.isVariant();
        Integer parentBookId = book.getParentBookId() != null ? book.getParentBookId().intValue() : null;
        if (parentBookId == null && incomingIsVariant && editorId != null) {
            String baseTitle = VariantDetector.stripVariantSuffix(cleanTitle);
            try {
                List<Map<String, Object>> candidates = jdbcTemplate.queryForList("""
                    SELECT id, title FROM book
                    WHERE editor_id = ?
                      AND (parent_book_id IS NULL OR parent_book_id = 0)
                      AND regexp_replace(lower(title), '[^a-z0-9]', '', 'g') = regexp_replace(lower(?), '[^a-z0-9]', '', 'g')
                    ORDER BY id ASC
                    LIMIT 1;
                """, editorId, baseTitle);

                if (!candidates.isEmpty()) {
                    String candTitle = (String) candidates.get(0).get("title");
                    if (!VariantDetector.isVariantBook(candTitle, "", "")) {
                        parentBookId = ((Number) candidates.get(0).get("id")).intValue();
                    }
                }
            } catch (Exception e) {
                log.debug("Parent book matching error: {}", e.getMessage());
            }

            if (parentBookId == null && book.getVolume() != null && book.getVolume() > 0) {
                try {
                    List<Map<String, Object>> pRows = jdbcTemplate.queryForList("""
                        SELECT id, COALESCE(title, '') as title FROM book
                        WHERE editor_id = ? AND volume = ?
                          AND (parent_book_id IS NULL OR parent_book_id = 0)
                        ORDER BY id ASC;
                    """, editorId, book.getVolume());

                    String lowClean = cleanTitle.toLowerCase();
                    String lowBase = baseTitle.toLowerCase();
                    for (Map<String, Object> row : pRows) {
                        String pTitle = (String) row.get("title");
                        if (!VariantDetector.isVariantBook(pTitle, "", "")) {
                            String pClean = VariantDetector.stripVariantSuffix(TextCleaner.cleanText(pTitle)).toLowerCase();
                            if (lowClean.contains(pClean) || pClean.contains(lowBase)) {
                                parentBookId = ((Number) row.get("id")).intValue();
                                break;
                            }
                        }
                    }
                } catch (Exception e) {
                    log.debug("Parent volume matching error: {}", e.getMessage());
                }
            }
        }

        // BNF enrichment if ISBN is missing
        if (cleanISBN.isEmpty()) {
            String primaryAuthor = "";
            if (book.getAuthors() != null && !book.getAuthors().isEmpty()) {
                primaryAuthor = book.getAuthors().get(0).getLastname();
            }
            try {
                BnfBookData bnfData = bnfClient.searchBook(cleanTitle, primaryAuthor, cleanEditorName, book.getVolume(), 8);
                if (bnfData != null && bnfData.getIsbn() != null && !bnfData.getIsbn().isBlank()) {
                    cleanISBN = bnfData.getIsbn();
                    book.setIsbn(cleanISBN);
                    if (book.getPageCount() == 0 && bnfData.getPageCount() != null) {
                        book.setPageCount(bnfData.getPageCount());
                    }
                    if (collectionId == null && bnfData.getCollectionName() != null && !bnfData.getCollectionName().isBlank()) {
                        String cleanCol = TextCleaner.cleanText(bnfData.getCollectionName());
                        try {
                            collectionId = jdbcTemplate.queryForObject(
                                    "SELECT id FROM collection WHERE LOWER(name) = LOWER(?) LIMIT 1;",
                                    Integer.class,
                                    cleanCol
                            );
                        } catch (EmptyResultDataAccessException e) {
                            collectionId = jdbcTemplate.queryForObject(
                                    "INSERT INTO collection (name, created_at, updated_at) VALUES (?, NOW(), NOW()) RETURNING id;",
                                    Integer.class,
                                    cleanCol
                            );
                        }
                    }
                    if ((book.getAuthors() == null || book.getAuthors().isEmpty()) && bnfData.getAuthors() != null && !bnfData.getAuthors().isEmpty()) {
                        List<ScrapedAuthorDTO> authList = new ArrayList<>();
                        for (String a : bnfData.getAuthors()) {
                            String[] parts = TextCleaner.splitAuthorName(a);
                            authList.add(new ScrapedAuthorDTO(parts[0], parts[1], "writer"));
                        }
                        book.setAuthors(authList);
                    }
                    if (book.getReleaseDate() == null && bnfData.getReleaseDate() != null) {
                        book.setReleaseDate(LocalDate.ofInstant(bnfData.getReleaseDate(), java.time.ZoneOffset.UTC));
                    }
                }
            } catch (Exception e) {
                log.debug("BNF enrichment error during upsert: {}", e.getMessage());
            }
        }

        // Check if Book already exists (Multi-criteria matching)
        Integer bookId = null;

        // Criterion A: ISBN match
        if (!cleanISBN.isEmpty()) {
            try {
                bookId = jdbcTemplate.queryForObject("SELECT id FROM book WHERE isbn = ? LIMIT 1;", Integer.class, cleanISBN);
            } catch (EmptyResultDataAccessException ignored) {}
        }

        // Criterion B: Identical cover URL for same editor
        if (bookId == null && book.getCoverUrl() != null && !book.getCoverUrl().isBlank() && editorId != null) {
            try {
                bookId = jdbcTemplate.queryForObject(
                        "SELECT id FROM book WHERE cover_url = ? AND editor_id = ? LIMIT 1;",
                        Integer.class,
                        book.getCoverUrl(),
                        editorId
                );
            } catch (EmptyResultDataAccessException ignored) {}
        }

        // Criterion C: Normalized title match
        if (bookId == null && !cleanTitle.isEmpty() && editorId != null) {
            try {
                bookId = jdbcTemplate.queryForObject("""
                    SELECT id FROM book
                    WHERE editor_id = ?
                      AND regexp_replace(lower(title), '[^a-z0-9]', '', 'g') = regexp_replace(lower(?), '[^a-z0-9]', '', 'g')
                    LIMIT 1;
                """, Integer.class, editorId, cleanTitle);
            } catch (EmptyResultDataAccessException ignored) {}
        }

        // Criterion D: Volume and base title match for same editor
        if (bookId == null && editorId != null && book.getVolume() != null && book.getVolume() > 0) {
            String baseClean = VariantDetector.stripVariantSuffix(cleanTitle).toLowerCase();
            try {
                List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                        "SELECT id, COALESCE(title, '') as title FROM book WHERE editor_id = ? AND volume = ? ORDER BY id ASC;",
                        editorId, book.getVolume()
                );
                for (Map<String, Object> r : rows) {
                    String candTitle = (String) r.get("title");
                    boolean candIsVariant = VariantDetector.isVariantBook(candTitle, "", "");
                    if (incomingIsVariant == candIsVariant) {
                        if (candTitle.equalsIgnoreCase(cleanTitle) || VariantDetector.stripVariantSuffix(candTitle).toLowerCase().equals(baseClean)) {
                            bookId = (Integer) r.get("id");
                            break;
                        }
                    }
                }
            } catch (Exception ignored) {}
        }

        if (bookId != null) {
            // Update existing book
            if (parentBookId != null && parentBookId.equals(bookId)) {
                parentBookId = null;
            }

            String existingCover = "";
            try {
                existingCover = jdbcTemplate.queryForObject("SELECT COALESCE(cover_url, '') FROM book WHERE id = ?;", String.class, bookId);
            } catch (Exception ignored) {}
            if (existingCover == null) existingCover = "";
            existingCover = existingCover.trim();

            String storedCover;
            if (existingCover.isEmpty() || existingCover.toLowerCase().startsWith("http")) {
                storedCover = optimizeCover(book.getCoverUrl());
            } else {
                // Preserve existing UUID cover in MediaService
                storedCover = existingCover;
            }

            Timestamp releaseTimestamp = book.getReleaseDate() != null
                    ? Timestamp.valueOf(book.getReleaseDate().atStartOfDay())
                    : null;

            jdbcTemplate.update("""
                UPDATE book
                SET updated_at = NOW(),
                    price = COALESCE(NULLIF(?, 0), price),
                    page_count = COALESCE(NULLIF(?, 0), page_count),
                    release_date = COALESCE(?, release_date),
                    description = COALESCE(?, description),
                    cover_url = COALESCE(?, cover_url),
                    collection_id = COALESCE(?, collection_id),
                    parent_book_id = CASE
                        WHEN ?::int IS NOT NULL AND ?::int != id THEN ?::int
                        WHEN parent_book_id = id THEN NULL
                        ELSE parent_book_id
                    END
                WHERE id = ?;
            """,
                    book.getPrice(),
                    book.getPageCount(),
                    releaseTimestamp,
                    cleanDesc.isEmpty() ? null : cleanDesc,
                    storedCover,
                    collectionId,
                    parentBookId, parentBookId, parentBookId,
                    bookId
            );

            if (!cleanISBN.isEmpty()) {
                try {
                    Integer otherId = jdbcTemplate.queryForObject(
                            "SELECT id FROM book WHERE isbn = ? AND id != ? LIMIT 1;",
                            Integer.class,
                            cleanISBN, bookId
                    );
                    log.debug("ISBN {} already assigned to book {}; skipping ISBN update for {}", cleanISBN, otherId, bookId);
                } catch (EmptyResultDataAccessException e) {
                    jdbcTemplate.update("UPDATE book SET isbn = ? WHERE id = ? AND (isbn IS NULL OR isbn = '');", cleanISBN, bookId);
                }
            }

            // Check if title should be updated (repair bogus title)
            try {
                String currTitle = jdbcTemplate.queryForObject("SELECT COALESCE(title, '') FROM book WHERE id = ?;", String.class, bookId);
                if (currTitle != null && !currTitle.isBlank()) {
                    String currLow = currTitle.trim().toLowerCase();
                    String cleanLow = cleanTitle.toLowerCase();
                    if (BOGUS_TITLES.contains(currLow) || (cleanTitle.length() > currTitle.length() && !BOGUS_TITLES.contains(cleanLow))) {
                        jdbcTemplate.update("UPDATE book SET title = ? WHERE id = ?;", cleanTitle, bookId);
                    }
                }
            } catch (Exception ignored) {}

        } else {
            // Insert new book
            String storedCover = optimizeCover(book.getCoverUrl());
            if (!cleanISBN.isEmpty()) {
                try {
                    Integer existingWithIsbn = jdbcTemplate.queryForObject("SELECT id FROM book WHERE isbn = ? LIMIT 1;", Integer.class, cleanISBN);
                    if (existingWithIsbn != null) {
                        log.debug("ISBN {} already taken by book {}; inserting new book without ISBN", cleanISBN, existingWithIsbn);
                        cleanISBN = "";
                    }
                } catch (EmptyResultDataAccessException ignored) {}
            }

            int volVal = (book.getVolume() != null && book.getVolume() > 0) ? book.getVolume() : 1;
            Timestamp relTimestamp = book.getReleaseDate() != null
                    ? Timestamp.valueOf(book.getReleaseDate().atStartOfDay())
                    : Timestamp.valueOf(LocalDate.now().atStartOfDay());
            String bType = (book.getBookType() != null && !book.getBookType().isBlank()) ? book.getBookType() : "Comics";

            String finalCleanISBN = cleanISBN;
            Integer finalEditorId = editorId;
            Integer finalCollectionId = collectionId;
            Integer finalParentBookId = parentBookId;

            KeyHolder keyHolder = new GeneratedKeyHolder();
            jdbcTemplate.update(connection -> {
                PreparedStatement ps = connection.prepareStatement("""
                    INSERT INTO book (
                        title, series_id, editor_id, collection_id,
                        volume, isbn, page_count, price, description,
                        cover_url, release_date, type, parent_book_id,
                        created_at, updated_at
                    ) VALUES (
                        ?, NULL, ?, ?,
                        ?, ?, ?, ?, ?,
                        ?, ?, ?, ?,
                        NOW(), NOW()
                    ) RETURNING id;
                """, Statement.RETURN_GENERATED_KEYS);
                ps.setString(1, cleanTitle);
                if (finalEditorId != null) ps.setInt(2, finalEditorId); else ps.setNull(2, java.sql.Types.INTEGER);
                if (finalCollectionId != null) ps.setInt(3, finalCollectionId); else ps.setNull(3, java.sql.Types.INTEGER);
                ps.setInt(4, volVal);
                if (!finalCleanISBN.isEmpty()) ps.setString(5, finalCleanISBN); else ps.setNull(5, java.sql.Types.VARCHAR);
                ps.setInt(6, book.getPageCount());
                ps.setInt(7, book.getPrice());
                if (!cleanDesc.isEmpty()) ps.setString(8, cleanDesc); else ps.setNull(8, java.sql.Types.VARCHAR);
                ps.setString(9, storedCover);
                ps.setTimestamp(10, relTimestamp);
                ps.setString(11, bType);
                if (finalParentBookId != null) ps.setInt(12, finalParentBookId); else ps.setNull(12, java.sql.Types.INTEGER);
                return ps;
            }, keyHolder);

            Number generatedKey = keyHolder.getKey();
            if (generatedKey != null) {
                bookId = generatedKey.intValue();
            }
        }

        if (bookId == null) {
            return null;
        }

        // 6. Save Authors
        if (book.getAuthors() != null) {
            for (ScrapedAuthorDTO authorData : book.getAuthors()) {
                String cleanFn = TextCleaner.cleanText(authorData.getFirstname());
                String cleanLn = TextCleaner.cleanText(authorData.getLastname());
                if (cleanLn.isEmpty()) {
                    continue;
                }

                AuthorEntity author = authorDeduplicationService.findOrCreateAuthor(cleanFn, cleanLn);
                if (author == null || author.getId() == null) continue;
                Integer authorId = author.getId().intValue();

                if (authorId == null) continue;

                int authorTypeId = 1;
                if (authorData.getRole() != null) {
                    authorTypeId = AUTHOR_TYPE_MAP.getOrDefault(authorData.getRole().toLowerCase().trim(), 1);
                }

                try {
                    Integer exists = jdbcTemplate.queryForObject(
                            "SELECT 1 FROM book_has_author WHERE book_id = ? AND author_id = ? AND author_type_id = ? LIMIT 1;",
                            Integer.class,
                            bookId, authorId, authorTypeId
                    );
                } catch (EmptyResultDataAccessException e) {
                    jdbcTemplate.update(
                            "INSERT INTO book_has_author (book_id, author_id, author_type_id, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW());",
                            bookId, authorId, authorTypeId
                    );
                }
            }
        }

        return bookId;
    }

    /**
     * Repairs Mojibake strings across book and series tables, normalizes authors,
     * purges bogus scraper metadata, and merges duplicates.
     */
    @Transactional
    public Map<String, Object> repairMojibake() {
        log.info("Starting Mojibake and database maintenance repair pass...");

        // 1. Repair books
        List<Map<String, Object>> books = jdbcTemplate.queryForList(
                "SELECT id, COALESCE(title, '') as title, COALESCE(description, '') as description FROM book WHERE title ~ '[ÃÂ]' OR description ~ '[ÃÂ]';"
        );
        for (Map<String, Object> b : books) {
            int id = (Integer) b.get("id");
            String newTitle = TextCleaner.cleanText((String) b.get("title"));
            String newDesc = TextCleaner.cleanText((String) b.get("description"));
            jdbcTemplate.update("UPDATE book SET title = ?, description = ? WHERE id = ?;", newTitle, newDesc, id);
        }
        int repairedBooks = books.size();

        // 2. Repair series
        List<Map<String, Object>> series = jdbcTemplate.queryForList(
                "SELECT id, COALESCE(name, '') as name FROM series WHERE name ~ '[ÃÂ]';"
        );
        for (Map<String, Object> s : series) {
            int sId = (Integer) s.get("id");
            String newName = TextCleaner.cleanText((String) s.get("name"));
            try {
                Integer targetId = jdbcTemplate.queryForObject(
                        "SELECT id FROM series WHERE name = ? AND id != ? LIMIT 1;",
                        Integer.class,
                        newName, sId
                );
                jdbcTemplate.update("UPDATE book SET series_id = ? WHERE series_id = ?;", targetId, sId);
                jdbcTemplate.update("DELETE FROM series_has_theme WHERE series_id = ?;", sId);
                jdbcTemplate.update("DELETE FROM series WHERE id = ?;", sId);
            } catch (EmptyResultDataAccessException e) {
                jdbcTemplate.update("UPDATE series SET name = ? WHERE id = ?;", newName, sId);
            }
        }
        int repairedSeries = series.size();

        // 3. Purge bogus scraper authors
        jdbcTemplate.update("""
            DELETE FROM book_has_author
            WHERE author_id IN (
                SELECT id FROM author WHERE LOWER(lastname) IN ('interviews', 'portfolio', 'auteurs')
            );
        """);
        jdbcTemplate.update("DELETE FROM author WHERE LOWER(lastname) IN ('interviews', 'portfolio', 'auteurs');");

        // 4. Repair authors
        repairAuthors();

        // 5. Deduplicate books
        int mergedDuplicates = deduplicateBooks();

        log.info("Mojibake repair complete: {} books repaired, {} series repaired, {} duplicates merged",
                repairedBooks, repairedSeries, mergedDuplicates);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("repaired_books", repairedBooks);
        result.put("repaired_series", repairedSeries);
        result.put("merged_duplicates", mergedDuplicates);
        return result;
    }

    /**
     * Normalizes and repairs compound author names and duplicates.
     */
    @Transactional
    public void repairAuthors() {
        authorDeduplicationService.deduplicateAllAuthors();


        // Remove duplicate book_has_author rows
        jdbcTemplate.update("""
            DELETE FROM book_has_author a USING book_has_author b
            WHERE a.ctid < b.ctid
              AND a.book_id = b.book_id
              AND a.author_id = b.author_id
              AND a.author_type_id = b.author_type_id;
        """);
    }

    /**
     * Deduplicates and merges redundant book records sharing identical ISBN, cover URL,
     * or normalized title within the same publisher.
     */
    @Transactional
    public int deduplicateBooks() {
        List<Map<String, Object>> pairs = jdbcTemplate.queryForList("""
            SELECT b1.id as id1, b2.id as id2,
                   COALESCE(b1.title, '') as t1, COALESCE(b2.title, '') as t2,
                   COALESCE(b1.isbn, '') as isbn1, COALESCE(b2.isbn, '') as isbn2,
                   COALESCE(b1.cover_url, '') as c1, COALESCE(b2.cover_url, '') as c2,
                   COALESCE(b1.description, '') as d1, COALESCE(b2.description, '') as d2
            FROM book b1
            JOIN book b2 ON b1.id < b2.id AND b1.editor_id = b2.editor_id
            WHERE (b1.cover_url IS NOT NULL AND b1.cover_url != '' AND b1.cover_url = b2.cover_url)
               OR (b1.isbn IS NOT NULL AND b1.isbn != '' AND b1.isbn = b2.isbn)
               OR (regexp_replace(lower(b1.title), '[^a-z0-9]', '', 'g') = regexp_replace(lower(b2.title), '[^a-z0-9]', '', 'g'));
        """);

        int mergedCount = 0;
        Set<Integer> handledDrops = new HashSet<>();

        for (Map<String, Object> p : pairs) {
            int id1 = (Integer) p.get("id1");
            int id2 = (Integer) p.get("id2");
            String t1 = (String) p.get("t1");
            String t2 = (String) p.get("t2");
            String isbn1 = (String) p.get("isbn1");
            String isbn2 = (String) p.get("isbn2");
            String c1 = (String) p.get("c1");
            String c2 = (String) p.get("c2");
            String d1 = (String) p.get("d1");
            String d2 = (String) p.get("d2");

            if (handledDrops.contains(id1) || handledDrops.contains(id2)) {
                continue;
            }

            if (!c1.equals(c2) && (!isbn1.equals(isbn2) || isbn1.isEmpty())) {
                if (t1.toLowerCase().contains("nanarland") || VariantDetector.isVariantTitle(t1) || VariantDetector.isVariantTitle(t2)) {
                    continue;
                }
            }

            boolean t1Bogus = BOGUS_TITLES.contains(t1.trim().toLowerCase());
            boolean t2Bogus = BOGUS_TITLES.contains(t2.trim().toLowerCase());

            int keepId, dropId;
            String keepIsbn, dropIsbn, keepDesc, dropDesc;

            if (t1Bogus && !t2Bogus) {
                keepId = id2; dropId = id1; keepIsbn = isbn2; dropIsbn = isbn1; keepDesc = d2; dropDesc = d1;
            } else if (t2Bogus && !t1Bogus) {
                keepId = id1; dropId = id2; keepIsbn = isbn1; dropIsbn = isbn2; keepDesc = d1; dropDesc = d2;
            } else if (!isbn1.isEmpty() && isbn2.isEmpty()) {
                keepId = id1; dropId = id2; keepIsbn = isbn1; dropIsbn = isbn2; keepDesc = d1; dropDesc = d2;
            } else if (!isbn2.isEmpty() && isbn1.isEmpty()) {
                keepId = id2; dropId = id1; keepIsbn = isbn2; dropIsbn = isbn1; keepDesc = d2; dropDesc = d1;
            } else if (t1.length() >= t2.length()) {
                keepId = id1; dropId = id2; keepIsbn = isbn1; dropIsbn = isbn2; keepDesc = d1; dropDesc = d2;
            } else {
                keepId = id2; dropId = id1; keepIsbn = isbn2; dropIsbn = isbn1; keepDesc = d2; dropDesc = d1;
            }

            handledDrops.add(dropId);

            if (keepIsbn.isEmpty() && !dropIsbn.isEmpty()) {
                jdbcTemplate.update("UPDATE book SET isbn = ? WHERE id = ?;", dropIsbn, keepId);
            }
            if (keepDesc.isEmpty() && !dropDesc.isEmpty()) {
                jdbcTemplate.update("UPDATE book SET description = ? WHERE id = ?;", dropDesc, keepId);
            }

            // Repoint user ownerships
            jdbcTemplate.update("""
                DELETE FROM user_owns_book
                WHERE book_id = ?
                  AND user_id IN (SELECT user_id FROM user_owns_book WHERE book_id = ?);
            """, dropId, keepId);
            jdbcTemplate.update("UPDATE user_owns_book SET book_id = ? WHERE book_id = ?;", keepId, dropId);

            // Repoint reading status
            jdbcTemplate.update("""
                DELETE FROM book_status
                WHERE book_id = ?
                  AND user_id IN (SELECT user_id FROM book_status WHERE book_id = ?);
            """, dropId, keepId);
            jdbcTemplate.update("UPDATE book_status SET book_id = ? WHERE book_id = ?;", keepId, dropId);

            // Repoint reading sessions
            jdbcTemplate.update("UPDATE reading_session SET book_id = ? WHERE book_id = ?;", keepId, dropId);

            // Repoint authors
            jdbcTemplate.update("""
                DELETE FROM book_has_author
                WHERE book_id = ?
                  AND author_id IN (SELECT author_id FROM book_has_author WHERE book_id = ?);
            """, dropId, keepId);
            jdbcTemplate.update("UPDATE book_has_author SET book_id = ? WHERE book_id = ?;", keepId, dropId);

            // Repoint themes
            jdbcTemplate.update("""
                DELETE FROM book_has_theme
                WHERE book_id = ?
                  AND theme_id IN (SELECT theme_id FROM book_has_theme WHERE book_id = ?);
            """, dropId, keepId);
            jdbcTemplate.update("UPDATE book_has_theme SET book_id = ? WHERE book_id = ?;", keepId, dropId);

            // Repoint images
            jdbcTemplate.update("UPDATE book_has_image SET book_id = ? WHERE book_id = ?;", keepId, dropId);

            // Delete duplicate book
            jdbcTemplate.update("DELETE FROM book WHERE id = ?;", dropId);
            mergedCount++;
        }

        if (mergedCount > 0) {
            log.info("Deduplicated and merged {} redundant book records", mergedCount);
        }
        return mergedCount;
    }

    /**
     * Detects volume conflicts in series where multiple books share the same volume.
     */
    public List<Map<String, Object>> detectVolumeConflicts() {
        List<Map<String, Object>> conflictRows = jdbcTemplate.queryForList("""
            SELECT b.series_id, s.name as series_name, b.volume, COUNT(*) as count
            FROM book b
            JOIN series s ON b.series_id = s.id
            WHERE b.volume IS NOT NULL AND b.parent_book_id IS NULL
            GROUP BY b.series_id, s.name, b.volume
            HAVING COUNT(*) > 1
            ORDER BY s.name, b.volume;
        """);

        List<Map<String, Object>> result = new ArrayList<>();
        Set<Integer> seenSeries = new HashSet<>();

        for (Map<String, Object> c : conflictRows) {
            int sid = (Integer) c.get("series_id");
            if (seenSeries.contains(sid)) {
                continue;
            }
            seenSeries.add(sid);

            List<Map<String, Object>> books = jdbcTemplate.queryForList("""
                SELECT b.id, COALESCE(b.title, '') as title, b.volume, b.isbn, b.price, b.page_count,
                       b.release_date, b.cover_url, col.name as collection_name,
                       b.parent_book_id
                FROM book b
                LEFT JOIN collection col ON b.collection_id = col.id
                WHERE b.series_id = ? AND b.parent_book_id IS NULL
                ORDER BY b.volume, b.release_date, b.id;
            """, sid);

            List<Map<String, Object>> mappedBooks = new ArrayList<>();
            for (Map<String, Object> b : books) {
                String title = (String) b.get("title");
                Timestamp relDate = (Timestamp) b.get("release_date");
                String relStr = relDate != null ? relDate.toLocalDateTime().format(DateTimeFormatter.ISO_LOCAL_DATE) : null;

                Map<String, Object> bm = new LinkedHashMap<>();
                bm.put("id", b.get("id"));
                bm.put("title", title);
                bm.put("volume", b.get("volume"));
                bm.put("isbn", b.get("isbn"));
                bm.put("price", b.get("price"));
                bm.put("page_count", b.get("page_count"));
                bm.put("release_date", relStr);
                bm.put("cover_url", b.get("cover_url"));
                bm.put("collection_name", b.get("collection_name"));
                bm.put("is_variant_hint", VariantDetector.isVariantTitle(title));
                mappedBooks.add(bm);
            }

            Map<String, Object> conflictEntry = new LinkedHashMap<>();
            conflictEntry.put("series_id", sid);
            conflictEntry.put("series_name", c.get("series_name"));
            conflictEntry.put("conflicting_volume", c.get("volume"));
            conflictEntry.put("books", mappedBooks);
            result.add(conflictEntry);
        }

        return result;
    }

    /**
     * Splits selected books out of a series into a new series.
     */
    @Transactional
    public Map<String, Object> splitSeries(int sourceSeriesId, String newSeriesName, List<Integer> bookIds) {
        if (newSeriesName == null || newSeriesName.isBlank() || bookIds == null || bookIds.isEmpty()) {
            throw new IllegalArgumentException("newSeriesName and bookIds are required");
        }
        String cleanNewName = TextCleaner.cleanText(newSeriesName);

        Map<String, Object> srcSeries;
        try {
            srcSeries = jdbcTemplate.queryForMap(
                    "SELECT category_id, status FROM series WHERE id = ?;",
                    sourceSeriesId
            );
        } catch (EmptyResultDataAccessException e) {
            throw new IllegalArgumentException("Series with id " + sourceSeriesId + " not found");
        }

        Integer newSeriesId;
        try {
            newSeriesId = jdbcTemplate.queryForObject(
                    "SELECT id FROM series WHERE LOWER(name) = LOWER(?) LIMIT 1;",
                    Integer.class,
                    cleanNewName
            );
        } catch (EmptyResultDataAccessException e) {
            newSeriesId = jdbcTemplate.queryForObject("""
                INSERT INTO series (name, status, category_id, created_at, updated_at)
                VALUES (?, ?, ?, NOW(), NOW())
                RETURNING id;
            """, Integer.class, cleanNewName, srcSeries.get("status"), srcSeries.get("category_id"));
        }

        int movedCount = 0;
        for (Integer bid : bookIds) {
            movedCount += jdbcTemplate.update(
                    "UPDATE book SET series_id = ?, updated_at = NOW() WHERE id = ? AND series_id = ?;",
                    newSeriesId, bid, sourceSeriesId
            );
        }

        log.info("Split series {} -> {} ({}): moved {} books", sourceSeriesId, newSeriesId, cleanNewName, movedCount);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("status", "success");
        result.put("moved_count", movedCount);
        result.put("source_series_id", sourceSeriesId);
        result.put("new_series_id", newSeriesId);
        result.put("new_series_name", cleanNewName);
        return result;
    }

    /**
     * Links books as variants of a parent book.
     */
    @Transactional
    public Map<String, Object> linkVariant(int parentBookId, List<Integer> variantBookIds) {
        if (parentBookId <= 0 || variantBookIds == null || variantBookIds.isEmpty()) {
            throw new IllegalArgumentException("parentBookId and variantBookIds are required");
        }

        int linkedCount = 0;
        for (Integer vid : variantBookIds) {
            if (vid != parentBookId) {
                linkedCount += jdbcTemplate.update(
                        "UPDATE book SET parent_book_id = ?, updated_at = NOW() WHERE id = ?;",
                        parentBookId, vid
                );
            }
        }

        log.info("Linked {} books as variant of book {}", linkedCount, parentBookId);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("status", "success");
        result.put("linked_count", linkedCount);
        result.put("parent_book_id", parentBookId);
        result.put("variant_book_ids", variantBookIds);
        return result;
    }

    /**
     * Reconciles variants across the entire database.
     */
    @Transactional
    public Map<String, Object> reconcileVariants() {
        // 1. Break self-referencing and dangling parent links
        int selfRefFixed = jdbcTemplate.update("""
            UPDATE book
            SET parent_book_id = NULL, updated_at = NOW()
            WHERE parent_book_id = id;
        """);

        int danglingFixed = jdbcTemplate.update("""
            UPDATE book
            SET parent_book_id = NULL, updated_at = NOW()
            WHERE parent_book_id IS NOT NULL
              AND parent_book_id NOT IN (SELECT id FROM book);
        """);

        // 2. Clean up duplicate 'Edition collector' repetitions
        jdbcTemplate.update("""
            UPDATE book
            SET title = regexp_replace(title, '(\\s*-\\s*Edition collector)+', ' - Edition collector', 'gi')
            WHERE title ILIKE '%Edition collector%Edition collector%';
        """);

        // 3. Append ' - Edition collector' if cover is variant but title lacked suffix
        List<Map<String, Object>> vRows = jdbcTemplate.queryForList("""
            SELECT id, COALESCE(title, '') as title, COALESCE(cover_url, '') as cover_url FROM book
            WHERE cover_url ~* '[a-z0-9]+v_\\d+\\.(?:jpg|jpeg|png|webp)'
              AND NOT (title ~* '\\b(?:couverture\\s+variante|variant(?:e)?|collector)\\b');
        """);
        for (Map<String, Object> vb : vRows) {
            int vid = (Integer) vb.get("id");
            String newTitle = TextCleaner.cleanText((String) vb.get("title")) + " - Edition collector";
            jdbcTemplate.update("UPDATE book SET title = ?, updated_at = NOW() WHERE id = ?;", newTitle, vid);
        }

        // 4. Group books by editor and base title to match and link variants
        List<Map<String, Object>> allRows = jdbcTemplate.queryForList("""
            SELECT b.id, COALESCE(b.title, '') as title, b.volume, b.editor_id, b.parent_book_id, COALESCE(b.cover_url, '') as cover_url
            FROM book b
            WHERE b.editor_id IS NOT NULL
            ORDER BY b.editor_id, b.volume NULLS LAST, b.id ASC;
        """);

        record BookEntry(int id, String title, int editorId, Integer parentBookId, String coverUrl, boolean isVariant) {}

        Map<String, List<BookEntry>> groupMap = new LinkedHashMap<>();
        for (Map<String, Object> r : allRows) {
            int id = (Integer) r.get("id");
            String title = (String) r.get("title");
            int editorId = (Integer) r.get("editor_id");
            Integer parentBookId = (Integer) r.get("parent_book_id");
            String coverUrl = (String) r.get("cover_url");
            boolean isVariant = VariantDetector.isVariantBook(title, coverUrl, "");

            String bKey = editorId + "_" + VariantDetector.stripVariantSuffix(title).toLowerCase();
            groupMap.computeIfAbsent(bKey, k -> new ArrayList<>()).add(new BookEntry(id, title, editorId, parentBookId, coverUrl, isVariant));
        }

        int variantsLinked = 0;
        for (List<BookEntry> booksInGroup : groupMap.values()) {
            if (booksInGroup.size() < 2) {
                continue;
            }

            List<BookEntry> standards = new ArrayList<>();
            List<BookEntry> variants = new ArrayList<>();
            for (BookEntry b : booksInGroup) {
                if (b.isVariant()) {
                    variants.add(b);
                } else {
                    standards.add(b);
                }
            }

            if (!standards.isEmpty() && !variants.isEmpty()) {
                int parentId = standards.get(0).id();
                for (BookEntry v : variants) {
                    if (v.id() != parentId && (v.parentBookId() == null || v.parentBookId() != parentId)) {
                        int c = jdbcTemplate.update(
                                "UPDATE book SET parent_book_id = ?, updated_at = NOW() WHERE id = ?;",
                                parentId, v.id()
                        );
                        variantsLinked += c;
                    }
                }
                if (standards.get(0).parentBookId() != null) {
                    jdbcTemplate.update("UPDATE book SET parent_book_id = NULL, updated_at = NOW() WHERE id = ?;", parentId);
                }
            }
        }

        log.info("Reconciled variants: self_ref_fixed={}, dangling_fixed={}, variants_linked={}",
                selfRefFixed, danglingFixed, variantsLinked);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("status", "success");
        result.put("self_ref_fixed", selfRefFixed);
        result.put("dangling_fixed", danglingFixed);
        result.put("series_reassigned", 0);
        result.put("variants_linked", variantsLinked);
        return result;
    }

    /**
     * Enriches books missing ISBN from BNF.
     */
    @Transactional
    public Map<String, Object> enrichBooksFromBnf(int limit) {
        if (limit <= 0) limit = 100;

        List<Map<String, Object>> books = jdbcTemplate.queryForList("""
            SELECT b.id, COALESCE(b.title, '') as title, COALESCE(s.name, '') as series_name, b.volume,
                   COALESCE(e.name, '') as editor_name, b.page_count, b.collection_id, COALESCE(b.cover_url, '') as cover_url
            FROM book b
            LEFT JOIN series s ON b.series_id = s.id
            LEFT JOIN editor e ON b.editor_id = e.id
            WHERE b.isbn IS NULL OR b.isbn = '' OR LENGTH(TRIM(b.isbn)) < 10
            ORDER BY b.id DESC
            LIMIT ?;
        """, limit);

        int enrichedCount = 0;
        List<Map<String, Object>> details = new ArrayList<>();

        for (Map<String, Object> b : books) {
            int id = (Integer) b.get("id");
            String title = (String) b.get("title");
            String seriesName = (String) b.get("series_name");
            Integer volume = (Integer) b.get("volume");
            String editorName = (String) b.get("editor_name");
            Integer collectionId = (Integer) b.get("collection_id");
            String coverUrl = (String) b.get("cover_url");

            boolean isVar = VariantDetector.isVariantBook(title, coverUrl, "");
            BnfBookData bnfData = bnfClient.searchBook(title, "", editorName, volume, 8);
            if (bnfData == null || bnfData.getIsbn() == null || bnfData.getIsbn().isBlank()) {
                continue;
            }

            String foundISBN = bnfData.getIsbn();
            int foundPages = bnfData.getPageCount() != null ? bnfData.getPageCount() : 0;
            String foundCol = bnfData.getCollectionName();

            Integer newColId = collectionId;
            if (newColId == null && foundCol != null && !foundCol.isBlank()) {
                String cleanCol = TextCleaner.cleanText(foundCol);
                try {
                    newColId = jdbcTemplate.queryForObject(
                            "SELECT id FROM collection WHERE LOWER(name) = LOWER(?) LIMIT 1;",
                            Integer.class, cleanCol
                    );
                } catch (EmptyResultDataAccessException e) {
                    newColId = jdbcTemplate.queryForObject(
                            "INSERT INTO collection (name, created_at, updated_at) VALUES (?, NOW(), NOW()) RETURNING id;",
                            Integer.class, cleanCol
                    );
                }
            }

            String isbnToSet = foundISBN;
            try {
                Integer holderId = jdbcTemplate.queryForObject(
                        "SELECT id FROM book WHERE isbn = ? AND id != ? LIMIT 1;",
                        Integer.class, foundISBN, id
                );
                log.debug("BNF ISBN {} for book {} already held by book {}. Skipping ISBN.", foundISBN, id, holderId);
                isbnToSet = "";
            } catch (EmptyResultDataAccessException ignored) {}

            if (!isbnToSet.isEmpty()) {
                jdbcTemplate.update("""
                    UPDATE book
                    SET isbn = ?,
                        page_count = CASE WHEN page_count IS NULL OR page_count = 0 THEN ? ELSE page_count END,
                        collection_id = COALESCE(?, collection_id),
                        updated_at = NOW()
                    WHERE id = ?;
                """, isbnToSet, foundPages, newColId, id);
            } else {
                jdbcTemplate.update("""
                    UPDATE book
                    SET page_count = CASE WHEN page_count IS NULL OR page_count = 0 THEN ? ELSE page_count END,
                        collection_id = COALESCE(?, collection_id),
                        updated_at = NOW()
                    WHERE id = ?;
                """, foundPages, newColId, id);
            }

            enrichedCount++;
            Map<String, Object> dm = new LinkedHashMap<>();
            dm.put("book_id", id);
            dm.put("title", title);
            dm.put("isbn", foundISBN);
            dm.put("pages", foundPages);
            details.add(dm);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("scanned", books.size());
        result.put("enriched", enrichedCount);
        result.put("details", details);
        return result;
    }

    /**
     * Verifies books having ISBN against BNF and updates missing pages/collection.
     */
    @Transactional
    public Map<String, Object> verifyBooksFromBnf(int limit, boolean forceUpdatePages) {
        if (limit <= 0) limit = 100;

        List<Map<String, Object>> books = jdbcTemplate.queryForList("""
            SELECT b.id, COALESCE(b.title, '') as title, COALESCE(b.isbn, '') as isbn, b.page_count, b.collection_id
            FROM book b
            WHERE b.isbn IS NOT NULL AND LENGTH(TRIM(b.isbn)) >= 10
            ORDER BY (CASE WHEN b.page_count IS NULL OR b.page_count = 0 THEN 0 ELSE 1 END), b.updated_at ASC
            LIMIT ?;
        """, limit);

        int verifiedCount = 0;
        int updatedCount = 0;
        int pagesCorrected = 0;

        for (Map<String, Object> b : books) {
            int id = (Integer) b.get("id");
            String isbn = (String) b.get("isbn");
            Integer currentPages = (Integer) b.get("page_count");
            Integer collectionId = (Integer) b.get("collection_id");

            BnfBookData bnfData = bnfClient.lookupByIsbn(isbn);
            if (bnfData == null) {
                continue;
            }
            verifiedCount++;

            boolean hasChanges = false;
            if (bnfData.getPageCount() != null && bnfData.getPageCount() > 0) {
                if (currentPages == null || currentPages == 0 || forceUpdatePages) {
                    if (!Objects.equals(currentPages, bnfData.getPageCount())) {
                        jdbcTemplate.update("UPDATE book SET page_count = ?, updated_at = NOW() WHERE id = ?;", bnfData.getPageCount(), id);
                        pagesCorrected++;
                        hasChanges = true;
                    }
                }
            }

            if (collectionId == null && bnfData.getCollectionName() != null && !bnfData.getCollectionName().isBlank()) {
                String cleanCol = TextCleaner.cleanText(bnfData.getCollectionName());
                try {
                    Integer newColId = jdbcTemplate.queryForObject(
                            "SELECT id FROM collection WHERE LOWER(name) = LOWER(?) LIMIT 1;",
                            Integer.class, cleanCol
                    );
                    jdbcTemplate.update("UPDATE book SET collection_id = ?, updated_at = NOW() WHERE id = ?;", newColId, id);
                    hasChanges = true;
                } catch (EmptyResultDataAccessException ignored) {}
            }

            if (hasChanges) {
                updatedCount++;
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("scanned", books.size());
        result.put("verified", verifiedCount);
        result.put("updated", updatedCount);
        result.put("pages_corrected", pagesCorrected);
        return result;
    }

    /**
     * Migrates external HTTP cover URLs to UUIDs handled by MediaService.
     */
    public Map<String, Object> migrateCoversToUuid(Integer limit, int maxWorkers) {
        if (maxWorkers <= 0) maxWorkers = 4;

        String query = "SELECT id, COALESCE(title, '') as title, COALESCE(cover_url, '') as cover_url FROM book WHERE cover_url ~* '^https?://' ORDER BY id ASC";
        if (limit != null && limit > 0) {
            query += " LIMIT " + limit;
        }

        List<Map<String, Object>> candidates = jdbcTemplate.queryForList(query);
        if (candidates.isEmpty()) {
            Map<String, Object> res = new LinkedHashMap<>();
            res.put("status", "success");
            res.put("message", "Toutes les couvertures sont déjà sous forme d'UUID ! Aucune URL externe à migrer.");
            res.put("total", 0);
            res.put("migrated", 0);
            res.put("errors", 0);
            res.put("remaining", 0);
            return res;
        }

        log.info("Migrating {} book cover URLs to UUIDs...", candidates.size());

        record UpdateItem(int id, String cover) {}
        List<UpdateItem> updates = Collections.synchronizedList(new ArrayList<>());
        java.util.concurrent.atomic.AtomicInteger errorCount = new java.util.concurrent.atomic.AtomicInteger(0);

        ForkJoinPool customPool = new ForkJoinPool(maxWorkers);
        try {
            customPool.submit(() -> candidates.parallelStream().forEach(c -> {
                int id = (Integer) c.get("id");
                String cov = (String) c.get("cover_url");
                String uuidVal = optimizeCover(cov);
                if (uuidVal != null && !uuidVal.isEmpty() && !uuidVal.equals(cov) && !uuidVal.startsWith("http")) {
                    updates.add(new UpdateItem(id, uuidVal));
                } else {
                    errorCount.incrementAndGet();
                }
            })).get();
        } catch (Exception e) {
            log.error("Error during parallel cover migration: {}", e.getMessage());
        } finally {
            customPool.shutdown();
        }

        for (UpdateItem u : updates) {
            jdbcTemplate.update("UPDATE book SET cover_url = ?, updated_at = NOW() WHERE id = ?;", u.cover(), u.id());
        }

        int remaining = 0;
        try {
            remaining = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM book WHERE cover_url ~* '^https?://';", Integer.class);
        } catch (Exception ignored) {}

        String msg = String.format("Migration terminée : %d couverture(s) migrée(s) en UUID.", updates.size());
        if (errorCount.get() > 0) {
            msg += String.format(" (%d erreur(s) ou image(s) inaccessible(s))", errorCount.get());
        }
        if (remaining > 0) {
            msg += String.format(" - %d restante(s).", remaining);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("status", "success");
        result.put("message", msg);
        result.put("total", candidates.size());
        result.put("migrated", updates.size());
        result.put("errors", errorCount.get());
        result.put("remaining", remaining);
        return result;
    }

    /**
     * Returns maintenance statistics.
     */
    public Map<String, Object> getMaintenanceStats() {
        int totalBooks = 0, totalSeries = 0, totalEditors = 0, totalAuthors = 0, urlCovers = 0;
        try { totalBooks = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM book;", Integer.class); } catch (Exception ignored) {}
        try { totalSeries = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM series;", Integer.class); } catch (Exception ignored) {}
        try { totalEditors = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM editor;", Integer.class); } catch (Exception ignored) {}
        try { totalAuthors = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM author;", Integer.class); } catch (Exception ignored) {}
        try { urlCovers = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM book WHERE cover_url ~* '^https?://';", Integer.class); } catch (Exception ignored) {}

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("total_books", totalBooks);
        stats.put("total_series", totalSeries);
        stats.put("total_editors", totalEditors);
        stats.put("total_authors", totalAuthors);
        stats.put("url_covers", urlCovers);
        return stats;
    }

    /**
     * Returns recent books from the catalogue.
     */
    public List<Map<String, Object>> getRecentBooks(int limit) {
        if (limit <= 0) limit = 20;

        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
            SELECT b.id, COALESCE(b.title, '') as title, b.isbn, b.volume, b.release_date, b.cover_url,
                   e.name as editor_name, s.name as series_name, b.price
            FROM book b
            LEFT JOIN editor e ON b.editor_id = e.id
            LEFT JOIN series s ON b.series_id = s.id
            ORDER BY b.created_at DESC
            LIMIT ?;
        """, limit);

        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            Timestamp relDate = (Timestamp) r.get("release_date");
            String relVal = relDate != null ? relDate.toInstant().toString() : null;

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", r.get("id"));
            item.put("title", r.get("title"));
            item.put("isbn", r.get("isbn"));
            item.put("volume", r.get("volume"));
            item.put("release_date", relVal);
            item.put("cover_url", r.get("cover_url"));
            item.put("editor_name", r.get("editor_name"));
            item.put("series_name", r.get("series_name"));
            item.put("price", r.get("price"));
            result.add(item);
        }
        return result;
    }
}
