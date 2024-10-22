package fr.chapter_and_chai.api.controllers;

import fr.chapter_and_chai.api.entities.SeriesEntity;
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
@RequestMapping("/series")
public class SeriesController {

    @Autowired
    private RepositoryService repositoryService;

    @GetMapping
    public List<SeriesEntity> getAll() {
        return repositoryService.getSeriesRepository().findAll();
    }

    @GetMapping("/{id}")
    public SeriesEntity getById(@PathVariable Long id) {
        return repositoryService.getSeriesRepository().findById(id).orElse(null);
    }

    @PostMapping
    public SeriesEntity create(@RequestBody SeriesEntity user) {
        return repositoryService.getSeriesRepository().save(user);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        repositoryService.getSeriesRepository().deleteById(id);
    }
}