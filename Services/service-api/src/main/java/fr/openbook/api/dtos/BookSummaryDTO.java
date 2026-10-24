package fr.openbook.api.dtos;

import fr.openbook.api.utils.MediaUrlUtils;
import lombok.Data;

@Data
public class BookSummaryDTO {
    private Long id;
    private String title;
    private Integer volume;
    private Integer price;
    private String releaseDate;
    private String createdAt;
    private String coverUrl;
    private String category;
    private String type;
    private String author;
    private Long seriesId;
    private String seriesName;
    private Integer seriesTotalVolumes;
    private String seriesCoverUrl;
    private Integer pageCount;
    private String status;
    private String readingStatus;
    private Long parentBookId;

    public String getCoverUrl() {
        return MediaUrlUtils.formatCoverUrl(this.coverUrl);
    }

    public String getSeriesCoverUrl() {
        return MediaUrlUtils.formatCoverUrl(this.seriesCoverUrl);
    }
}
