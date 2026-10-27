package fr.openbook.api.dtos.stats;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AuthorHighlightDTO {
    private String name;
    private int bookCount;
    private String role;
    private double percentage;

    public AuthorHighlightDTO(String name, int bookCount, String role) {
        this.name = name;
        this.bookCount = bookCount;
        this.role = role;
        this.percentage = 0.0;
    }
}
