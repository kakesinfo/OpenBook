package fr.openbook.api.dtos.stats;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CountryStatDTO {
    private String code;
    private String name;
    private String flag;
    private int count;
    private double percentage;
}
