package fr.openbook.api.dtos;

import fr.openbook.api.entities.UserOwnsBookEntity;
import fr.openbook.api.entities.UserSellsBookEntity;
import lombok.Data;

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

    public static UserOwnsBookDTO from(UserSellsBookEntity entity) {
        UserOwnsBookDTO dto = new UserOwnsBookDTO();
        dto.setBookId(entity.getBook().getId());
        dto.setUserId(entity.getUser().getId());
        dto.setStatus(entity.getStatus());
        return dto;
    }
}
