package fr.openbook.api.dtos.editor;

import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

@Getter
@Setter
public class UpdateEditorDTO implements Serializable {
    private Long id;
    private String name;
}
