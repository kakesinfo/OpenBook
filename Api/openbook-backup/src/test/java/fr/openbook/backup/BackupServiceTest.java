package fr.openbook.backup;

import fr.openbook.backup.config.BackupProperties;
import fr.openbook.backup.model.BackupMetadata;
import fr.openbook.backup.service.BackupService;
import fr.openbook.media.config.MediaProperties;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.FileInputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import static org.junit.jupiter.api.Assertions.*;

public class BackupServiceTest {

    @Test
    public void testCreateBackupWithLivePostgres(@TempDir Path tempDir) throws Exception {
        BackupProperties backupProps = new BackupProperties();
        Path backupDir = tempDir.resolve("backups");
        backupProps.setDirectory(backupDir.toString());
        backupProps.setRetentionCount(3);

        MediaProperties mediaProps = new MediaProperties();
        Path mediaDir = tempDir.resolve("media");
        Files.createDirectories(mediaDir);
        // create a dummy image slot
        Path slot = mediaDir.resolve("test-slot");
        Files.createDirectories(slot);
        Files.writeString(slot.resolve("original.webp"), "fake-image-bytes");
        mediaProps.setDataDir(mediaDir.toString());

        BackupService service = new BackupService(backupProps, mediaProps);
        service.setDatasourceUrlOverride("jdbc:postgresql://postgres:5432/openbook");
        service.setDatasourceUserOverride("openbook");
        service.setDatasourcePasswordOverride("openbook");

        // Check listBackups empty initially
        List<BackupMetadata> initial = service.listBackups();
        assertTrue(initial.isEmpty());

        // Perform live backup
        BackupMetadata meta = service.createBackup();
        assertNotNull(meta);
        assertNotNull(meta.getFilename());
        assertTrue(meta.getFilename().startsWith("openbook-backup-"));
        assertTrue(meta.getFilename().endsWith(".zip"));
        assertTrue(meta.getSizeBytes() > 0);
        assertTrue(meta.getDatabaseSizeBytes() > 0);
        assertEquals(1, meta.getImageCount());

        // Verify zip contains database/dump.sql, images/test-slot/original.webp, and metadata.json
        Path createdZip = backupDir.resolve(meta.getFilename());
        assertTrue(Files.exists(createdZip));

        boolean foundDb = false;
        boolean foundImg = false;
        boolean foundMeta = false;

        try (ZipInputStream zis = new ZipInputStream(new FileInputStream(createdZip.toFile()))) {
            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                if ("database/dump.sql".equals(entry.getName())) foundDb = true;
                if ("images/test-slot/original.webp".equals(entry.getName())) foundImg = true;
                if ("metadata.json".equals(entry.getName())) foundMeta = true;
            }
        }

        assertTrue(foundDb, "Zip should contain database/dump.sql");
        assertTrue(foundImg, "Zip should contain images/test-slot/original.webp");
        assertTrue(foundMeta, "Zip should contain metadata.json");

        // List backups
        List<BackupMetadata> list = service.listBackups();
        assertEquals(1, list.size());
        assertEquals(meta.getFilename(), list.get(0).getFilename());

        // Delete backup
        boolean deleted = service.deleteBackup(meta.getFilename());
        assertTrue(deleted);
        assertFalse(Files.exists(createdZip));
        assertTrue(service.listBackups().isEmpty());
    }
}
