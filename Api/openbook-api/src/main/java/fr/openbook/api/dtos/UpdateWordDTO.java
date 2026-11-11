package fr.openbook.api.dtos;

import lombok.Data;
import java.util.List;

@Data
public class UpdateWordDTO {
    private String word;
    private String definition;
    private List<Long> bookIds;
}
