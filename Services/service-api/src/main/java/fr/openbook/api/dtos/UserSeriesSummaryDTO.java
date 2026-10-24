package fr.openbook.api.dtos;

import fr.openbook.api.utils.MediaUrlUtils;
import lombok.Data;
import java.util.List;

@Data
public class UserSeriesSummaryDTO {
    private Long id;
    private String name;
    private String description;
    private String category;
    private Integer categoryId;
    private String status;
    private String coverUrl;
    private Integer totalVolumes;
    private Integer ownedCount;
    private Boolean isFollowed;
    private List<BookSummaryDTO> books;

    public String getCoverUrl() {
        return MediaUrlUtils.formatCoverUrl(this.coverUrl);
    }
}
