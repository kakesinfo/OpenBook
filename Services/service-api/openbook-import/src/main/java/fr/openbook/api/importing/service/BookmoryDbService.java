package fr.openbook.api.importing.service;

import fr.openbook.api.importing.model.BookmoryBook;
import fr.openbook.api.importing.model.BookmoryPurchase;
import fr.openbook.api.importing.model.BookmoryReadTimer;
import fr.openbook.api.importing.model.ExistingBook;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
public class BookmoryDbService {

    private static final Pattern RE_VOLUME_TOME = Pattern.compile("(?i)(?:^|[\\s\\-_])(?:tome|t|vol\\.?|volume|#)\\s*(\\d+)");
    private static final Pattern RE_NON_ISBN = Pattern.compile("[^0-9Xx]");

    private final JdbcTemplate jdbcTemplate;

    public BookmoryDbService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public static String cleanText(String s) {
        if (s == null) return "";
        return s.trim().replaceAll("\\s+", " ");
    }

    public static int parseVolume(Integer seriesNumber, Double seriesNumberDecimal, String title) {
        if (seriesNumber != null && seriesNumber > 0) {
            return seriesNumber;
        }
        if (seriesNumberDecimal != null && seriesNumberDecimal > 0) {
            return (int) Math.round(seriesNumberDecimal);
        }
        if (title != null) {
            Matcher m = RE_VOLUME_TOME.matcher(title);
            if (m.find()) {
                try {
                    int v = Integer.parseInt(m.group(1));
                    if (v > 0) return v;
                } catch (NumberFormatException ignored) {}
            }
        }
        return 0;
    }

    public Long findOrCreateEditor(String name) {
        String clean = cleanText(name);
        if (clean.isBlank()) return null;

        try {
            return jdbcTemplate.queryForObject(
                    "SELECT id FROM editor WHERE LOWER(name) = LOWER(?) LIMIT 1",
                    Long.class, clean
            );
        } catch (EmptyResultDataAccessException ignored) {}

        try {
            return jdbcTemplate.queryForObject(
                    "INSERT INTO editor (name, created_at, updated_at) VALUES (?, NOW(), NOW()) " +
                    "ON CONFLICT (name) DO UPDATE SET updated_at = NOW() RETURNING id",
                    Long.class, clean
            );
        } catch (Exception ex) {
            try {
                return jdbcTemplate.queryForObject(
                        "SELECT id FROM editor WHERE LOWER(name) = LOWER(?) LIMIT 1",
                        Long.class, clean
                );
            } catch (Exception e) {
                log.warn("Failed to find or create editor '{}': {}", clean, e.getMessage());
                return null;
            }
        }
    }

    public Long findOrCreateSeries(String name) {
        String clean = cleanText(name);
        if (clean.isBlank()) return null;

        try {
            return jdbcTemplate.queryForObject(
                    "SELECT id FROM series WHERE LOWER(name) = LOWER(?) LIMIT 1",
                    Long.class, clean
            );
        } catch (EmptyResultDataAccessException ignored) {}

        try {
            return jdbcTemplate.queryForObject(
                    "INSERT INTO series (name, status, category_id, created_at, updated_at) " +
                    "VALUES (?, 'ON_GOING', 3, NOW(), NOW()) " +
                    "ON CONFLICT (name) DO UPDATE SET updated_at = NOW() RETURNING id",
                    Long.class, clean
            );
        } catch (Exception ex) {
            try {
                return jdbcTemplate.queryForObject(
                        "SELECT id FROM series WHERE LOWER(name) = LOWER(?) LIMIT 1",
                        Long.class, clean
                );
            } catch (Exception e) {
                log.warn("Failed to find or create series '{}': {}", clean, e.getMessage());
                return null;
            }
        }
    }

