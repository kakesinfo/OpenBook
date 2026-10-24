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

    public String getCoverUrl() {
        return MediaUrlUtils.formatCoverUrl(this.coverUrl);
    }
}
