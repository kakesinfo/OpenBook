package fr.openbook.api.dtos;

import lombok.Data;
import java.util.List;

@Data
public class CreateWordDTO {
    private String word;
    private String definition;
    private List<Long> bookIds;
}
