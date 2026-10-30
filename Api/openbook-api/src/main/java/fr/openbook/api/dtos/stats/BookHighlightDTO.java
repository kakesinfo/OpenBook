package fr.openbook.api.dtos.stats;

import fr.openbook.api.utils.MediaUrlUtils;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class BookHighlightDTO {
    private Long id;
    private String title;
    private String releaseDate;
    private String coverUrl;
    private String category;
    private Integer pageCount;
    private Integer price;
    private String highlightValue;

    public BookHighlightDTO(Long id, String title, String releaseDate, String coverUrl, String category) {
        this.id = id;
        this.title = title;
        this.releaseDate = releaseDate;
        this.coverUrl = coverUrl;
        this.category = category;
    }

    public String getCoverUrl() {
        return MediaUrlUtils.formatCoverUrl(this.coverUrl);
    }
}
