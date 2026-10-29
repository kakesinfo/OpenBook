package fr.openbook.media.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import fr.openbook.media.config.MediaProperties;
import fr.openbook.media.model.ImageMetadataDto;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import java.util.stream.Stream;

@Slf4j
@Component
@RequiredArgsConstructor
public class MediaDatabaseInitializer {

    private final JdbcTemplate jdbcTemplate;
    private final MediaProperties properties;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @PostConstruct
    public void init() {
        try {
            // 1. Ensure schema and table exist
            jdbcTemplate.execute("""
                CREATE SCHEMA IF NOT EXISTS media;

                CREATE TABLE IF NOT EXISTS media.images (
                    id UUID PRIMARY KEY,
                    status VARCHAR(32) NOT NULL,
                    width INT,
                    height INT,
                    size BIGINT,
                    format VARCHAR(32),
                    mime_type VARCHAR(64),
                    original_name TEXT,
                    created_at TIMESTAMPTZ NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_media_images_status ON media.images(status);
                CREATE INDEX IF NOT EXISTS idx_media_images_created_at ON media.images(created_at);
            """);

            // 2. Check row count and backfill if needed
            Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM media.images", Integer.class);
            if (count != null && count > 0) {
                log.info("[MediaDatabase] Connected. Total records in 'media.images': {}", count);
                return;
            }

            backfillFromDisk();
        } catch (Exception e) {
            log.warn("[MediaDatabase] Could not verify or initialize media table: {}", e.getMessage());
        }
    }

    private void backfillFromDisk() {
        Path base = Paths.get(properties.getDataDir());
        if (!Files.exists(base) || !Files.isDirectory(base)) {
            return;
        }

        log.info("[MediaDatabase] Initializing empty schema from existing media files in {}...", properties.getDataDir());
        int imported = 0;

        try (Stream<Path> stream = Files.list(base)) {
            for (Path entry : stream.filter(Files::isDirectory).toList()) {
                String idStr = entry.getFileName().toString();
                Path metaPath = entry.resolve("meta.json");
                if (!Files.exists(metaPath)) {
                    continue;
                }

                try {
                    UUID uuid = UUID.fromString(idStr);
                    ImageMetadataDto meta = objectMapper.readValue(metaPath.toFile(), ImageMetadataDto.class);

                    OffsetDateTime createdAt = meta.getCreatedAt() != null ? meta.getCreatedAt() : OffsetDateTime.now(ZoneOffset.UTC);
                    OffsetDateTime updatedAt = meta.getUpdatedAt() != null ? meta.getUpdatedAt() : createdAt;

                    jdbcTemplate.update("""
                        INSERT INTO media.images (id, status, width, height, size, format, mime_type, original_name, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT (id) DO NOTHING
                    """, uuid, meta.getStatus(), meta.getWidth(), meta.getHeight(), meta.getSize(),
                        meta.getFormat(), meta.getMimeType(), meta.getOriginalName(), createdAt, updatedAt);

                    imported++;
                } catch (Exception ignored) {
                }
            }
        } catch (Exception e) {
            log.warn("[MediaDatabase] Error backfilling media from disk: {}", e.getMessage());
        }

        if (imported > 0) {
            log.info("[MediaDatabase] Successfully imported {} media records from disk into 'media.images' table", imported);
        }
    }
}