    public Long findOrCreateAuthor(String fullName) {
        String cleaned = cleanText(fullName);
        if (cleaned.isBlank()) return null;

        String[] parts = cleaned.split("\\s+");
        String first = "";
        String last;
        if (parts.length == 1) {
            last = parts[0];
        } else {
            int idx = cleaned.indexOf(' ');
            first = cleaned.substring(0, idx).trim();
            last = cleaned.substring(idx + 1).trim();
        }

        try {
            return jdbcTemplate.queryForObject(
                    "SELECT id FROM author WHERE LOWER(firstname) = LOWER(?) AND LOWER(lastname) = LOWER(?) LIMIT 1",
                    Long.class, first, last
            );
        } catch (EmptyResultDataAccessException ignored) {}

        try {
            return jdbcTemplate.queryForObject(
                    "INSERT INTO author (firstname, lastname, created_at, updated_at) VALUES (?, ?, NOW(), NOW()) RETURNING id",
                    Long.class, first, last
            );
        } catch (Exception ex) {
            try {
                return jdbcTemplate.queryForObject(
                        "SELECT id FROM author WHERE LOWER(firstname) = LOWER(?) AND LOWER(lastname) = LOWER(?) LIMIT 1",
                        Long.class, first, last
                );
            } catch (Exception e) {
                log.warn("Failed to find or create author '{} {}': {}", first, last, e.getMessage());
                return null;
            }
        }
    }

    public void linkBookAuthor(Long bookId, Long authorId, int authorTypeId) {
        if (bookId == null || authorId == null) return;
        try {
            jdbcTemplate.update(
                    "INSERT INTO book_has_author (book_id, author_id, author_type_id, created_at, updated_at) " +
                    "VALUES (?, ?, ?, NOW(), NOW()) ON CONFLICT DO NOTHING",
                    bookId, authorId, authorTypeId
            );
        } catch (Exception ex) {
            log.warn("Failed to link book {} and author {}: {}", bookId, authorId, ex.getMessage());
        }
    }

    private static final String SELECT_BOOK_COLS =
            "SELECT id, title, isbn, COALESCE(volume, 0) as volume, COALESCE(page_count, 0) as page_count, " +
            "COALESCE(price, 0) as price, description, cover_url, " +
            "COALESCE(release_date, '1970-01-01'::timestamp) as release_date, " +
            "editor_id, series_id, collection_id, COALESCE(type, '') as type FROM book ";

    public ExistingBook findBook(String isbn, String title) {
        String cleanISBN = isbn != null ? isbn.trim() : "";
        String cleanT = cleanText(title);

        // 1. Match by normalized ISBN
        if (!cleanISBN.isBlank()) {
            String digitsOnly = RE_NON_ISBN.matcher(cleanISBN).replaceAll("");
            if (!digitsOnly.isBlank()) {
                String sql = SELECT_BOOK_COLS + "WHERE regexp_replace(isbn, '[^0-9Xx]', '', 'g') = ? AND isbn IS NOT NULL AND isbn != '' LIMIT 1";
                try {
                    return jdbcTemplate.queryForObject(sql, this::mapExistingBook, digitsOnly);
                } catch (EmptyResultDataAccessException ignored) {}
            }
        }

        // 2. Match by exact title
        if (!cleanT.isBlank()) {
            String sql = SELECT_BOOK_COLS + "WHERE LOWER(title) = LOWER(?) LIMIT 1";
            try {
                return jdbcTemplate.queryForObject(sql, this::mapExistingBook, cleanT);
            } catch (EmptyResultDataAccessException ignored) {}
        }

        // 3. Match by normalized alphanumeric title
        if (!cleanT.isBlank()) {
            String sql = SELECT_BOOK_COLS + "WHERE regexp_replace(lower(title), '[^a-z0-9]', '', 'g') = regexp_replace(lower(?), '[^a-z0-9]', '', 'g') LIMIT 1";
            try {
                return jdbcTemplate.queryForObject(sql, this::mapExistingBook, cleanT);
            } catch (EmptyResultDataAccessException ignored) {}
        }

        return null;
    }

    private ExistingBook mapExistingBook(ResultSet rs, int rowNum) throws SQLException {
        ExistingBook b = new ExistingBook();
        b.setId(rs.getLong("id"));
        b.setTitle(rs.getString("title"));
        b.setIsbn(rs.getString("isbn"));
        b.setVolume(rs.getInt("volume"));
        b.setPageCount(rs.getInt("page_count"));
        b.setPrice(rs.getInt("price"));
        b.setDescription(rs.getString("description"));
        b.setCoverUrl(rs.getString("cover_url"));
        Timestamp ts = rs.getTimestamp("release_date");
        b.setReleaseDate(ts != null ? ts.toInstant() : Instant.EPOCH);
        long ed = rs.getLong("editor_id");
        b.setEditorId(rs.wasNull() ? null : ed);
        long ser = rs.getLong("series_id");
        b.setSeriesId(rs.wasNull() ? null : ser);
        long col = rs.getLong("collection_id");
        b.setCollectionId(rs.wasNull() ? null : col);
        b.setType(rs.getString("type"));
        return b;
    }

