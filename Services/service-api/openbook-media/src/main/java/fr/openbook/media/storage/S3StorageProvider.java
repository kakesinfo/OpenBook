package fr.openbook.media.storage;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import fr.openbook.media.config.MediaProperties;
import fr.openbook.media.model.ImageMetadataDto;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3ClientBuilder;
import software.amazon.awssdk.services.s3.model.*;

import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * S3 / MinIO implementation of {@link StorageProvider}.
 * Activated when `media.storage.type=s3`.
 */
@Slf4j
@Component
@ConditionalOnProperty(name = "media.storage.type", havingValue = "s3")
@RequiredArgsConstructor
public class S3StorageProvider implements StorageProvider {

    private final MediaProperties properties;
    private final ObjectMapper objectMapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .enable(SerializationFeature.INDENT_OUTPUT)
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    private S3Client s3Client;
    private String bucket;

    @PostConstruct
    public void init() {
        MediaProperties.S3Properties s3Props = properties.getS3();
        this.bucket = s3Props.getBucket();

        log.info("[S3Storage] Initializing S3 storage provider. Endpoint: {}, Bucket: {}, Region: {}",
                s3Props.getEndpoint(), bucket, s3Props.getRegion());

        try {
            S3ClientBuilder builder = S3Client.builder()
                    .region(Region.of(s3Props.getRegion()))
                    .credentialsProvider(StaticCredentialsProvider.create(
                            AwsBasicCredentials.create(s3Props.getAccessKey(), s3Props.getSecretKey())
                    ))
                    .httpClient(UrlConnectionHttpClient.builder().build());

            if (s3Props.getEndpoint() != null && !s3Props.getEndpoint().isBlank()) {
                builder.endpointOverride(URI.create(s3Props.getEndpoint()))
                       .forcePathStyle(s3Props.isPathStyleAccess());
            }

            this.s3Client = builder.build();

            // Ensure bucket exists or attempt to create it
            ensureBucketExists();
        } catch (Exception e) {
            log.warn("[S3Storage] Could not fully initialize or connect to S3 endpoint: {}. Provider will retry on demand.", e.getMessage());
        }
    }

    private void ensureBucketExists() {
        try {
            s3Client.headBucket(HeadBucketRequest.builder().bucket(bucket).build());
            log.info("[S3Storage] Bucket '{}' is ready.", bucket);
        } catch (NoSuchBucketException e) {
            log.info("[S3Storage] Bucket '{}' not found, creating...", bucket);
            try {
                s3Client.createBucket(CreateBucketRequest.builder().bucket(bucket).build());
                log.info("[S3Storage] Bucket '{}' created successfully.", bucket);
            } catch (Exception ex) {
                log.warn("[S3Storage] Failed to create bucket '{}': {}", bucket, ex.getMessage());
            }
        } catch (Exception e) {
            log.warn("[S3Storage] Head bucket check failed for '{}': {}", bucket, e.getMessage());
        }
    }

    private String getMasterKey(String id) {
        return "images/" + id + "/original.webp";
    }

    private String getVariantKey(String id, int w, int h) {
        return String.format("images/%s/variant_w%d_h%d.webp", id, w, h);
    }

    private String getMetaKey(String id) {
        return "images/" + id + "/meta.json";
    }

    @Override
    public ImageMetadataDto createSlot(String id) throws IOException {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        ImageMetadataDto meta = ImageMetadataDto.builder()
                .id(id)
                .status("pending")
                .createdAt(now)
                .updatedAt(now)
                .build();

        saveMetadata(meta);
        log.info("[S3Storage] Initialized slot and meta.json in S3 for {}", id);
        return meta;
    }

    @Override
    public Optional<ImageMetadataDto> getMetadata(String id) {
        String key = getMetaKey(id);
        try {
            ResponseBytes<GetObjectResponse> objectBytes = s3Client.getObjectAsBytes(
                    GetObjectRequest.builder().bucket(bucket).key(key).build()
            );
            ImageMetadataDto meta = objectMapper.readValue(objectBytes.asByteArray(), ImageMetadataDto.class);
            return Optional.of(meta);
        } catch (NoSuchKeyException e) {
            return Optional.empty();
        } catch (Exception e) {
            log.warn("[S3Storage] Failed to read meta.json from S3 for {}: {}", id, e.getMessage());
            return Optional.empty();
        }
    }

    @Override
    public void saveMetadata(ImageMetadataDto meta) throws IOException {
        String key = getMetaKey(meta.getId());
        meta.setUpdatedAt(OffsetDateTime.now(ZoneOffset.UTC));
        byte[] bytes = objectMapper.writeValueAsBytes(meta);

        try {
            s3Client.putObject(
                    PutObjectRequest.builder()
                            .bucket(bucket)
                            .key(key)
                            .contentType("application/json")
                            .build(),
                    RequestBody.fromBytes(bytes)
            );
            log.debug("[S3Storage] Saved metadata file in S3 for {}: status={}", meta.getId(), meta.getStatus());
        } catch (Exception e) {
            log.error("[S3Storage] Failed to save metadata to S3 for {}: {}", meta.getId(), e.getMessage());
            throw new IOException("Failed to save metadata to S3: " + e.getMessage(), e);
        }
    }

