package fr.openbook.api.importing.parser;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fr.openbook.api.importing.model.BookmoryBook;
import fr.openbook.api.importing.model.ParsedBookmory;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.File;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

@Slf4j
@Component
public class BookmoryZipParser {

    private final ObjectMapper objectMapper;

    public BookmoryZipParser(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public ParsedBookmory parse(File file) throws Exception {
        ZipFile zipFile = new ZipFile(file);
        Path tempDir = Files.createTempDirectory("bookmory_import_");

        ParsedBookmory parsed = new ParsedBookmory();
        parsed.setZipFile(zipFile);
        parsed.setTempDir(tempDir);

        ZipEntry dbEntry = null;
        Enumeration<? extends ZipEntry> entries = zipFile.entries();
        while (entries.hasMoreElements()) {
            ZipEntry entry = entries.nextElement();
            String cleanName = entry.getName().replace('\\', '/');
            if (cleanName.startsWith("/")) {
                cleanName = cleanName.substring(1);
            }

            if (cleanName.equals("new_bookmory.db") || cleanName.endsWith("/new_bookmory.db")) {
                dbEntry = entry;
            }

            if (cleanName.startsWith("images/books/") || cleanName.startsWith("bookmory_data/images/books/")) {
                String base = new File(cleanName).getName();
                parsed.getZipImages().put(base, entry);
            }
        }

        if (dbEntry == null) {
            parsed.close();
            throw new IllegalArgumentException("new_bookmory.db non trouvé dans l'archive");
        }

        Path sqlitePath = tempDir.resolve("new_bookmory.db");
        try (InputStream in = zipFile.getInputStream(dbEntry)) {
            Files.copy(in, sqlitePath, StandardCopyOption.REPLACE_EXISTING);
        }

        String jdbcUrl = "jdbc:sqlite:" + sqlitePath.toAbsolutePath();
        try (Connection conn = DriverManager.getConnection(jdbcUrl)) {
            parsed.setSeries(readStoreMap(conn, "series"));
            parsed.setPublishers(readStoreMap(conn, "publishers"));
            parsed.setCollections(readStoreMap(conn, "collections"));
            parsed.setAuthors(readStoreMap(conn, "authors"));
            parsed.setIllustrators(readStoreMap(conn, "illustrators"));

            readTags(conn, parsed);
            readBooks(conn, parsed);
        }

        log.info("[Bookmory] Parsed {} books, {} series, {} publishers, {} collections, {} tags, {} images from archive",
                parsed.getBooks().size(), parsed.getSeries().size(), parsed.getPublishers().size(),
                parsed.getCollections().size(), parsed.getTags().size(), parsed.getZipImages().size());

        return parsed;
    }

    private Map<String, String> readStoreMap(Connection conn, String storeName) {
        Map<String, String> result = new HashMap<>();
        String sql = "SELECT key, value FROM entry WHERE store = ? AND (deleted IS NULL OR deleted = 0)";
        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, storeName);
            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    String key = rs.getString("key");
                    String value = rs.getString("value");
                    if (value != null && !value.isBlank()) {
                        try {
                            JsonNode node = objectMapper.readTree(value);
                            if (node.hasNonNull("name")) {
                                result.put(key, node.get("name").asText().trim());
                            }
                        } catch (Exception ex) {
                            log.debug("Failed to parse store {} item {}: {}", storeName, key, ex.getMessage());
                        }
                    }
                }
            }
        } catch (Exception ex) {
            log.warn("Error reading store {}: {}", storeName, ex.getMessage());
        }
        return result;
    }

    private void readTags(Connection conn, ParsedBookmory parsed) {
        String sql = "SELECT key, value FROM entry WHERE store = 'tags' AND (deleted IS NULL OR deleted = 0)";
        try (PreparedStatement stmt = conn.prepareStatement(sql);
             ResultSet rs = stmt.executeQuery()) {
            while (rs.next()) {
                String key = rs.getString("key");
                String value = rs.getString("value");
                if (value != null && !value.isBlank()) {
                    try {
                        JsonNode node = objectMapper.readTree(value);
                        if (node.hasNonNull("name")) {
                            String tagName = node.get("name").asText().trim();
                            parsed.getTags().put(key, tagName);

                            if (node.has("bids") && node.get("bids").isArray()) {
                                for (JsonNode bidNode : node.get("bids")) {
                                    String bid = bidNode.asText();
                                    parsed.getBookTags().computeIfAbsent(bid, k -> new ArrayList<>()).add(tagName);
                                }
                            }
                        }
                    } catch (Exception ex) {
                        log.debug("Failed to parse tag item {}: {}", key, ex.getMessage());
                    }
                }
            }
        } catch (Exception ex) {
            log.warn("Error reading tags: {}", ex.getMessage());
        }
    }

    private void readBooks(Connection conn, ParsedBookmory parsed) throws Exception {
        String sql = "SELECT key, value FROM entry WHERE store = 'books' AND (deleted IS NULL OR deleted = 0)";
        try (PreparedStatement stmt = conn.prepareStatement(sql);
             ResultSet rs = stmt.executeQuery()) {
            while (rs.next()) {
                String key = rs.getString("key");
                String value = rs.getString("value");
                if (value != null && !value.isBlank()) {
                    try {
                        BookmoryBook book = objectMapper.readValue(value, BookmoryBook.class);
                        book.setKey(key);
                        parsed.getBooks().add(book);
                    } catch (Exception ex) {
                        log.warn("[Bookmory] Failed to unmarshal book {}: {}", key, ex.getMessage());
                    }
                }
            }
        }
    }
}