    public boolean updateExistingBook(ExistingBook existing, BookmoryBook b, String newCoverURL,
                                      Long editorId, Long seriesId, Instant relDate, String bookType) {
        boolean needsUpdate = false;
        List<String> setClauses = new ArrayList<>();
        List<Object> args = new ArrayList<>();

        setClauses.add("updated_at = NOW()");

        // 1. Cover URL
        if (newCoverURL != null && !newCoverURL.isBlank()) {
            String currentCover = existing.getCoverUrl() != null ? existing.getCoverUrl().trim() : "";
            if (currentCover.isBlank() || !currentCover.equals(newCoverURL)) {
                setClauses.add("cover_url = ?");
                args.add(newCoverURL);
                needsUpdate = true;
            }
        }

        // 2. Description
        String backupDesc = cleanText(b.getDescription());
        if (!backupDesc.isBlank()) {
            String currentDesc = cleanText(existing.getDescription());
            if (currentDesc.isBlank() || (!currentDesc.equals(backupDesc) && backupDesc.length() > currentDesc.length())) {
                setClauses.add("description = ?");
                args.add(backupDesc);
                needsUpdate = true;
            }
        }

        // 3. Page count
        int backupPages = (int) Math.round(b.getRealTotalPage());
        if (backupPages <= 0 && b.getTotalPage() != null) {
            backupPages = (int) Math.round(b.getTotalPage());
        }
        if (backupPages > 0 && (existing.getPageCount() == null || existing.getPageCount() == 0 || !existing.getPageCount().equals(backupPages))) {
            setClauses.add("page_count = ?");
            args.add(backupPages);
            needsUpdate = true;
        }

        // 4. Volume
        int vol = parseVolume(b.getSeriesNumber(), b.getSeriesNumberDecimal(), b.getTitle());
        if (vol > 0 && (existing.getVolume() == null || existing.getVolume() == 0 || !existing.getVolume().equals(vol))) {
            setClauses.add("volume = ?");
            args.add(vol);
            needsUpdate = true;
        }

        // 5. ISBN
        String cleanISBN = b.getIsbn() != null ? b.getIsbn().trim() : "";
        if (!cleanISBN.isBlank()) {
            String currentISBN = existing.getIsbn() != null ? existing.getIsbn().trim() : "";
            if (currentISBN.isBlank()) {
                try {
                    jdbcTemplate.queryForObject("SELECT id FROM book WHERE isbn = ? AND id != ? LIMIT 1", Long.class, cleanISBN, existing.getId());
                } catch (EmptyResultDataAccessException ignored) {
                    setClauses.add("isbn = ?");
                    args.add(cleanISBN);
                    needsUpdate = true;
                }
            }
        }

        // 6. Editor
        if (editorId != null && existing.getEditorId() == null) {
            setClauses.add("editor_id = ?");
            args.add(editorId);
            needsUpdate = true;
        }

        // 7. Series
        if (seriesId != null && existing.getSeriesId() == null) {
            setClauses.add("series_id = ?");
            args.add(seriesId);
            needsUpdate = true;
        }

        // 8. Price
        int backupPrice = 0;
        if (b.getPurchases() != null && !b.getPurchases().isEmpty() && b.getPurchases().get(0).getPrice() != null && b.getPurchases().get(0).getPrice() > 0) {
            backupPrice = (int) Math.round(b.getPurchases().get(0).getPrice());
        }
        if (backupPrice > 0 && (existing.getPrice() == null || existing.getPrice() == 0 || !existing.getPrice().equals(backupPrice))) {
            setClauses.add("price = ?");
            args.add(backupPrice);
            needsUpdate = true;
        }

        // 9. Release date
        if (relDate != null && (existing.getReleaseDate() == null || existing.getReleaseDate().equals(Instant.EPOCH))) {
            setClauses.add("release_date = ?");
            args.add(Timestamp.from(relDate));
            needsUpdate = true;
        }

        // 10. Type
        if (bookType != null && !bookType.isBlank() && !bookType.equals(existing.getType())) {
            String curType = existing.getType() != null ? existing.getType() : "";
            if (curType.isBlank() || (curType.equals("Comics") && !bookType.equals("Comics")) ||
                (curType.equals("Roman") && (bookType.equals("Comics") || bookType.equals("Bande dessinée") || bookType.equals("Manga")))) {
                setClauses.add("type = ?");
                args.add(bookType);
                needsUpdate = true;
            }
        }

        if (!needsUpdate) {
            return false;
        }

        args.add(existing.getId());
        String sql = "UPDATE book SET " + String.join(", ", setClauses) + " WHERE id = ?";
        jdbcTemplate.update(sql, args.toArray());
        return true;
    }

