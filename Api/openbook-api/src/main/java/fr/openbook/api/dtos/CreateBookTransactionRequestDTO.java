package fr.openbook.api.dtos;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class CreateBookTransactionRequestDTO {
    private String type; // "BOUGHT", "GIFT", or "SOLD"
    private String date; // YYYY-MM-DD, YYYY-MM, or YYYY
    private String datePrecision; // "NONE", "YEAR", "MONTH", "DAY"
    private BigDecimal price;
    private String location;
    private String memo;
}
