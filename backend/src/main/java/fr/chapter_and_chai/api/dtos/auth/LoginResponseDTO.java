package fr.chapter_and_chai.api.dtos.auth;

import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.time.Instant;

@Getter
@Setter
public class LoginResponseDTO implements Serializable
{
    private Long id;
    private String username;
    private String firstname;
    private String lastname;
    private String email;
    private Instant created_at;
    private Instant updated_at;
}
