package fr.chapter_and_chai.api.dtos.editor;

import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

@Getter
@Setter
public class CreateEditorDTO implements Serializable {
    private String name;
}
