package fr.openbook.api.dtos.user;

import lombok.Data;

@Data
public class UpdateEmailRequestDTO {
    private String email;
    private String currentPassword;
}
