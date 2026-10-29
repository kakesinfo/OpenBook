package fr.openbook.api.importing;

import com.fasterxml.jackson.databind.ObjectMapper;
import fr.openbook.api.importing.model.BookmoryBook;
import fr.openbook.api.importing.model.ParsedBookmory;
import fr.openbook.api.importing.parser.BookmoryZipParser;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.junit.jupiter.api.Assertions.*;

public class BookmoryImportTest {

    @Test
    public void testParseBookmoryZip() throws Exception {
        ObjectMapper objectMapper = new ObjectMapper();
        BookmoryZipParser parser = new BookmoryZipParser(objectMapper);

        // 1. Create a temporary SQLite database
        File tempDb = File.createTempFile("test_bookmory_", ".db");
        tempDb.deleteOnExit();

        try (Connection conn = DriverManager.getConnection("jdbc:sqlite:" + tempDb.getAbsolutePath());
             Statement stmt = conn.createStatement()) {
            stmt.execute("CREATE TABLE entry (store TEXT, key TEXT, value TEXT, deleted INTEGER)");

            // Series
            stmt.execute("INSERT INTO entry VALUES ('series', 'ser_1', '{\"name\": \"Batman\"}', 0)");

            // Publisher
            stmt.execute("INSERT INTO entry VALUES ('publishers', 'pub_1', '{\"name\": \"Urban Comics\"}', 0)");

            // Tags
            stmt.execute("INSERT INTO entry VALUES ('tags', 'tag_1', '{\"name\": \"superheros\", \"bids\": [\"book_1\"]}', 0)");

            // Book
            String bookJson = "{" +
                    "\"title\": \"Batman: The Killing Joke\"," +
                    "\"author\": \"Alan Moore\"," +
                    "\"authors\": [\"Alan Moore\"]," +
                    "\"illustrators\": [\"Brian Bolland\"]," +
                    "\"publisher\": \"Urban Comics\"," +
                    "\"isbn\": \"9782365772143\"," +
                    "\"publication_date\": \"2014-03-21\"," +
                    "\"description\": \"Une folie partagée.\"," +
                    "\"series_key\": \"ser_1\"," +
                    "\"series_number\": 1," +
                    "\"real_total_page\": 64," +
                    "\"cur_page\": 64," +
                    "\"image\": \"images/books/batman.jpg\"," +
                    "\"status_list\": [\"DONE\"]," +
                    "\"purchases\": [{\"from\": \"Fnac\", \"price\": 15.50}]," +
                    "\"reads\": [{\"nth\": 1, \"status\": \"DONE\", \"page\": 64, \"read_timer_list\": [{\"elapsed_sec\": 1800}]}]" +
                    "}";
            stmt.execute("INSERT INTO entry VALUES ('books', 'book_1', '" + bookJson.replace("'", "''") + "', 0)");
        }

        // 2. Package database and image into a ZIP file (.bookmory)
        File tempZip = File.createTempFile("test_backup_", ".bookmory");
        tempZip.deleteOnExit();

        try (ZipOutputStream zos = new ZipOutputStream(new FileOutputStream(tempZip))) {
            // Add new_bookmory.db
            ZipEntry dbEntry = new ZipEntry("new_bookmory.db");
            zos.putNextEntry(dbEntry);
            Files.copy(tempDb.toPath(), zos);
            zos.closeEntry();

            // Add images/books/batman.jpg
            ZipEntry imgEntry = new ZipEntry("images/books/batman.jpg");
            zos.putNextEntry(imgEntry);
            zos.write("fake-jpeg-bytes".getBytes(StandardCharsets.UTF_8));
            zos.closeEntry();
        }

        // 3. Parse with BookmoryZipParser
        try (ParsedBookmory parsed = parser.parse(tempZip)) {
            assertNotNull(parsed);
            assertEquals(1, parsed.getBooks().size());
            assertEquals("Batman", parsed.getSeries().get("ser_1"));
            assertEquals("Urban Comics", parsed.getPublishers().get("pub_1"));
            assertEquals("superheros", parsed.getTags().get("tag_1"));
            assertTrue(parsed.getBookTags().containsKey("book_1"));
            assertTrue(parsed.getBookTags().get("book_1").contains("superheros"));
            assertTrue(parsed.getZipImages().containsKey("batman.jpg"));

            BookmoryBook book = parsed.getBooks().get(0);
            assertEquals("book_1", book.getKey());
            assertEquals("Batman: The Killing Joke", book.getTitle());
            assertEquals("Alan Moore", book.getAuthor());
            assertEquals("9782365772143", book.getIsbn());
            assertEquals(64.0, book.getRealTotalPage());
            assertEquals(1, book.getPurchases().size());
            assertEquals(15.50, book.getPurchases().get(0).getPrice());
            assertEquals(1, book.getReads().size());
            assertEquals(1, book.getReads().get(0).getReadTimerList().size());
            assertEquals(1800, book.getReads().get(0).getReadTimerList().get(0).getElapsedSec());
        }
    }
}
