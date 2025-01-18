package fr.chapter_and_chai.api.dtos.auth;

import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

@Getter
@Setter
public class RegisterRequestDTO implements Serializable
{
    private String username;
    private String firstname;
    private String lastname;
    private String email;
    private String password;
}
