package fr.chapter_and_chai.api.controllers;

import fr.chapter_and_chai.api.entities.EditorEntity;
import fr.chapter_and_chai.api.services.EditorService;
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
        return editorService.getAllUsers();
    }

    @GetMapping("/{id}")
    public EditorEntity getUserById(@PathVariable Long id) {
        return editorService.getUserById(id);
    }

    @PostMapping
    public EditorEntity createUser(@RequestBody EditorEntity user) {
        return editorService.saveUser(user);
    }

    @DeleteMapping("/{id}")
    public void deleteUser(@PathVariable Long id) {
        editorService.deleteUser(id);
    }
}