package fr.openbook.api.dtos;

import fr.openbook.api.utils.MediaUrlUtils;
import lombok.Data;
import java.util.List;

@Data
public class SeriesDTO {
    private Integer id;
    private String name;
    private String description;
    private String category;
    private Integer categoryId;
    private String status;
    private Integer totalVolumes;
    private String coverUrl;
    private Long createdByUserId;
    private String createdByUsername;
    private Boolean isFollowed;
    private Integer ownedCount;
    private List<BookSummaryDTO> books;

    public String getCoverUrl() {
        return MediaUrlUtils.formatCoverUrl(this.coverUrl);
    }
}
