package fr.openbook.api.dtos;

import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.util.List;

@Getter
@Setter
public class EditorDTO implements Serializable {
    private Long id;
    private String name;
    private Boolean isFollowed;
    private Integer booksCount;
    private List<BookSummaryDTO> books;
}
