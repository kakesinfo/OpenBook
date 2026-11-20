package fr.openbook.api.dtos;

import fr.openbook.api.utils.MediaUrlUtils;
import lombok.Data;

@Data
public class BookSummaryDTO {
    private Long id;
    private String title;
    private String isbn;
    private Integer volume;
    private Integer price;
    private String listingUrl;
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
    private String editorName;
    private Integer pageCount;
    private String status;
    private String readingStatus;
    private String loanType;
    private String loanPerson;
    private String loanDate;
    private String loanDueDate;
    private String loanMemo;

    public String getCoverUrl() {
        return MediaUrlUtils.formatCoverUrl(this.coverUrl);
    }

    public String getSeriesCoverUrl() {
        return MediaUrlUtils.formatCoverUrl(this.seriesCoverUrl);
    }
}
