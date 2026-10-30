package fr.openbook.api.dtos.user;

import lombok.Data;

@Data
public class UpdateProfileRequestDTO {
    private String username;
    private String avatar;
}