    public Long createNewBook(BookmoryBook b, String coverURL, Long editorId, Long seriesId, Instant relDate, String bookType) {
        String cleanT = cleanText(b.getTitle());
        if (cleanT.isBlank()) {
            throw new IllegalArgumentException("Book title cannot be empty");
        }

        String cleanISBN = b.getIsbn() != null ? b.getIsbn().trim() : "";
        if (!cleanISBN.isBlank()) {
            try {
                Long existingId = jdbcTemplate.queryForObject("SELECT id FROM book WHERE isbn = ? LIMIT 1", Long.class, cleanISBN);
                if (existingId != null) {
                    log.info("[Database] ISBN {} already exists on book {}; omitting for new book '{}'", cleanISBN, existingId, cleanT);
                    cleanISBN = "";
                }
            } catch (EmptyResultDataAccessException ignored) {}
        }

        int vol = parseVolume(b.getSeriesNumber(), b.getSeriesNumberDecimal(), cleanT);
        int pages = (int) Math.round(b.getRealTotalPage());
        if (pages <= 0 && b.getTotalPage() != null) {
            pages = (int) Math.round(b.getTotalPage());
        }

        int price = 0;
        if (b.getPurchases() != null && !b.getPurchases().isEmpty() && b.getPurchases().get(0).getPrice() != null && b.getPurchases().get(0).getPrice() > 0) {
            price = (int) Math.round(b.getPurchases().get(0).getPrice());
        }

        String desc = cleanText(b.getDescription());
        String bType = (bookType != null && !bookType.isBlank()) ? bookType : "Comics";
        Timestamp releaseTimestamp = Timestamp.from(relDate != null ? relDate : Instant.now());

        String sql = "INSERT INTO book (" +
                "title, series_id, editor_id, collection_id, " +
                "volume, isbn, page_count, price, description, " +
                "cover_url, release_date, type, created_at, updated_at" +
                ") VALUES (" +
                "?, ?, ?, NULL, " +
                "?, NULLIF(?, ''), ?, ?, NULLIF(?, ''), " +
                "NULLIF(?, ''), ?, ?, NOW(), NOW()" +
                ") RETURNING id";

        try {
            return jdbcTemplate.queryForObject(
                    sql, Long.class,
                    cleanT, seriesId, editorId,
                    vol, cleanISBN, pages, price, desc,
                    coverURL, releaseTimestamp, bType
            );
        } catch (Exception ex) {
            if (ex.getMessage() != null && (ex.getMessage().contains("book_title_key") || ex.getMessage().contains("book_isbn_key"))) {
                ExistingBook existing = findBook(cleanISBN, cleanT);
                if (existing != null) {
                    updateExistingBook(existing, b, coverURL, editorId, seriesId, relDate, bType);
                    return existing.getId();
                }
            }
            throw new RuntimeException("Failed to insert book '" + cleanT + "': " + ex.getMessage(), ex);
        }
    }

    public void upsertUserOwnsBook(Long userId, Long bookId, Boolean wishlist) {
        if (userId == null || bookId == null) return;
        String status = Boolean.TRUE.equals(wishlist) ? "WISHLISTED" : "OWNED";
        try {
            jdbcTemplate.update(
                    "INSERT INTO user_owns_book (user_id, book_id, status, created_at, updated_at) " +
                    "VALUES (?, ?, ?, NOW(), NOW()) " +
                    "ON CONFLICT (user_id, book_id) DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()",
                    userId, bookId, status
            );
        } catch (Exception ex) {
            log.warn("Failed to upsert user_owns_book for user {} book {}: {}", userId, bookId, ex.getMessage());
        }
    }

