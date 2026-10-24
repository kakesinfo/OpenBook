package fr.openbook.api.dtos;

import lombok.Data;
import java.util.List;

@Data
public class CreateSeriesDTO {
    private String name;
    private String description;
    private Integer categoryId;
    private String category;
    private String status;
    private List<Long> bookIds;
}
