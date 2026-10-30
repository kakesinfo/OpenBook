package fr.openbook.media.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "images", schema = "media")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MediaImage {

    @Id
    @Column(name = "id")
    private UUID id;

    @Column(name = "status", nullable = false, length = 32)
    private String status;

    @Column(name = "width")
    private Integer width;

    @Column(name = "height")
    private Integer height;

    @Column(name = "size")
    private Long size;

    @Column(name = "format", length = 32)
    private String format;

    @Column(name = "mime_type", length = 64)
    private String mimeType;

    @Column(name = "original_name")
    private String originalName;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
