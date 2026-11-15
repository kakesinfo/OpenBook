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
    private String type; // "BOUGHT", "GIFT", "SOLD"
    private String date; // YYYY-MM-DD, YYYY-MM, or YYYY
    private String datePrecision; // "YEAR", "MONTH", "DAY"
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
            String precision = entity.getDatePrecision();
            if ("YEAR".equalsIgnoreCase(precision)) {
                dto.setDate(String.format("%04d", entity.getTransactionDate().getYear()));
                dto.setDatePrecision("YEAR");
            } else if ("MONTH".equalsIgnoreCase(precision)) {
                dto.setDate(String.format("%04d-%02d", entity.getTransactionDate().getYear(), entity.getTransactionDate().getMonthValue()));
                dto.setDatePrecision("MONTH");
            } else {
                dto.setDate(entity.getTransactionDate().toString());
                dto.setDatePrecision("DAY");
            }
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
