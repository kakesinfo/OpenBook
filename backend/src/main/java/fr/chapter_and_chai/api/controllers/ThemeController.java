package fr.chapter_and_chai.api.controllers;

import fr.chapter_and_chai.api.entities.ThemeEntity;
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
@RequestMapping("/themes")
public class ThemeController {

    @Autowired
    private RepositoryService repositoryService;

    @GetMapping
    public List<ThemeEntity> getAll() {
        return repositoryService.getThemeRepository().findAll();
    }

    @GetMapping("/{id}")
    public ThemeEntity getById(@PathVariable Long id) {
        return repositoryService.getThemeRepository().findById(id).orElse(null);
    }

    @PostMapping
    public ThemeEntity create(@RequestBody ThemeEntity user) {
        return repositoryService.getThemeRepository().save(user);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        repositoryService.getThemeRepository().deleteById(id);
    }
}