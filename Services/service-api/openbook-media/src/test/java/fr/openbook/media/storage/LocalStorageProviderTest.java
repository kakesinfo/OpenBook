package fr.openbook.media.storage;

import fr.openbook.media.config.MediaProperties;
import fr.openbook.media.model.ImageMetadataDto;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Path;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class LocalStorageProviderTest {

    @TempDir
    Path tempDir;

    private LocalStorageProvider storageProvider;

    @BeforeEach
    void setUp() {
        MediaProperties props = new MediaProperties();
        props.setStorageType("local");
        props.setDataDir(tempDir.toString());

        storageProvider = new LocalStorageProvider(props);
        storageProvider.init();
    }

    @Test
    void testCreateSlotAndMetadata() throws IOException {
        String id = "test-uuid-1234";
        ImageMetadataDto slot = storageProvider.createSlot(id);

        assertNotNull(slot);
        assertEquals(id, slot.getId());
        assertEquals("pending", slot.getStatus());

        Optional<ImageMetadataDto> fetched = storageProvider.getMetadata(id);
        assertTrue(fetched.isPresent());
        assertEquals("pending", fetched.get().getStatus());
    }

    @Test
    void testSaveMasterImageAndVariants() throws IOException {
        String id = "test-uuid-5678";
        storageProvider.createSlot(id);

        byte[] masterBytes = new byte[]{1, 2, 3, 4, 5};
        ImageMetadataDto meta = storageProvider.saveMasterImage(id, masterBytes, 640, 480, "test.png");

        assertEquals("ready", meta.getStatus());
        assertEquals(640, meta.getWidth());
        assertEquals(480, meta.getHeight());
        assertEquals(5, meta.getSize());

        Optional<byte[]> retrievedMaster = storageProvider.getMasterImageBytes(id);
        assertTrue(retrievedMaster.isPresent());
        assertArrayEquals(masterBytes, retrievedMaster.get());

        // Save variant
        byte[] variantBytes = new byte[]{9, 8, 7};
        storageProvider.saveVariantImage(id, 160, 120, variantBytes);

        Optional<byte[]> retrievedVariant = storageProvider.getVariantImageBytes(id, 160, 120);
        assertTrue(retrievedVariant.isPresent());
        assertArrayEquals(variantBytes, retrievedVariant.get());

        // Saving master again must invalidate variants
        storageProvider.saveMasterImage(id, masterBytes, 640, 480, "test.png");
        Optional<byte[]> invalidatedVariant = storageProvider.getVariantImageBytes(id, 160, 120);
        assertTrue(invalidatedVariant.isEmpty(), "Variant should be invalidated after master re-save");

        // Delete image
        storageProvider.deleteImage(id);
        assertTrue(storageProvider.getMasterImageBytes(id).isEmpty());
        assertTrue(storageProvider.getMetadata(id).isEmpty());
    }
}
