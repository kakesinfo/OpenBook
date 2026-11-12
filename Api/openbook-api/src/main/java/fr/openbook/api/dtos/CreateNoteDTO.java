package fr.openbook.api.dtos;

import lombok.Data;

@Data
public class CreateNoteDTO {
    private Long bookId;
    private String content;
}
