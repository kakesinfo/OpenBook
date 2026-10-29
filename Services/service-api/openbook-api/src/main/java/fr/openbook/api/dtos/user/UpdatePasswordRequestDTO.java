package fr.openbook.api.dtos.user;

import lombok.Data;

@Data
public class UpdatePasswordRequestDTO {
    private String newPassword;
    private String currentPassword;
}
