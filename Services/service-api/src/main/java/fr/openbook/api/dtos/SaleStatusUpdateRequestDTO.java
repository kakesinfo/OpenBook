package fr.openbook.api.dtos;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class SaleStatusUpdateRequestDTO {
    private String date; // YYYY-MM-DD
    private BigDecimal price;
    private String location;
    private String memo;
}
