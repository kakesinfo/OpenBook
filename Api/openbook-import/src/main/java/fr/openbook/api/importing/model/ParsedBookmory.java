package fr.openbook.api.importing.model;

import lombok.Data;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

@Data
public class ParsedBookmory implements AutoCloseable {
    private List<BookmoryBook> books = new ArrayList<>();
    private Map<String, String> series = new HashMap<>();        // key -> name
    private Map<String, String> publishers = new HashMap<>();    // key -> name
    private Map<String, String> collections = new HashMap<>();   // key -> name
    private Map<String, String> authors = new HashMap<>();       // key -> name
    private Map<String, String> illustrators = new HashMap<>();  // key -> name
    private Map<String, String> tags = new HashMap<>();          // key -> name
    private Map<String, List<String>> bookTags = new HashMap<>();// book key -> list of tag names
    private List<BookmoryNote> notes = new ArrayList<>();
    private Map<String, List<BookmoryNote>> bookNotes = new HashMap<>(); // book key (bid) -> list of notes
    private Map<String, ZipEntry> zipImages = new HashMap<>();   // basename -> zip entry

    private Path tempDir;
    private ZipFile zipFile;

    @Override
    public void close() {
        if (zipFile != null) {
            try {
                zipFile.close();
            } catch (IOException ignored) {}
        }
        if (tempDir != null) {
            try {
                Files.walk(tempDir)
                        .sorted(Comparator.reverseOrder())
                        .map(Path::toFile)
                        .forEach(File::delete);
            } catch (Exception ignored) {}
        }
    }
}
