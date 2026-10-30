package fr.openbook.api.dtos;

import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

@Getter
@Setter
public class CreateEditorDTO implements Serializable {
    private String name;
}
