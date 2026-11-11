package fr.openbook.api.dtos;

import lombok.Data;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Data
public class WordDTO {
    private Long id;
    private String word;
    private String definition;
    private List<BookSummaryDTO> books = new ArrayList<>();
    private Instant createdAt;
    private Instant updatedAt;
}
