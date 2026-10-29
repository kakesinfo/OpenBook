package fr.openbook.media.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import fr.openbook.media.config.MediaProperties;
import fr.openbook.media.model.ImageMetadataDto;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.Optional;
import java.util.stream.Stream;

@Slf4j
@Service
@RequiredArgsConstructor
public class MediaStorageService {

    private final MediaProperties properties;
    private final ObjectMapper objectMapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .enable(SerializationFeature.INDENT_OUTPUT)
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    @PostConstruct
    public void init() {
        try {
            Files.createDirectories(Paths.get(properties.getDataDir()));
            log.info("[MediaStorage] Initialized media storage at: {}", properties.getDataDir());
        } catch (IOException e) {
            log.error("[MediaStorage] Failed to create base media directory {}: {}", properties.getDataDir(), e.getMessage());
        }
    }

    public Path getImageDir(String id) {
        return Paths.get(properties.getDataDir(), id);
    }

    public Path getMetaPath(String id) {
        return getImageDir(id).resolve("meta.json");
    }

    public Path getMasterImagePath(String id) {
        return getImageDir(id).resolve("original.webp");
    }

    public Path getVariantImagePath(String id, int w, int h) {
        return getImageDir(id).resolve(String.format("variant_w%d_h%d.webp", w, h));
    }

    public ImageMetadataDto createSlot(String id) throws IOException {
        Path dir = getImageDir(id);
        Files.createDirectories(dir);

        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        ImageMetadataDto meta = ImageMetadataDto.builder()
                .id(id)
                .status("pending")
                .createdAt(now)
                .updatedAt(now)
                .build();

        saveMetadata(meta);
        log.info("[MediaStorage] Initialized slot directory and meta.json for {}", id);
        return meta;
    }

    public Optional<ImageMetadataDto> getMetadata(String id) {
        Path metaPath = getMetaPath(id);
        if (!Files.exists(metaPath)) {
            return Optional.empty();
        }
        try {
            ImageMetadataDto meta = objectMapper.readValue(metaPath.toFile(), ImageMetadataDto.class);
            return Optional.of(meta);
        } catch (IOException e) {
            log.warn("[MediaStorage] Failed to read meta.json for image {}: {}", id, e.getMessage());
            return Optional.empty();
        }
    }

    public void saveMetadata(ImageMetadataDto meta) throws IOException {
        Path metaPath = getMetaPath(meta.getId());
        meta.setUpdatedAt(OffsetDateTime.now(ZoneOffset.UTC));
        objectMapper.writeValue(metaPath.toFile(), meta);
        log.debug("[MediaStorage] Updated metadata file for {}: status={}", meta.getId(), meta.getStatus());
    }

    public ImageMetadataDto saveMasterImage(String id, byte[] data, int width, int height, String originalName) throws IOException {
        Path dir = getImageDir(id);
        Files.createDirectories(dir);

        // Delete any existing variants since master image changed
        try (Stream<Path> stream = Files.list(dir)) {
            stream.filter(p -> !p.getFileName().toString().equals("meta.json"))
                  .filter(p -> p.getFileName().toString().startsWith("variant_"))
                  .forEach(p -> {
                      try {
                          Files.deleteIfExists(p);
                          log.info("[CACHE] Invalidation de l'ancienne variante en cache: {}", p.getFileName());
                      } catch (IOException ignored) {}
                  });
        }

        Path masterPath = getMasterImagePath(id);
        Files.write(masterPath, data);
        log.info("[UPLOAD] Image maître enregistrée sur disque: {} ({} octets)", masterPath.getFileName(), data.length);

        ImageMetadataDto meta = getMetadata(id).orElseGet(() -> ImageMetadataDto.builder()
                .id(id)
                .createdAt(OffsetDateTime.now(ZoneOffset.UTC))
                .build());

        meta.setStatus("ready");
        meta.setWidth(width);
        meta.setHeight(height);
        meta.setSize((long) data.length);
        meta.setFormat("webp");
        meta.setMimeType("image/webp");
        if (originalName != null && !originalName.isBlank()) {
            meta.setOriginalName(originalName);
        }

        saveMetadata(meta);
        return meta;
    }

    public Optional<byte[]> getMasterImageBytes(String id) {
        Path masterPath = getMasterImagePath(id);
        if (!Files.exists(masterPath)) {
            return Optional.empty();
        }
        try {
            return Optional.of(Files.readAllBytes(masterPath));
        } catch (IOException e) {
            log.error("[MediaStorage] Failed to read master image for {}: {}", id, e.getMessage());
            return Optional.empty();
        }
    }

    public Optional<byte[]> getVariantImageBytes(String id, int w, int h) {
        Path variantPath = getVariantImagePath(id, w, h);
        if (!Files.exists(variantPath)) {
            log.info("[CACHE] Cache MISS pour la variante: id={}, w={}, h={}", id, w, h);
            return Optional.empty();
        }
        try {
            byte[] bytes = Files.readAllBytes(variantPath);
            log.debug("[CACHE] Cache HIT pour la variante: id={}, fichier={}, taille={} octets", id, variantPath.getFileName(), bytes.length);
            return Optional.of(bytes);
        } catch (IOException e) {
            log.warn("[CACHE] Erreur lors de la lecture de la variante en cache {}: {}", variantPath.getFileName(), e.getMessage());
            return Optional.empty();
        }
    }

    public void saveVariantImage(String id, int w, int h, byte[] data) {
        try {
            Path variantPath = getVariantImagePath(id, w, h);
            Files.write(variantPath, data);
            log.info("[CACHE] Variante mise en cache sur disque: {} ({} octets)", variantPath.getFileName(), data.length);
        } catch (IOException e) {
            log.warn("[CACHE] Échec de la mise en cache de la variante pour {} (w={}, h={}): {}", id, w, h, e.getMessage());
        }
    }

    public void deleteImage(String id) {
        Path dir = getImageDir(id);
        if (Files.exists(dir)) {
            try (Stream<Path> walk = Files.walk(dir)) {
                walk.sorted(Comparator.reverseOrder())
                    .map(Path::toFile)
                    .forEach(File::delete);
                log.info("[CACHE] Invalidation complète du cache et suppression du répertoire pour l'image {}", id);
            } catch (IOException e) {
                log.warn("[MediaStorage] Failed to delete image directory {}: {}", id, e.getMessage());
            }
        }
    }
}
