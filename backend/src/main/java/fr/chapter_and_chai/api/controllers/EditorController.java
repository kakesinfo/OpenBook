package fr.chapter_and_chai.api.controllers;

import fr.chapter_and_chai.api.dtos.editor.CreateEditorDTO;
import fr.chapter_and_chai.api.dtos.editor.EditorDTO;
import fr.chapter_and_chai.api.dtos.editor.UpdateEditorDTO;
import fr.chapter_and_chai.api.services.EditorService;
import fr.chapter_and_chai.api.entities.EditorEntity;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/editors")
public class EditorController {

    @Autowired
    private EditorService editorService;

    @GetMapping
    public List<EditorDTO> getAll() {
        return editorService.getAllEditors();
    }

    @GetMapping("/{id}")
    public EditorDTO getById(@PathVariable Long id) {
        return editorService.getEditorById(id);
    }

    @PostMapping
    public EditorDTO create(@RequestBody CreateEditorDTO editorDTO) {
        return editorService.createEditor(editorDTO);
    }

    @PatchMapping
    public EditorDTO update(@RequestBody UpdateEditorDTO editorDTO) {
        return editorService.updateEditor(editorDTO);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        editorService.deleteEditor(id);
    }
}