    public void upsertBookStatus(Long userId, Long bookId, String status) {
        if (userId == null || bookId == null) return;
        String cleanStatus = status != null ? status.trim().toUpperCase() : "UNREAD";
        if (cleanStatus.isBlank()) cleanStatus = "UNREAD";
        try {
            jdbcTemplate.update(
                    "INSERT INTO book_status (user_id, book_id, status, created_at, updated_at) " +
                    "VALUES (?, ?, ?, NOW(), NOW()) " +
                    "ON CONFLICT (user_id, book_id) DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()",
                    userId, bookId, cleanStatus
            );
        } catch (Exception ex) {
            log.warn("Failed to upsert book_status for user {} book {}: {}", userId, bookId, ex.getMessage());
        }
    }

    public boolean importPurchase(Long userId, Long bookId, BookmoryPurchase p) {
        if (p == null || userId == null || bookId == null) return false;

        LocalDate txDate = LocalDate.now();
        if (p.getPurchasedAt() != null && p.getPurchasedAt() > 0) {
            txDate = Instant.ofEpochMilli(p.getPurchasedAt()).atZone(java.time.ZoneOffset.UTC).toLocalDate();
        } else if (p.getCreatedAt() != null && p.getCreatedAt() > 0) {
            txDate = Instant.ofEpochMilli(p.getCreatedAt()).atZone(java.time.ZoneOffset.UTC).toLocalDate();
        }

        BigDecimal price = BigDecimal.valueOf(p.getPrice() != null ? p.getPrice() : 0.0);
        String location = cleanText(p.getFrom());
        String memo = cleanText(p.getMemo());

        try {
            Integer exists = jdbcTemplate.queryForObject(
                    "SELECT 1 FROM user_book_transaction WHERE user_id = ? AND book_id = ? AND type = 'BOUGHT' " +
                    "AND transaction_date = ? AND price = ? LIMIT 1",
                    Integer.class, userId, bookId, txDate, price
            );
            if (exists != null) {
                return false;
            }
        } catch (EmptyResultDataAccessException ignored) {}

        try {
            jdbcTemplate.update(
                    "INSERT INTO user_book_transaction (user_id, book_id, type, transaction_date, price, location, memo, created_at, updated_at) " +
                    "VALUES (?, ?, 'BOUGHT', ?, ?, NULLIF(?, ''), NULLIF(?, ''), NOW(), NOW())",
                    userId, bookId, txDate, price, location, memo
            );
            return true;
        } catch (Exception ex) {
            log.warn("Failed to insert purchase for user {} book {}: {}", userId, bookId, ex.getMessage());
            return false;
        }
    }

    public boolean importReadingSession(Long userId, Long bookId, BookmoryReadTimer timer, int page) {
        if (timer == null || timer.getElapsedSec() == null || timer.getElapsedSec() <= 0 || userId == null || bookId == null) {
            return false;
        }

        int minutesRead = timer.getElapsedSec() / 60;
        int secondsRead = timer.getElapsedSec() % 60;
        Instant sessionTime = Instant.now();
        if (timer.getReadStartedAt() != null && timer.getReadStartedAt() > 0) {
            sessionTime = Instant.ofEpochMilli(timer.getReadStartedAt());
        } else if (timer.getCreatedAt() != null && timer.getCreatedAt() > 0) {
            sessionTime = Instant.ofEpochMilli(timer.getCreatedAt());
        }

        try {
            Integer exists = jdbcTemplate.queryForObject(
                    "SELECT 1 FROM reading_session WHERE user_id = ? AND book_id = ? AND created_at = ? LIMIT 1",
                    Integer.class, userId, bookId, Timestamp.from(sessionTime)
            );
            if (exists != null) {
                return false;
            }
        } catch (EmptyResultDataAccessException ignored) {}

        try {
            jdbcTemplate.update(
                    "INSERT INTO reading_session (user_id, book_id, current_page, minutes_read, seconds_read, session_type, created_at) " +
                    "VALUES (?, ?, ?, ?, ?, 1, ?)",
                    userId, bookId, page, minutesRead, secondsRead, Timestamp.from(sessionTime)
            );
            return true;
        } catch (Exception ex) {
            log.warn("Failed to insert reading session for user {} book {}: {}", userId, bookId, ex.getMessage());
            return false;
        }
    }
}
