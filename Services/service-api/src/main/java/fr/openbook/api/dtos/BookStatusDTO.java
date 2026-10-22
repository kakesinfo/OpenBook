package fr.openbook.api.dtos;

import fr.openbook.api.entities.BookStatusEntity;
import lombok.Data;

import java.time.Instant;

@Data
public class BookStatusDTO {
    private Integer id;
    private Long bookId;
    private Long userId;
    private String status;
    private Instant createdAt;
    private Instant updatedAt;

    public static BookStatusDTO from(BookStatusEntity entity) {
        BookStatusDTO dto = new BookStatusDTO();
        dto.setId(entity.getId());
        dto.setBookId(entity.getBook().getId());
        dto.setUserId(entity.getUser().getId());
        dto.setStatus(entity.getStatus());
        dto.setCreatedAt(entity.getCreatedAt());
        dto.setUpdatedAt(entity.getUpdatedAt());
        return dto;
    }
}
