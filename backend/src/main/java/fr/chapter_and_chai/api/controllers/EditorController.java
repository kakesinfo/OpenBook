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
    public List<EditorEntity> getAllEditors() {
        return editorService.getAllEditors();
    }

    @GetMapping("/{id}")
    public EditorEntity getEditorById(@PathVariable Long id) {
        return editorService.getEditorById(id);
    }

    @PostMapping
    public EditorEntity createEditor(@RequestBody EditorEntity user) {
        return editorService.saveEditor(user);
    }

    @PatchMapping
    public EditorEntity updateEditor(@RequestBody EditorEntity user) {
        return editorService.saveEditor(user);
    }

    @DeleteMapping("/{id}")
    public void deleteEditor(@PathVariable Long id) {
        editorService.deleteEditor(id);
    }
}