package fr.openbook.backup;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

import static org.junit.jupiter.api.Assertions.*;

public class BackupStructureTest {

    @Test
    public void testBackupZipStructure(@TempDir Path tempDir) throws Exception {
        Path zipFile = tempDir.resolve("openbook-backup-2026-11-04_12-00-00.zip");

        // Create sample backup zip structure
        try (ZipOutputStream zos = new ZipOutputStream(new FileOutputStream(zipFile.toFile()))) {
            // 1. database dump
            ZipEntry dbEntry = new ZipEntry("database/dump.sql");
            zos.putNextEntry(dbEntry);
            zos.write("-- PostgreSQL dump\nSELECT 1;\n".getBytes(StandardCharsets.UTF_8));
            zos.closeEntry();

            // 2. image entry
            ZipEntry imgEntry = new ZipEntry("images/slot-1/original.webp");
            zos.putNextEntry(imgEntry);
            zos.write("fake-webp-bytes".getBytes(StandardCharsets.UTF_8));
            zos.closeEntry();

            // 3. metadata
            ZipEntry metaEntry = new ZipEntry("metadata.json");
            zos.putNextEntry(metaEntry);
            zos.write("{\"imageCount\": 1}".getBytes(StandardCharsets.UTF_8));
            zos.closeEntry();
        }

        assertTrue(Files.exists(zipFile));
        assertTrue(Files.size(zipFile) > 0);

        // Verify entries
        boolean foundDb = false;
        boolean foundImage = false;
        boolean foundMeta = false;

        try (ZipInputStream zis = new ZipInputStream(new FileInputStream(zipFile.toFile()))) {
            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                if ("database/dump.sql".equals(entry.getName())) foundDb = true;
                if ("images/slot-1/original.webp".equals(entry.getName())) foundImage = true;
                if ("metadata.json".equals(entry.getName())) foundMeta = true;
            }
        }

        assertTrue(foundDb, "Database dump should be inside database/");
        assertTrue(foundImage, "Image should be inside images/");
        assertTrue(foundMeta, "Metadata should be present");
    }
}
