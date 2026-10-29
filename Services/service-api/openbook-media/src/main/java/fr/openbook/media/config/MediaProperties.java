package fr.openbook.media.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "media")
public class MediaProperties {

    /**
     * Storage provider type: "local" (default) or "s3".
     */
    private String storageType = "local";

    /**
     * Storage path on disk for media files when storageType is "local".
     */
    private String dataDir = "/data/media";

    /**
     * Maximum width for master images.
     */
    private int maxWidth = 640;

    /**
     * Maximum height for master images.
     */
    private int maxHeight = 960;

    /**
     * WebP quality compression level (0-100).
     */
    private float webpQuality = 82.0f;

    /**
     * S3 / MinIO configuration properties when storageType is "s3".
     */
    private S3Properties s3 = new S3Properties();

    @Getter
    @Setter
    public static class S3Properties {
        /**
         * S3 / MinIO endpoint URL (e.g. "http://localhost:9000" or "http://project-minio:9000").
         */
        private String endpoint = "http://localhost:9000";

        /**
         * Name of the target S3 bucket.
         */
        private String bucket = "openbook-media";

        /**
         * AWS / MinIO Access Key ID.
         */
        private String accessKey = "minioadmin";

        /**
         * AWS / MinIO Secret Access Key.
         */
        private String secretKey = "minioadmin";

        /**
         * Region (defaults to "us-east-1" for local MinIO).
         */
        private String region = "us-east-1";

        /**
         * Use path-style bucket addressing (true for MinIO).
         */
        private boolean pathStyleAccess = true;
    }
}
