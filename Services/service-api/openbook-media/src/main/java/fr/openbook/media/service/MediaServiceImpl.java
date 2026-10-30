package fr.openbook.media.service;

import fr.openbook.api.services.media.MediaService;
import fr.openbook.media.entity.MediaImage;
import fr.openbook.media.model.ImageMetadataDto;
import fr.openbook.media.repository.MediaImageRepository;
import fr.openbook.media.storage.StorageProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.DigestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@Primary
@RequiredArgsConstructor
public class MediaServiceImpl implements MediaService {

    private final StorageProvider storageService;
    private final MediaProcessingService processingService;
    private final MediaImageRepository imageRepository;

    @Override
    public String createVirtualImage() {
        UUID uuid = UUID.randomUUID();
        String id = uuid.toString();
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        log.info("[MediaService] Generating new virtual image slot: {}", id);

        try {
            storageService.createSlot(id);
        } catch (Exception e) {
            log.error("[MediaService] Failed to create storage slot {}: {}", id, e.getMessage());
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to create image slot", e);
        }

        try {
            MediaImage entity = MediaImage.builder()
                    .id(uuid)
                    .status("pending")
                    .createdAt(now)
                    .updatedAt(now)
                    .build();
            imageRepository.save(entity);
            log.info("[MediaService] Virtual image slot {} saved in database (status=pending)", id);
        } catch (Exception e) {
            log.warn("[MediaService] DB slot insert failed for {}: {}", id, e.getMessage());
        }

        return id;
    }

    @Override
    public Map<String, Object> uploadImage(String id, byte[] imageBytes, String contentType) {
        if (id == null || id.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing image ID");
        }
        if (imageBytes == null || imageBytes.length == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Empty image bytes");
        }

        long startTime = System.currentTimeMillis();
        log.info("[UPLOAD] Réception de fichier pour le slot {}: {} octets, contentType='{}'", id, imageBytes.length, contentType);

        UUID uuid = parseUUID(id);
        MediaProcessingService.ProcessResult result;
        try {
            result = processingService.processMaster(imageBytes);
        } catch (Exception e) {
            log.error("[UPLOAD] Échec du traitement de l'image pour {}: {}", id, e.getMessage());
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Image processing failed: " + e.getMessage(), e);
        }

        String originalName = contentType != null ? contentType : "binary-upload";
        ImageMetadataDto meta;
        try {
            meta = storageService.saveMasterImage(id, result.data(), result.width(), result.height(), originalName);
        } catch (Exception e) {
            log.error("[UPLOAD] Échec de l'enregistrement de l'image maître pour {}: {}", id, e.getMessage());
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to save image: " + e.getMessage(), e);
        }

        updateDatabaseReady(uuid, result.width(), result.height(), result.data().length, originalName);
        long elapsed = System.currentTimeMillis() - startTime;
        log.info("[UPLOAD] Image maître finalisée avec succès pour {}: {}x{}, WebP {} octets en {} ms",
                id, result.width(), result.height(), result.data().length, elapsed);
        return meta.toMap();
    }

    @Override
    public Map<String, Object> uploadRemoteUrl(String id, String remoteUrl) {
        if (id == null || id.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing image ID");
        }
        if (remoteUrl == null || remoteUrl.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing remote URL");
        }

        long startTime = System.currentTimeMillis();
        log.info("[UPLOAD] Téléchargement image distante pour le slot {}: url='{}'", id, remoteUrl);
        byte[] downloadedBytes = fetchRemoteImage(remoteUrl.trim());
        log.info("[UPLOAD] Image distante téléchargée pour {}: {} octets reçus depuis '{}'", id, downloadedBytes.length, remoteUrl);

        UUID uuid = parseUUID(id);

        MediaProcessingService.ProcessResult result;
        try {
            result = processingService.processMaster(downloadedBytes);
        } catch (Exception e) {
            log.error("[UPLOAD] Échec du traitement de l'image distante pour {}: {}", id, e.getMessage());
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Image processing failed: " + e.getMessage(), e);
        }

        ImageMetadataDto meta;
        try {
            meta = storageService.saveMasterImage(id, result.data(), result.width(), result.height(), remoteUrl);
        } catch (Exception e) {
            log.error("[UPLOAD] Échec de l'enregistrement de l'image distante pour {}: {}", id, e.getMessage());
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to save image: " + e.getMessage(), e);
        }

        updateDatabaseReady(uuid, result.width(), result.height(), result.data().length, remoteUrl);
        long elapsed = System.currentTimeMillis() - startTime;
        log.info("[UPLOAD] Image distante finalisée avec succès pour {}: {}x{}, WebP {} octets en {} ms",
                id, result.width(), result.height(), result.data().length, elapsed);
        return meta.toMap();
    }

