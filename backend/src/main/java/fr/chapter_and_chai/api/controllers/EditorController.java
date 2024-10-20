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
    public List<EditorEntity> getAllUsers() {
        return editorService.getAllEditors();
    }

    @GetMapping("/{id}")
    public EditorEntity getUserById(@PathVariable Long id) {
        return editorService.getEditorById(id);
    }

    @PostMapping
    public EditorEntity createUser(@RequestBody EditorEntity user) {
        return editorService.saveEditor(user);
    }

    @PatchMapping
    public EditorEntity updateUser(@RequestBody EditorEntity user) {
        return editorService.saveEditor(user);
    }

    @DeleteMapping("/{id}")
    public void deleteUser(@PathVariable Long id) {
        editorService.deleteEditor(id);
    }
}