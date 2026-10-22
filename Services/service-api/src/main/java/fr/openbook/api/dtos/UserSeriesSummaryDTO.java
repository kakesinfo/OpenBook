package fr.openbook.api.dtos;

import lombok.Data;
import java.util.List;

@Data
public class UserSeriesSummaryDTO {
    private Long id;
    private String name;
    private String category;
    private String coverUrl;
    private Integer totalVolumes;
    private Integer ownedCount;
    private List<BookSummaryDTO> books;
}