    @Override
    public Map<String, Object> getImageInfo(String id) {
        if (id == null || id.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing image ID");
        }

        UUID uuid = parseUUID(id);
        if (uuid != null) {
            Optional<MediaImage> opt = imageRepository.findById(uuid);
            if (opt.isPresent()) {
                MediaImage entity = opt.get();
                log.debug("[MediaService] Retrieved image info from DB for {}: status={}, {}x{}, size={}",
                        id, entity.getStatus(), entity.getWidth(), entity.getHeight(), entity.getSize());
                return ImageMetadataDto.builder()
                        .id(entity.getId().toString())
                        .status(entity.getStatus())
                        .width(entity.getWidth())
                        .height(entity.getHeight())
                        .size(entity.getSize())
                        .format(entity.getFormat())
                        .mimeType(entity.getMimeType())
                        .originalName(entity.getOriginalName())
                        .createdAt(entity.getCreatedAt())
                        .updatedAt(entity.getUpdatedAt())
                        .build()
                        .toMap();
            }
        }

        Optional<ImageMetadataDto> meta = storageService.getMetadata(id);
        if (meta.isPresent()) {
            log.debug("[MediaService] Retrieved image info from disk meta.json for {}: status={}", id, meta.get().getStatus());
            return meta.get().toMap();
        }

        log.warn("[MediaService] Image info not found for ID: {}", id);
        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Image not found");
    }

    @Override
    public ResponseEntity<byte[]> getImageBlob(String id, Integer width, Integer height, String size) {
        if (id == null || id.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        int targetW = 0;
        int targetH = 0;
        if (size != null && !size.isBlank()) {
            switch (size.toLowerCase().trim()) {
                case "thumb", "thumbnail" -> targetW = 160;
                case "medium" -> targetW = 320;
                case "large" -> targetW = 640;
            }
        }
        if (width != null && width > 0) targetW = width;
        if (height != null && height > 0) targetH = height;

        byte[] serveBytes;

        // 1. If variant requested, check cache directly first without reading master image
        if (targetW > 0 || targetH > 0) {
            Optional<byte[]> cached = storageService.getVariantImageBytes(id, targetW, targetH);
            if (cached.isPresent()) {
                log.debug("[CACHE] Distribution de la variante en cache pour {} (targetW={}, targetH={}): taille={} octets",
                        id, targetW, targetH, cached.get().length);
                serveBytes = cached.get();
                return buildImageResponse(serveBytes);
            }
        }

        // 2. Master or variant cache MISS: load master image
        Optional<byte[]> masterOpt = storageService.getMasterImageBytes(id);
        if (masterOpt.isEmpty()) {
            Optional<ImageMetadataDto> meta = storageService.getMetadata(id);
            if (meta.isPresent() && !"ready".equalsIgnoreCase(meta.get().getStatus())) {
                log.debug("[MediaService] Image {} requested but status is '{}' (not ready)", id, meta.get().getStatus());
                return ResponseEntity.status(HttpStatus.CONFLICT).build();
            }
            log.warn("[MediaService] Image {} master file not found", id);
            return ResponseEntity.notFound().build();
        }

        if (targetW <= 0 && targetH <= 0) {
            log.debug("[CACHE] Distribution de l'image maître originale pour {}: taille={} octets", id, masterOpt.get().length);
            serveBytes = masterOpt.get();
        } else {
            try {
                log.info("[CACHE] Génération à la volée de la variante requise pour {} (targetW={}, targetH={})",
                        id, targetW, targetH);
                serveBytes = processingService.resizeFromMaster(masterOpt.get(), targetW, targetH);
                storageService.saveVariantImage(id, targetW, targetH, serveBytes);
            } catch (Exception e) {
                log.error("[REDIMENSIONNEMENT] Échec du redimensionnement de l'image {} vers {}x{}: {}", id, targetW, targetH, e.getMessage());
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
            }
        }

        return buildImageResponse(serveBytes);
    }

    private ResponseEntity<byte[]> buildImageResponse(byte[] serveBytes) {
        String etag = "\"" + DigestUtils.md5DigestAsHex(serveBytes) + "\"";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("image/webp"));
        headers.setETag(etag);
        headers.setCacheControl("public, max-age=31536000, immutable");
        headers.setContentLength(serveBytes.length);

        return new ResponseEntity<>(serveBytes, headers, HttpStatus.OK);
    }

