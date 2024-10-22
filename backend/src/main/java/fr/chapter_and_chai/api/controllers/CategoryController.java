package fr.chapter_and_chai.api.controllers;

import fr.chapter_and_chai.api.entities.AuthorEntity;
import fr.chapter_and_chai.api.entities.CategoryEntity;
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
@RequestMapping("/categories")
public class CategoryController {

    @Autowired
    private RepositoryService repositoryService;

    @GetMapping
    public List<CategoryEntity> getAll() {
        return repositoryService.getCategoryRepository().findAll();
    }

    @GetMapping("/{id}")
    public CategoryEntity getById(@PathVariable Long id) {
        return repositoryService.getCategoryRepository().findById(id).orElse(null);
    }

    @PostMapping
    public CategoryEntity create(@RequestBody CategoryEntity user) {
        return repositoryService.getCategoryRepository().save(user);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        repositoryService.getCategoryRepository().deleteById(id);
    }
}