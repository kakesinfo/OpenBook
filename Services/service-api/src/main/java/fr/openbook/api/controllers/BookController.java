package fr.openbook.api.controllers;

import fr.openbook.api.dtos.book.BookDTO;
import fr.openbook.api.dtos.book.BookSummaryDTO;
import fr.openbook.api.entities.BookEntity;
import fr.openbook.api.services.RepositoryService;
import lombok.AllArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/books")
@AllArgsConstructor
public class BookController {

    private RepositoryService repositoryService;

    @GetMapping
    public List<BookSummaryDTO> getAll() {
        return repositoryService.getBookRepository()
                .findAll()
                .stream()
                .map(this::entityToSummaryDTO)
                .collect(Collectors.toList());
    }

    @GetMapping("/{id}")
    public BookDTO getById(@PathVariable Long id) {
        return repositoryService.getBookRepository()
                .findById(id)
                .map(this::entityToDTO)
                .orElse(null);
    }

    @GetMapping("/search/{query}")
    public List<BookSummaryDTO> search(@PathVariable String query) {
        // TODO: Add pagination
        // TODO: Add sorting
        // TODO: Add filtering
        // TODO: Add search by author
        // TODO: Add search by series title
        return repositoryService.getBookRepository()
                .findAllByTitleContainingIgnoreCaseOrIsbn(query, query)
                .stream()
                .map(this::entityToSummaryDTO)
                .collect(Collectors.toList());
    }

    @PostMapping
    public BookEntity create(@RequestBody BookEntity book) {
        return repositoryService.getBookRepository().save(book);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        repositoryService.getBookRepository().deleteById(id);
    }

    private BookSummaryDTO entityToSummaryDTO(BookEntity book) {
        BookSummaryDTO dto = new BookSummaryDTO();
        dto.setId(book.getId());
        dto.setTitle(book.getTitle());
        dto.setVolume(book.getVolume());
        dto.setPrice(book.getPrice());
        dto.setReleaseDate(book.getReleaseDate().toString());
        return dto;
    }

    private BookDTO entityToDTO(BookEntity book) {
        BookDTO dto = new BookDTO();
        dto.setId(book.getId());
        dto.setTitle(book.getTitle());
        dto.setVolume(book.getVolume());
        dto.setPrice(book.getPrice());
        dto.setReleaseDate(book.getReleaseDate().toString());
        dto.setIsbn(book.getIsbn());
        dto.setWeight(book.getWeight());
        dto.setHeight(book.getHeight());
        dto.setLength(book.getLength());
        dto.setThickness(book.getThickness());
        dto.setPageCount(book.getPageCount());
        dto.setDescription(book.getDescription());
        System.out.println(dto);
        return dto;
    }
}