    @Override
    public ImageMetadataDto saveMasterImage(String id, byte[] data, int width, int height, String originalName) throws IOException {
        // Delete any existing variants for this image in S3
        invalidateVariants(id);

        String masterKey = getMasterKey(id);
        try {
            s3Client.putObject(
                    PutObjectRequest.builder()
                            .bucket(bucket)
                            .key(masterKey)
                            .contentType("image/webp")
                            .build(),
                    RequestBody.fromBytes(data)
            );
            log.info("[S3Storage] Master image uploaded to S3: {} ({} octets)", masterKey, data.length);
        } catch (Exception e) {
            log.error("[S3Storage] Failed to upload master image to S3 for {}: {}", id, e.getMessage());
            throw new IOException("Failed to upload master image to S3: " + e.getMessage(), e);
        }

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

    private void invalidateVariants(String id) {
        try {
            String prefix = "images/" + id + "/variant_";
            ListObjectsV2Response list = s3Client.listObjectsV2(
                    ListObjectsV2Request.builder().bucket(bucket).prefix(prefix).build()
            );

            if (list.contents() != null && !list.contents().isEmpty()) {
                List<ObjectIdentifier> toDelete = list.contents().stream()
                        .map(o -> ObjectIdentifier.builder().key(o.key()).build())
                        .toList();

                s3Client.deleteObjects(DeleteObjectsRequest.builder()
                        .bucket(bucket)
                        .delete(Delete.builder().objects(toDelete).build())
                        .build());
                log.info("[S3Storage] Invalidated {} cached variants for image {}", toDelete.size(), id);
            }
        } catch (Exception e) {
            log.warn("[S3Storage] Failed to invalidate variants for {}: {}", id, e.getMessage());
        }
    }

    @Override
    public Optional<byte[]> getMasterImageBytes(String id) {
        String key = getMasterKey(id);
        try {
            ResponseBytes<GetObjectResponse> response = s3Client.getObjectAsBytes(
                    GetObjectRequest.builder().bucket(bucket).key(key).build()
            );
            return Optional.of(response.asByteArray());
        } catch (NoSuchKeyException e) {
            return Optional.empty();
        } catch (Exception e) {
            log.error("[S3Storage] Failed to read master image from S3 for {}: {}", id, e.getMessage());
            return Optional.empty();
        }
    }

    @Override
    public Optional<byte[]> getVariantImageBytes(String id, int w, int h) {
        String key = getVariantKey(id, w, h);
        try {
            ResponseBytes<GetObjectResponse> response = s3Client.getObjectAsBytes(
                    GetObjectRequest.builder().bucket(bucket).key(key).build()
            );
            log.debug("[S3Storage] Cache HIT for variant in S3: key={}, size={} octets", key, response.asByteArray().length);
            return Optional.of(response.asByteArray());
        } catch (NoSuchKeyException e) {
            log.debug("[S3Storage] Cache MISS for variant in S3: id={}, w={}, h={}", id, w, h);
            return Optional.empty();
        } catch (Exception e) {
            log.warn("[S3Storage] Failed to read variant from S3: key={}: {}", key, e.getMessage());
            return Optional.empty();
        }
    }

    @Override
    public void saveVariantImage(String id, int w, int h, byte[] data) {
        String key = getVariantKey(id, w, h);
        try {
            s3Client.putObject(
                    PutObjectRequest.builder()
                            .bucket(bucket)
                            .key(key)
                            .contentType("image/webp")
                            .build(),
                    RequestBody.fromBytes(data)
            );
            log.info("[S3Storage] Variant cached in S3: {} ({} octets)", key, data.length);
        } catch (Exception e) {
            log.warn("[S3Storage] Failed to cache variant in S3: key={}: {}", key, e.getMessage());
        }
    }

    @Override
    public void deleteImage(String id) {
        try {
            String prefix = "images/" + id + "/";
            ListObjectsV2Response list = s3Client.listObjectsV2(
                    ListObjectsV2Request.builder().bucket(bucket).prefix(prefix).build()
            );

            if (list.contents() != null && !list.contents().isEmpty()) {
                List<ObjectIdentifier> toDelete = list.contents().stream()
                        .map(o -> ObjectIdentifier.builder().key(o.key()).build())
                        .toList();

                s3Client.deleteObjects(DeleteObjectsRequest.builder()
                        .bucket(bucket)
                        .delete(Delete.builder().objects(toDelete).build())
                        .build());
                log.info("[S3Storage] Deleted all objects for image {} in S3 ({} objects)", id, toDelete.size());
            }
        } catch (Exception e) {
            log.warn("[S3Storage] Failed to delete image objects in S3 for {}: {}", id, e.getMessage());
        }
    }
}
