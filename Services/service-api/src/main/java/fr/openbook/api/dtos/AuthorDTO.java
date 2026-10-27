package fr.openbook.api.dtos;

import lombok.Data;

import java.util.List;

@Data
public class AuthorDTO {
    private Long id;
    private String firstname;
    private String lastname;
    private Boolean isFollowed;
    private Integer booksCount;
    private List<BookSummaryDTO> books;
}
