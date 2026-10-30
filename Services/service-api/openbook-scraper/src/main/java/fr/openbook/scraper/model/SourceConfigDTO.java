package fr.openbook.scraper.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SourceConfigDTO {
    private String id;
    private String name;
    private String description;
    private String color;
    private boolean enabled;
}
