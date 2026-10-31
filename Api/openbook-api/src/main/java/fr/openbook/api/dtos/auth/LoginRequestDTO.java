package fr.openbook.api.dtos.auth;

import jakarta.persistence.Column;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.time.Instant;

@Getter
@Setter
public class LoginRequestDTO implements Serializable
{
    private String username;
    private String password;
}
