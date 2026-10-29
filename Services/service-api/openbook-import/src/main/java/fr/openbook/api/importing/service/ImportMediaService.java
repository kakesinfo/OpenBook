package fr.openbook.api.importing.service;

import fr.openbook.api.services.media.MediaServiceClient;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

@Slf4j
@Service
public class ImportMediaService {

    private final MediaServiceClient mediaServiceClient;
    private final Map<String, String> cache = new ConcurrentHashMap<>();

    public ImportMediaService(MediaServiceClient mediaServiceClient) {
        this.mediaServiceClient = mediaServiceClient;
    }

    public String processBookCover(String imageField, Map<String, ZipEntry> zipImages, ZipFile zipFile) {
        if (imageField == null || imageField.isBlank()) {
            return "";
        }
        String raw = imageField.trim();

        // 1. Check if local path in the zip
        if (!raw.startsWith("http://") && !raw.startsWith("https://")) {
            String basename = raw;
            int idx = raw.lastIndexOf('/');
            if (idx != -1) {
                basename = raw.substring(idx + 1);
            }

            ZipEntry entry = zipImages != null ? zipImages.get(basename) : null;
            if (entry != null && zipFile != null) {
                String cacheKey = "zip:" + entry.getName();
                String cached = cache.get(cacheKey);
                if (cached != null) {
                    return cached;
                }

                try (InputStream in = zipFile.getInputStream(entry)) {
                    byte[] bytes = in.readAllBytes();
                    String slotId = mediaServiceClient.createVirtualImage();
                    mediaServiceClient.uploadImage(slotId, bytes, "image/jpeg");
                    cache.put(cacheKey, slotId);
                    return slotId;
                } catch (Exception ex) {
                    log.warn("[ImportMediaService] Failed to upload zip image {}: {}", basename, ex.getMessage());
                }
            }
            return "";
        }

        // 2. Remote URL
        String cacheKey = "url:" + raw;
        String cached = cache.get(cacheKey);
        if (cached != null) {
            return cached;
        }

        try {
            String slotId = mediaServiceClient.createVirtualImage();
            mediaServiceClient.uploadRemoteUrl(slotId, raw);
            cache.put(cacheKey, slotId);
            return slotId;
        } catch (Exception ex) {
            log.warn("[ImportMediaService] Failed to upload remote image {}: {} (falling back to raw URL)", raw, ex.getMessage());
            return raw;
        }
    }
}
