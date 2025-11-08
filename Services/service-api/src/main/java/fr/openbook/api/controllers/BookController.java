package fr.openbook.api.controllers;

import fr.openbook.api.dtos.BookDTO;
import fr.openbook.api.dtos.BookHasAuthorDTO;
import fr.openbook.api.dtos.BookSummaryDTO;
import fr.openbook.api.entities.AuthorEntity;
import fr.openbook.api.entities.AuthorTypeEntity;
import fr.openbook.api.entities.BookEntity;
import fr.openbook.api.entities.UserEntity;
import fr.openbook.api.entities.UserOwnsBookEntity;
import fr.openbook.api.repositories.BookRepository;
import fr.openbook.api.services.CollectionService;
import fr.openbook.api.services.EditorService;
import fr.openbook.api.services.RepositoryService;
import fr.openbook.api.services.SeriesService;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/books")
@RequiredArgsConstructor(onConstructor = @__(@Autowired))
public class BookController {

    private final RepositoryService repositoryService;

    @GetMapping
    public List<BookSummaryDTO> getAll() {
        return repositoryService.getBookRepository()
                .findAll()
                .stream()
                .map(this::entityToSummaryDTO)
                .collect(Collectors.toList());
    }

    @GetMapping("/newest")
    public List<BookSummaryDTO> getAllOrderedByReleaseDateDesc() {
        return getAllByReleaseDateOrderBy("desc");
    }

    @GetMapping("/oldest")
    public List<BookSummaryDTO> getAllOrderedByReleaseDateAsc() {
        return getAllByReleaseDateOrderBy("asc");
    }

    private List<BookSummaryDTO> getAllByReleaseDateOrderBy(String order) {
        final BookRepository repository = repositoryService.getBookRepository();

        List<BookEntity> books = "asc".equalsIgnoreCase(order)
                ? repository.findAllByOrderByReleaseDateAsc()
                : repository.findAllByOrderByReleaseDateDesc();

        return books.stream()
                .map(this::entityToSummaryDTO)
                .collect(Collectors.toList());
    }

    @GetMapping("/{id}")
    public BookDTO getById(
            HttpSession session,
            @PathVariable Long id,
            @RequestParam(required = false, defaultValue = "true")  boolean withSeries,
            @RequestParam(required = false, defaultValue = "false") boolean withCollection,
            @RequestParam(required = false, defaultValue = "false") boolean withEditor,
            @RequestParam(required = false, defaultValue = "false") boolean withAuthors,
            @RequestParam(required = false, defaultValue = "false") boolean withStatus
    ) {
        UserEntity userEntity = (UserEntity) session.getAttribute("user");
        if (userEntity == null) {
            throw new RuntimeException("User not logged in");
        }

        return repositoryService.getBookRepository()
                .findById(id)
                .map(bookEntity -> entityToDTO(
                    bookEntity, userEntity, withSeries, withCollection, withEditor, withAuthors, withStatus
                ))
                .orElse(null);
    }

    @GetMapping("/search/{query}")
    public List<BookSummaryDTO> search(@PathVariable String query) {
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
        dto.setCoverUrl(book.getCoverUrl());
        return dto;
    }

    private BookDTO entityToDTO(
            BookEntity bookEntity,
            UserEntity userEntity,
            boolean withSeries,
            boolean withCollection,
            boolean withEditor,
            boolean withAuthors,
            boolean withStatus
    ) {
        BookDTO dto = new BookDTO();
        dto.setId(bookEntity.getId());
        dto.setTitle(bookEntity.getTitle());
        dto.setVolume(bookEntity.getVolume());
        dto.setPrice(bookEntity.getPrice());
        dto.setReleaseDate(bookEntity.getReleaseDate().toString());
        dto.setIsbn(bookEntity.getIsbn());
        dto.setWeight(bookEntity.getWeight());
        dto.setHeight(bookEntity.getHeight());
        dto.setLength(bookEntity.getLength());
        dto.setThickness(bookEntity.getThickness());
        dto.setPageCount(bookEntity.getPageCount());
        dto.setDescription(bookEntity.getDescription());
        dto.setCoverUrl(bookEntity.getCoverUrl());

        if (withSeries)
            dto.setSeries(SeriesService.entityToDTO(bookEntity.getSeries()));

        if (withCollection)
            dto.setCollection(CollectionService.entityToDTO(bookEntity.getCollection()));

        if (withEditor)
            dto.setEditor(EditorService.entityToDTO(bookEntity.getEditor()));

        if (withAuthors) {
            List<BookHasAuthorDTO> authorsDTO = bookEntity.getBookHasAuthors()
                    .stream()
                    .map(bookHasAuthor -> {
                        AuthorEntity author = bookHasAuthor.getAuthor();
                        AuthorTypeEntity authorType = bookHasAuthor.getAuthorType();

                        BookHasAuthorDTO bookHasAuthorDto = new BookHasAuthorDTO();
                        bookHasAuthorDto.setFirstname(author.getFirstname());
                        bookHasAuthorDto.setLastname(author.getLastname());
                        bookHasAuthorDto.setType(authorType.getName());
                        return bookHasAuthorDto;
                    })
                    .toList();

            dto.setAuthors(authorsDTO);
        }

        if (withStatus) {
            dto.setStatus(repositoryService.getUserOwnsBooksRepository()
                    .findByUserIdAndBookId(userEntity.getId(), bookEntity.getId())
                    .map(UserOwnsBookEntity::getStatus)
                    .orElse(null));
        }

        System.out.println(dto);

        return dto;
    }
}