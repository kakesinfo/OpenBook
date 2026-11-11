package fr.openbook.api.dtos;

import lombok.Data;
import java.time.Instant;

@Data
public class NoteDTO {
    private Long id;
    private Long bookId;
    private BookSummaryDTO book;
    private String content;
    private String username;
    private Instant createdAt;
    private Instant updatedAt;
}
