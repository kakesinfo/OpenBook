package fr.chapter_and_chai.api.controllers;

import fr.chapter_and_chai.api.entities.AuthorEntity;
import fr.chapter_and_chai.api.entities.BookEntity;
import fr.chapter_and_chai.api.services.RepositoryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/authors")
public class AuthorController {

    @Autowired
    private RepositoryService repositoryService;

    @GetMapping
    public List<AuthorEntity> getAllUsers() {
        return repositoryService.getAuthorRepository().findAll();
    }

    @GetMapping("/{id}")
    public AuthorEntity getUserById(@PathVariable Long id) {
        return repositoryService.getAuthorRepository().findById(id).orElse(null);
    }

    @PostMapping
    public AuthorEntity createUser(@RequestBody AuthorEntity user) {
        return repositoryService.getAuthorRepository().save(user);
    }

    @DeleteMapping("/{id}")
    public void deleteUser(@PathVariable Long id) {
        repositoryService.getAuthorRepository().deleteById(id);
    }
}