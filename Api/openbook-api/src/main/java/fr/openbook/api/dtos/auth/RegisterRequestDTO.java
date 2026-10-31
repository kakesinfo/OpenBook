package fr.openbook.api.dtos.auth;

import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

@Getter
@Setter
public class RegisterRequestDTO implements Serializable
{
    private String username;
    private String password;
}
