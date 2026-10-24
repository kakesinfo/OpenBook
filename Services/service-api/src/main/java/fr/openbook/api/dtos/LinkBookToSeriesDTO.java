package fr.openbook.api.dtos;

import lombok.Data;

@Data
public class LinkBookToSeriesDTO {
    private Long bookId;
    private Integer volume;
}
