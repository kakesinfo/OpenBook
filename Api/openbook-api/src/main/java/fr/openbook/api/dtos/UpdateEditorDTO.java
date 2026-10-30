package fr.openbook.api.dtos;

import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

@Getter
@Setter
public class UpdateEditorDTO implements Serializable {
    private Long id;
    private String name;
}
