package fr.openbook.api.services.media;

import org.springframework.http.ResponseEntity;

import java.util.Map;

public interface MediaService {

    /**
     * Create a virtual image slot in media storage.
     * Returns the generated UUID string.
     */
    String createVirtualImage();

    /**
     * Upload image binary bytes to an image slot.
     */
    Map<String, Object> uploadImage(String id, byte[] imageBytes, String contentType);

    /**
     * Upload an image by remote URL to an image slot.
     */
    Map<String, Object> uploadRemoteUrl(String id, String remoteUrl);

    /**
     * Get image metadata info (dimensions, size, weight, status).
     */
    Map<String, Object> getImageInfo(String id);

    /**
     * Get binary blob of the image (with optional width, height, size options).
     */
    ResponseEntity<byte[]> getImageBlob(String id, Integer width, Integer height, String size);

    /**
     * Delete an image from media storage and database.
     */
    void deleteImage(String id);
}
