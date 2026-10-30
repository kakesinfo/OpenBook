package fr.openbook.api.dtos;

import lombok.Data;

@Data
public class UpdateSeriesDTO {
    private String name;
    private String description;
    private Integer categoryId;
    private String category;
    private String status;
}
