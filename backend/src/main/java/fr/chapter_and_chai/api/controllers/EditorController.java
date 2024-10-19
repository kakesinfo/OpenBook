package fr.chapter_and_chai.api.controllers;

import fr.chapter_and_chai.api.services.RepositoryService;
import fr.chapter_and_chai.api.entities.EditorEntity;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/editors")
public class EditorController {

    @Autowired
    private RepositoryService repositoryService;

    @GetMapping
    public List<EditorEntity> getAllUsers() {
        return repositoryService.getEditorRepository().findAll();
    }

    @GetMapping("/{id}")
    public EditorEntity getUserById(@PathVariable Long id) {
        return repositoryService.getEditorRepository().findById(id).orElse(null);
    }

    @PostMapping
    public EditorEntity createUser(@RequestBody EditorEntity user) {
        return repositoryService.getEditorRepository().save(user);
    }

    @DeleteMapping("/{id}")
    public void deleteUser(@PathVariable Long id) {
        repositoryService.getEditorRepository().deleteById(id);
    }
}