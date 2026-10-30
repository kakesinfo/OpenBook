package fr.openbook.api.dtos;

import fr.openbook.api.entities.UserBookTransactionEntity;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class UserBookTransactionDTO {
    private Integer id;
    private Long bookId;
    private Long userId;
    private String type; // "BOUGHT", "SOLD"
    private String date; // YYYY-MM-DD
    private BigDecimal price;
    private String location;
    private String memo;
    private Long createdAt;

    public static UserBookTransactionDTO from(UserBookTransactionEntity entity) {
        UserBookTransactionDTO dto = new UserBookTransactionDTO();
        dto.setId(entity.getId());
        dto.setBookId(entity.getBook() != null ? entity.getBook().getId() : null);
        dto.setUserId(entity.getUser() != null ? entity.getUser().getId() : null);
        dto.setType(entity.getType());
        if (entity.getTransactionDate() != null) {
            dto.setDate(entity.getTransactionDate().toString());
        }
        dto.setPrice(entity.getPrice());
        dto.setLocation(entity.getLocation());
        dto.setMemo(entity.getMemo());
        if (entity.getCreatedAt() != null) {
            dto.setCreatedAt(entity.getCreatedAt().toEpochMilli());
        }
        return dto;
    }
}
