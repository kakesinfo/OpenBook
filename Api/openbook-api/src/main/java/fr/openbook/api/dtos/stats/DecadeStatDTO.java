package fr.openbook.api.dtos.stats;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DecadeStatDTO {
    private String decade;
    private int count;
    private double percentage;
}
