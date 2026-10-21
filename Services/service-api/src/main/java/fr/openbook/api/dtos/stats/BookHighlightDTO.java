package fr.openbook.api.dtos.stats;

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
}
