package fr.chapter_and_chai.api.controllers;

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
    public List<EditorEntity> getAll() {
        return editorService.getAllEditors();
    }

    @GetMapping("/{id}")
    public EditorEntity getById(@PathVariable Long id) {
        return editorService.getEditorById(id);
    }

    @PostMapping
    public EditorEntity create(@RequestBody EditorEntity user) {
        return editorService.saveEditor(user);
    }

    @PatchMapping
    public EditorEntity update(@RequestBody EditorEntity user) {
        return editorService.saveEditor(user);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        editorService.deleteEditor(id);
    }
}