package fr.openbook.api.dtos;

import fr.openbook.api.entities.UserOwnsBookEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.awt.print.Book;
import java.util.ArrayList;
import java.util.List;

@Data
public class UserOwnsBookDTO {
    private Long bookId;
    private Long userId;
    private String status;

    public static UserOwnsBookDTO from(UserOwnsBookEntity entity) {
        UserOwnsBookDTO dto = new UserOwnsBookDTO();
        dto.setBookId(entity.getBook().getId());
        dto.setUserId(entity.getUser().getId());
        dto.setStatus(entity.getStatus());
        return dto;
    }
}
