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
     * Storage path on disk for media files.
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
}
