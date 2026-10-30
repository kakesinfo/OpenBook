package fr.openbook.api.dtos.setup;

import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

@Getter
@Setter
public class SetupAdminRequestDTO implements Serializable {
    private String username;
    private String password;
}
