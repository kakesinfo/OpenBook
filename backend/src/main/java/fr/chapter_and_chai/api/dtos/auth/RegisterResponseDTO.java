package fr.chapter_and_chai.api.dtos.auth;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

@Getter
@Setter
@AllArgsConstructor
public class RegisterResponseDTO implements Serializable
{
    private Long id;
}
