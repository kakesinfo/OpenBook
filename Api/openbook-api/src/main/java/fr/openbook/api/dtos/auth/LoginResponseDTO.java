package fr.openbook.api.dtos.auth;

import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.time.Instant;

@Getter
@Setter
public class LoginResponseDTO implements Serializable
{
    private String token;
    private long expiresIn;
    private String role;
}