    @Override
    public void deleteImage(String id) {
        if (id == null || id.isBlank()) {
            return;
        }

        log.info("[MediaService] Deleting image slot and all variants: {}", id);
        UUID uuid = parseUUID(id);
        if (uuid != null) {
            try {
                imageRepository.deleteById(uuid);
                log.debug("[MediaService] Deleted entity {} from database", uuid);
            } catch (Exception e) {
                log.warn("[MediaService] DB delete failed for {}: {}", id, e.getMessage());
            }
        }

        storageService.deleteImage(id);
        log.info("[MediaService] Successfully deleted image {}", id);
    }

    private byte[] fetchRemoteImage(String remoteUrl) {
        try {
            URI uri = URI.create(remoteUrl);
            URL url = uri.toURL();
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(20_000);
            conn.setReadTimeout(20_000);
            conn.setRequestProperty("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36");
            conn.setRequestProperty("Accept", "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8,*/*;q=0.5");
            conn.setRequestProperty("Referer", uri.getScheme() + "://" + uri.getHost() + "/");

            int status = conn.getResponseCode();
            if (status < 200 || status >= 300) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Failed to fetch remote image: HTTP " + status);
            }

            try (InputStream in = conn.getInputStream();
                 ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[8192];
                int totalRead = 0;
                int maxBytes = 32 * 1024 * 1024; // 32MB max
                int n;
                while ((n = in.read(buffer)) != -1) {
                    totalRead += n;
                    if (totalRead > maxBytes) {
                        throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Remote image exceeds 32MB limit");
                    }
                    out.write(buffer, 0, n);
                }
                return out.toByteArray();
            }
        } catch (ResponseStatusException rse) {
            throw rse;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Failed to download remote image: " + e.getMessage(), e);
        }
    }

    private void updateDatabaseReady(UUID uuid, int width, int height, long size, String originalName) {
        if (uuid == null) return;
        try {
            OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
            MediaImage entity = imageRepository.findById(uuid).orElseGet(() -> MediaImage.builder()
                    .id(uuid)
                    .createdAt(now)
                    .build());
            entity.setStatus("ready");
            entity.setWidth(width);
            entity.setHeight(height);
            entity.setSize(size);
            entity.setFormat("webp");
            entity.setMimeType("image/webp");
            entity.setOriginalName(originalName);
            entity.setUpdatedAt(now);
            imageRepository.save(entity);
        } catch (Exception e) {
            log.warn("[MediaService] DB update ready failed for {}: {}", uuid, e.getMessage());
        }
    }

    private UUID parseUUID(String id) {
        try {
            return UUID.fromString(id.trim());
        } catch (Exception e) {
            return null;
        }
    }
}
