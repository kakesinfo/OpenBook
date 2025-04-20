package fr.openbook.api.dtos;

import lombok.Data;

@Data
public class BookHasAuthorDTO {
    private String firstname;
    private String lastname;
    private String type;
}

