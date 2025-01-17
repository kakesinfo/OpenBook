package fr.chapter_and_chai.api.controllers;

import fr.chapter_and_chai.api.entities.BookEntity;
import fr.chapter_and_chai.api.entities.EditorEntity;
import fr.chapter_and_chai.api.services.RepositoryService;
import lombok.AllArgsConstructor;
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
@RequestMapping("/books")
@AllArgsConstructor
public class BookController {

    private RepositoryService repositoryService;

    @GetMapping
    public List<BookEntity> getAll() {
        return repositoryService.getBookRepository().findAll();
    }

    @GetMapping("/{id}")
    public BookEntity getById(@PathVariable Long id) {
        return repositoryService.getBookRepository().findById(id).orElse(null);
    }

    @PostMapping
    public BookEntity create(@RequestBody BookEntity user) {
        return repositoryService.getBookRepository().save(user);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        repositoryService.getBookRepository().deleteById(id);
    }
}