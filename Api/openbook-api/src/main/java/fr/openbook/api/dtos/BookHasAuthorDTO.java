package fr.openbook.api.dtos;

import lombok.Data;

@Data
public class BookHasAuthorDTO {
    private Integer id;
    private String firstname;
    private String lastname;
    private String type;
}
