package fr.openbook.backup.service;

import fr.openbook.backup.config.BackupProperties;
import fr.openbook.backup.model.BackupMetadata;
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
            result.add(BackupMetadata.builder()
                    .filename(f.getName())
                    .sizeBytes(f.length())
                    .createdAt(Instant.ofEpochMilli(f.lastModified()))
                    .openbookVersion("1.0")
                    .build());
        }
        return result;
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
