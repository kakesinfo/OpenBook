package fr.openbook.api.dtos;

import lombok.Data;

@Data
public class SeriesDTO {
    private String name;
    private String category;
    private String status;
    private Integer totalVolumes;
}
