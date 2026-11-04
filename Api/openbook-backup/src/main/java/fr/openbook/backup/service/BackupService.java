package fr.openbook.backup.service;

import fr.openbook.backup.config.BackupProperties;
import fr.openbook.backup.model.BackupMetadata;
import fr.openbook.backup.model.RestoreResult;
import fr.openbook.media.config.MediaProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.attribute.BasicFileAttributes;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import lombok.Setter;

@Slf4j
@Service
@RequiredArgsConstructor
public class BackupService {

    @Setter
    private String datasourceUrlOverride;

    @Setter
    private String datasourceUserOverride;

    @Setter
    private String datasourcePasswordOverride;

    private static final DateTimeFormatter FILE_DATE_FORMAT = DateTimeFormatter
            .ofPattern("yyyy-MM-dd_HH-mm-ss")
            .withZone(ZoneId.of("UTC"));

    private final BackupProperties backupProperties;
    private final MediaProperties mediaProperties;

    @Value("${spring.datasource.url:jdbc:postgresql://postgres:5432/openbook}")
    private String datasourceUrl;

    @Value("${spring.datasource.username:openbook}")
    private String datasourceUser;

    @Value("${spring.datasource.password:openbook}")
    private String datasourcePassword;

    /**
     * Creates a dated backup zip containing the database dump and all media images.
     * File name format: openbook-backup-yyyy-MM-dd_HH-mm-ss.zip
     *
     * @return the created BackupMetadata
     * @throws IOException on failure
     */
    public synchronized BackupMetadata createBackup() throws IOException {
        Instant now = Instant.now();
        String timestamp = FILE_DATE_FORMAT.format(now);
        String zipFilename = "openbook-backup-" + timestamp + ".zip";

        Path backupDir = Paths.get(backupProperties.getDirectory());
        Files.createDirectories(backupDir);
        Path targetZip = backupDir.resolve(zipFilename);
        Path tempZip = backupDir.resolve(zipFilename + ".tmp");

        log.info("[Backup] Starting backup creation: {}", zipFilename);

        Path tempSql = Files.createTempFile("openbook-db-dump-", ".sql");
        try {
            // 1. Export database to temp SQL
            long dbSizeBytes = dumpDatabase(tempSql);
            log.info("[Backup] Database dump completed: {} bytes", dbSizeBytes);

            // 2. Package database dump and media images into ZIP
            AtomicInteger imageCount = new AtomicInteger(0);
            try (FileOutputStream fos = new FileOutputStream(tempZip.toFile());
                 BufferedOutputStream bos = new BufferedOutputStream(fos);
                 ZipOutputStream zos = new ZipOutputStream(bos)) {

                // Add database dump
                ZipEntry dbEntry = new ZipEntry("database/dump.sql");
                dbEntry.setTime(now.toEpochMilli());
                zos.putNextEntry(dbEntry);
                try (InputStream fis = new BufferedInputStream(new FileInputStream(tempSql.toFile()))) {
                    fis.transferTo(zos);
                }
                zos.closeEntry();

                // Add media images
                Path mediaDir = Paths.get(mediaProperties.getDataDir());
                if (Files.exists(mediaDir)) {
                    Files.walkFileTree(mediaDir, new SimpleFileVisitor<Path>() {
                        @Override
                        public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                            String relPath = mediaDir.relativize(file).toString().replace('\\', '/');
                            ZipEntry imageEntry = new ZipEntry("images/" + relPath);
                            imageEntry.setTime(attrs.lastModifiedTime().toMillis());
                            zos.putNextEntry(imageEntry);
                            try (InputStream fis = new BufferedInputStream(new FileInputStream(file.toFile()))) {
                                fis.transferTo(zos);
                            }
                            zos.closeEntry();
                            imageCount.incrementAndGet();
                            return FileVisitResult.CONTINUE;
                        }
                    });
                } else {
                    log.warn("[Backup] Media directory does not exist: {}", mediaDir);
                }

                // Add metadata.json inside the zip
                String metaJson = String.format(
                        "{\n  \"timestamp\": \"%s\",\n  \"databaseSizeBytes\": %d,\n  \"imageCount\": %d,\n  \"version\": \"1.0\"\n}\n",
                        now.toString(), dbSizeBytes, imageCount.get()
                );
                ZipEntry metaEntry = new ZipEntry("metadata.json");
                metaEntry.setTime(now.toEpochMilli());
                zos.putNextEntry(metaEntry);
                zos.write(metaJson.getBytes(StandardCharsets.UTF_8));
                zos.closeEntry();
            }

            // Atomic rename to final zip file
            Files.move(tempZip, targetZip);

            long totalSizeBytes = Files.size(targetZip);
            log.info("[Backup] Successfully created {} ({} bytes, {} images)", zipFilename, totalSizeBytes, imageCount.get());

            // 3. Apply retention policy if enabled
            enforceRetention(backupDir);

            return BackupMetadata.builder()
                    .filename(zipFilename)
                    .sizeBytes(totalSizeBytes)
                    .createdAt(now)
                    .imageCount(imageCount.get())
                    .databaseSizeBytes(dbSizeBytes)
                    .openbookVersion("1.0")
                    .build();

        } finally {
            try {
                Files.deleteIfExists(tempSql);
            } catch (Exception ignored) {}
            try {
                Files.deleteIfExists(tempZip);
            } catch (Exception ignored) {}
        }
    }

    /**
     * Dumps the PostgreSQL database to the destination path using pg_dump.
     */
    private long dumpDatabase(Path destinationSql) throws IOException {
        String activeUrl = datasourceUrlOverride != null ? datasourceUrlOverride : (datasourceUrl != null ? datasourceUrl : "jdbc:postgresql://postgres:5432/openbook");
        String activeUser = datasourceUserOverride != null ? datasourceUserOverride : (datasourceUser != null ? datasourceUser : "openbook");
        String activePassword = datasourcePasswordOverride != null ? datasourcePasswordOverride : (datasourcePassword != null ? datasourcePassword : "openbook");

        String host = "postgres";
        String port = "5432";
        String dbName = "openbook";

        try {
            String cleanUrl = activeUrl.replace("jdbc:postgresql://", "");
            int slashIdx = cleanUrl.indexOf('/');
            if (slashIdx > 0) {
                String hostPort = cleanUrl.substring(0, slashIdx);
                dbName = cleanUrl.substring(slashIdx + 1);
                int qIdx = dbName.indexOf('?');
                if (qIdx > 0) {
                    dbName = dbName.substring(0, qIdx);
                }
                int colonIdx = hostPort.indexOf(':');
                if (colonIdx > 0) {
                    host = hostPort.substring(0, colonIdx);
                    port = hostPort.substring(colonIdx + 1);
                } else {
                    host = hostPort;
                }
            }
        } catch (Exception ex) {
            log.warn("[Backup] Could not parse datasourceUrl '{}', using defaults: {}", datasourceUrl, ex.getMessage());
        }

        List<String> cmd = new ArrayList<>(Arrays.asList(
                "pg_dump",
                "-h", host,
                "-p", port,
                "-U", activeUser,
                "-d", dbName,
                "--clean",
                "--if-exists",
                "--no-owner",
                "--no-privileges"
        ));

        ProcessBuilder pb = new ProcessBuilder(cmd);
        pb.environment().put("PGPASSWORD", activePassword);
        pb.redirectOutput(destinationSql.toFile());

        Process process = pb.start();
        ByteArrayOutputStream errBaos = new ByteArrayOutputStream();

        Thread errReader = new Thread(() -> {
            try (InputStream is = process.getErrorStream()) {
                is.transferTo(errBaos);
            } catch (Exception ignored) {}
        });
        errReader.start();

        try {
            boolean finished = process.waitFor(120, TimeUnit.SECONDS);
            errReader.join(2000);
            if (!finished) {
                process.destroyForcibly();
                throw new IOException("pg_dump process timed out after 120s");
            }

            int exitCode = process.exitValue();
            if (exitCode != 0) {
                String errOutput = errBaos.toString(StandardCharsets.UTF_8);
                throw new IOException("pg_dump failed with exit code " + exitCode + ": " + errOutput);
            }

            return Files.size(destinationSql);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("Database dump interrupted: " + e.getMessage(), e);
        }
    }

    /**
     * Lists existing backup files in the backup directory, sorted by newest first.
     */
    public List<BackupMetadata> listBackups() {
        Path backupDir = Paths.get(backupProperties.getDirectory());
        if (!Files.exists(backupDir)) {
            return List.of();
        }

        File[] files = backupDir.toFile().listFiles((dir, name) -> name.startsWith("openbook-backup-") && name.endsWith(".zip"));
        if (files == null || files.length == 0) {
            return List.of();
        }

        Arrays.sort(files, Comparator.comparingLong(File::lastModified).reversed());

        List<BackupMetadata> result = new ArrayList<>();
        for (File f : files) {
            BackupMetadata meta = readMetadataFromZip(f);
            if (meta == null) {
                meta = BackupMetadata.builder()
                        .filename(f.getName())
                        .sizeBytes(f.length())
                        .createdAt(Instant.ofEpochMilli(f.lastModified()))
                        .openbookVersion("1.0")
                        .build();
            }
            result.add(meta);
        }
        return result;
    }

    private BackupMetadata readMetadataFromZip(File zipFile) {
        try (java.util.zip.ZipFile zf = new java.util.zip.ZipFile(zipFile)) {
            ZipEntry entry = zf.getEntry("metadata.json");
            if (entry != null) {
                try (InputStream is = zf.getInputStream(entry)) {
                    String json = new String(is.readAllBytes(), StandardCharsets.UTF_8);
                    long dbSize = extractJsonLong(json, "databaseSizeBytes");
                    int images = (int) extractJsonLong(json, "imageCount");
                    String timestampStr = extractJsonString(json, "timestamp");
                    Instant created = timestampStr != null ? Instant.parse(timestampStr) : Instant.ofEpochMilli(zipFile.lastModified());
                    return BackupMetadata.builder()
                            .filename(zipFile.getName())
                            .sizeBytes(zipFile.length())
                            .createdAt(created)
                            .imageCount(images)
                            .databaseSizeBytes(dbSize)
                            .openbookVersion("1.0")
                            .build();
                }
            }
        } catch (Exception e) {
            log.debug("[Backup] Could not read metadata.json from {}: {}", zipFile.getName(), e.getMessage());
        }
        return null;
    }

    private long extractJsonLong(String json, String field) {
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("\"" + field + "\"\\s*:\\s*([0-9]+)").matcher(json);
        if (m.find()) {
            try {
                return Long.parseLong(m.group(1));
            } catch (NumberFormatException ignored) {}
        }
        return 0;
    }

    private String extractJsonString(String json, String field) {
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("\"" + field + "\"\\s*:\\s*\"([^\"]+)\"").matcher(json);
        if (m.find()) {
            return m.group(1);
        }
        return null;
    }

    /**
     * Retrieves the file path of a backup by filename.
     */
    public Path getBackupPath(String filename) {
        if (filename == null || filename.contains("..") || filename.contains("/") || filename.contains("\\")) {
            throw new IllegalArgumentException("Invalid backup filename");
        }
        Path p = Paths.get(backupProperties.getDirectory()).resolve(filename);
        if (!Files.exists(p)) {
            throw new IllegalArgumentException("Backup file not found: " + filename);
        }
        return p;
    }

    /**
     * Deletes a backup by filename.
     */
    public boolean deleteBackup(String filename) {
        Path p = getBackupPath(filename);
        try {
            return Files.deleteIfExists(p);
        } catch (IOException e) {
            log.error("[Backup] Failed to delete backup file {}: {}", filename, e.getMessage());
            return false;
        }
    }

    /**
     * Restores database and media images from a backup zip archive.
     */
    public RestoreResult restoreBackup(String filename) throws IOException {
        Path backupFile = getBackupPath(filename);
        log.info("[Restore] Starting restore from backup archive: {}", filename);
        long startTime = System.currentTimeMillis();

        Path tempDir = Files.createTempDirectory("openbook-restore-");
        try {
            // 1. Unzip archive into temp directory
            int extractedImages = 0;
            Path dumpSqlPath = null;

            try (java.util.zip.ZipFile zf = new java.util.zip.ZipFile(backupFile.toFile())) {
                var entries = zf.entries();
                while (entries.hasMoreElements()) {
                    ZipEntry entry = entries.nextElement();
                    String name = entry.getName();

                    // Security: prevent path traversal
                    if (name.contains("..")) {
                        continue;
                    }

                    Path destPath = tempDir.resolve(name).normalize();
                    if (!destPath.startsWith(tempDir)) {
                        continue;
                    }

                    if (entry.isDirectory()) {
                        Files.createDirectories(destPath);
                    } else {
                        Files.createDirectories(destPath.getParent());
                        try (InputStream is = zf.getInputStream(entry);
                             OutputStream os = new BufferedOutputStream(new FileOutputStream(destPath.toFile()))) {
                            is.transferTo(os);
                        }

                        if ("database/dump.sql".equals(name) || name.endsWith("dump.sql")) {
                            dumpSqlPath = destPath;
                        } else if (name.startsWith("images/")) {
                            extractedImages++;
                        }
                    }
                }
            }

            if (dumpSqlPath == null || !Files.exists(dumpSqlPath)) {
                throw new IOException("Invalid backup archive: missing 'database/dump.sql'");
            }

            long dbSize = Files.size(dumpSqlPath);
            log.info("[Restore] Archive unpacked. Dump size: {} bytes, extracted images files: {}", dbSize, extractedImages);

            // 2. Restore PostgreSQL database using psql
            restoreDatabase(dumpSqlPath);
            log.info("[Restore] Database restored successfully");

            // 3. Restore media images to MediaProperties data directory
            Path mediaDestDir = Paths.get(mediaProperties.getDataDir());
            Path extractedImagesDir = tempDir.resolve("images");
            int restoredImagesCount = 0;

            if (Files.exists(extractedImagesDir)) {
                Files.createDirectories(mediaDestDir);
                restoredImagesCount = copyDirectoryRecursively(extractedImagesDir, mediaDestDir);
                log.info("[Restore] Copied {} media files to {}", restoredImagesCount, mediaDestDir);
            }

            long duration = System.currentTimeMillis() - startTime;
            log.info("[Restore] Completed successfully in {} ms", duration);

            return RestoreResult.builder()
                    .filename(filename)
                    .success(true)
                    .message("Backup restored successfully")
                    .restoredAt(Instant.now())
                    .restoredImagesCount(restoredImagesCount)
                    .databaseSizeBytes(dbSize)
                    .durationMs(duration)
                    .build();

        } finally {
            deleteRecursively(tempDir);
        }
    }

    /**
     * Executes psql to restore the database from dump.sql.
     */
    private void restoreDatabase(Path sqlFile) throws IOException {
        String activeUrl = datasourceUrlOverride != null ? datasourceUrlOverride : datasourceUrl;
        String activeUser = datasourceUserOverride != null ? datasourceUserOverride : datasourceUser;
        String activePassword = datasourcePasswordOverride != null ? datasourcePasswordOverride : datasourcePassword;

        String host = "postgres";
        String port = "5432";
        String dbName = "openbook";

        try {
            if (activeUrl != null && activeUrl.startsWith("jdbc:postgresql://")) {
                String clean = activeUrl.substring("jdbc:postgresql://".length());
                int slashIdx = clean.indexOf('/');
                if (slashIdx > 0) {
                    String hostPort = clean.substring(0, slashIdx);
                    dbName = clean.substring(slashIdx + 1);
                    int questionIdx = dbName.indexOf('?');
                    if (questionIdx > 0) {
                        dbName = dbName.substring(0, questionIdx);
                    }
                    if (hostPort.contains(":")) {
                        String[] parts = hostPort.split(":", 2);
                        host = parts[0];
                        port = parts[1];
                    } else {
                        host = hostPort;
                    }
                }
            }
        } catch (Exception ex) {
            log.warn("[Restore] Could not parse datasourceUrl '{}', using defaults: {}", activeUrl, ex.getMessage());
        }

        List<String> cmd = new ArrayList<>(Arrays.asList(
                "psql",
                "-h", host,
                "-p", port,
                "-U", activeUser,
                "-d", dbName,
                "-f", sqlFile.toAbsolutePath().toString(),
                "-q"
        ));

        ProcessBuilder pb = new ProcessBuilder(cmd);
        pb.environment().put("PGPASSWORD", activePassword != null ? activePassword : "");

        Process process = pb.start();
        ByteArrayOutputStream errBaos = new ByteArrayOutputStream();

        Thread errReader = new Thread(() -> {
            try (InputStream is = process.getErrorStream()) {
                is.transferTo(errBaos);
            } catch (Exception ignored) {}
        });
        errReader.start();

        try {
            boolean finished = process.waitFor(180, TimeUnit.SECONDS);
            errReader.join(2000);
            if (!finished) {
                process.destroyForcibly();
                throw new IOException("psql restore timed out after 180s");
            }

            int exitCode = process.exitValue();
            if (exitCode != 0) {
                String errOutput = errBaos.toString(StandardCharsets.UTF_8);
                throw new IOException("psql restore failed with exit code " + exitCode + ": " + errOutput);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("Database restore was interrupted: " + e.getMessage(), e);
        }
    }

    private int copyDirectoryRecursively(Path source, Path target) throws IOException {
        AtomicInteger count = new AtomicInteger();
        Files.walkFileTree(source, new SimpleFileVisitor<>() {
            @Override
            public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) throws IOException {
                Path relative = source.relativize(dir);
                Path destDir = target.resolve(relative);
                Files.createDirectories(destDir);
                return FileVisitResult.CONTINUE;
            }

            @Override
            public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                Path relative = source.relativize(file);
                Path destFile = target.resolve(relative);
                Files.copy(file, destFile, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                count.incrementAndGet();
                return FileVisitResult.CONTINUE;
            }
        });
        return count.get();
    }

    private void deleteRecursively(Path root) {
        if (root == null || !Files.exists(root)) {
            return;
        }
        try {
            Files.walkFileTree(root, new SimpleFileVisitor<>() {
                @Override
                public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                    Files.deleteIfExists(file);
                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult postVisitDirectory(Path dir, IOException exc) throws IOException {
                    Files.deleteIfExists(dir);
                    return FileVisitResult.CONTINUE;
                }
            });
        } catch (IOException e) {
            log.warn("[Backup] Could not clean temp directory {}: {}", root, e.getMessage());
        }
    }

    /**
     * Enforces retention count on backup directory.
     */
    private void enforceRetention(Path backupDir) {
        int maxKeep = backupProperties.getRetentionCount();
        if (maxKeep <= 0) {
            return;
        }

        File[] files = backupDir.toFile().listFiles((dir, name) -> name.startsWith("openbook-backup-") && name.endsWith(".zip"));
        if (files == null || files.length <= maxKeep) {
            return;
        }

        Arrays.sort(files, Comparator.comparingLong(File::lastModified).reversed());
        for (int i = maxKeep; i < files.length; i++) {
            File toDelete = files[i];
            log.info("[Backup] Retention policy deleting old backup: {}", toDelete.getName());
            if (!toDelete.delete()) {
                log.warn("[Backup] Could not delete old backup: {}", toDelete.getAbsolutePath());
            }
        }
    }
}
