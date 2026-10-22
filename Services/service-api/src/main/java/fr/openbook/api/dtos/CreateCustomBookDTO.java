package fr.openbook.api.dtos;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreateCustomBookDTO {
    private String title;
    private String author;
    private String series;
    private Integer volume;
    private Integer pageCount;
    private String coverUrl;
    private String status;
}
