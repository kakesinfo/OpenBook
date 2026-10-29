package fr.openbook.api.dtos.stats;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CategoryStatDTO {
    private String name;
    private int count;
    private double percentage;
    private String color;
}
