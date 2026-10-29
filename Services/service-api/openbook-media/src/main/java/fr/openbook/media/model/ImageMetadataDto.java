package fr.openbook.media.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ImageMetadataDto {

    private String id;
    private String status;
    private Integer width;
    private Integer height;
    private Long size;
    private String format;

    @JsonProperty("mime_type")
    private String mimeType;

    @JsonProperty("original_name")
    private String originalName;

    @JsonProperty("created_at")
    private OffsetDateTime createdAt;

    @JsonProperty("updated_at")
    private OffsetDateTime updatedAt;

    public Map<String, Object> toMap() {
        Map<String, Object> map = new HashMap<>();
        if (id != null) map.put("id", id);
        if (status != null) map.put("status", status);
        if (width != null && width > 0) map.put("width", width);
        if (height != null && height > 0) map.put("height", height);
        if (size != null && size > 0) map.put("size", size);
        if (format != null) map.put("format", format);
        if (mimeType != null) map.put("mime_type", mimeType);
        if (originalName != null) map.put("original_name", originalName);
        if (createdAt != null) map.put("created_at", createdAt.toString());
        if (updatedAt != null) map.put("updated_at", updatedAt.toString());
        return map;
    }
}
