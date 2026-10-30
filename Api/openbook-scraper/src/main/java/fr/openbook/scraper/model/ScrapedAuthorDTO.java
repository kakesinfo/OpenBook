package fr.openbook.scraper.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScrapedAuthorDTO {
    private String firstname;
    private String lastname;
    private String role; // "Writer", "Illustrator", "Colorist", "Translator", etc.
}
