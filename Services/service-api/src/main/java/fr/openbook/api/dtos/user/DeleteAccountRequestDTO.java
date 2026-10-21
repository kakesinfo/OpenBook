package fr.openbook.api.dtos.user;

import lombok.Data;

@Data
public class DeleteAccountRequestDTO {
    private String password;
    private String confirmationText;
}
