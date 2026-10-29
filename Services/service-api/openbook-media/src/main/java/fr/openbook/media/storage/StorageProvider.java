package fr.openbook.media.storage;

import fr.openbook.media.model.ImageMetadataDto;

import java.io.IOException;
import java.util.Optional;

/**
 * Storage abstraction for OpenBook Media files (master images, variants, and metadata).
 * Implementations provide backing storage via local disk, S3 / MinIO, etc.
 */
public interface StorageProvider {

    /**
     * Initializes a storage slot for the given image ID with a pending metadata record.
     *
     * @param id The image UUID string
     * @return Initial ImageMetadataDto with status "pending"
     * @throws IOException If storage slot initialization fails
     */
    ImageMetadataDto createSlot(String id) throws IOException;

    /**
     * Retrieves the metadata for the given image ID.
     *
     * @param id The image UUID string
     * @return Optional containing the metadata if found, or empty
     */
    Optional<ImageMetadataDto> getMetadata(String id);

    /**
     * Persists or updates metadata for the given image.
     *
     * @param meta The metadata DTO to save
     * @throws IOException If saving metadata fails
     */
    void saveMetadata(ImageMetadataDto meta) throws IOException;

    /**
     * Saves the master image data, invalidates any existing cached variants,
     * and updates the metadata record to status "ready".
     *
     * @param id           The image UUID string
     * @param data         Raw WebP bytes of the master image
     * @param width        Width of the master image in pixels
     * @param height       Height of the master image in pixels
     * @param originalName Original source or filename
     * @return The updated ImageMetadataDto
     * @throws IOException If saving master image fails
     */
    ImageMetadataDto saveMasterImage(String id, byte[] data, int width, int height, String originalName) throws IOException;

    /**
     * Retrieves the master image bytes.
     *
     * @param id The image UUID string
     * @return Optional containing the master WebP bytes if present, or empty
     */
    Optional<byte[]> getMasterImageBytes(String id);

    /**
     * Retrieves a cached variant image by dimensions.
     *
     * @param id The image UUID string
     * @param w  Target width
     * @param h  Target height
     * @return Optional containing the variant WebP bytes if cached, or empty
     */
    Optional<byte[]> getVariantImageBytes(String id, int w, int h);

    /**
     * Caches a generated variant image.
     *
     * @param id   The image UUID string
     * @param w    Target width
     * @param h    Target height
     * @param data Variant WebP bytes
     */
    void saveVariantImage(String id, int w, int h, byte[] data);

    /**
     * Deletes all files and cached variants for the given image ID.
     *
     * @param id The image UUID string
     */
    void deleteImage(String id);
}
