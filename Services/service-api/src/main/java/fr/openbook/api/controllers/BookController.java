package fr.openbook.api.controllers;

import fr.openbook.api.dtos.BookDTO;
import fr.openbook.api.dtos.PageDTO;
import fr.openbook.api.entities.SeriesHasThemeEntity;
import fr.openbook.api.dtos.BookHasAuthorDTO;
import fr.openbook.api.dtos.BookSummaryDTO;
import fr.openbook.api.entities.AuthorEntity;
import fr.openbook.api.entities.AuthorTypeEntity;
import fr.openbook.api.entities.BookEntity;
import fr.openbook.api.entities.UserEntity;
import fr.openbook.api.entities.BookStatusEntity;
import fr.openbook.api.entities.UserOwnsBookEntity;
import fr.openbook.api.repositories.BookRepository;
import fr.openbook.api.services.CollectionService;
import fr.openbook.api.services.EditorService;
import fr.openbook.api.services.RepositoryService;
import fr.openbook.api.services.SeriesService;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/books")
@RequiredArgsConstructor(onConstructor = @__(@Autowired))
public class BookController {

    private final RepositoryService repositoryService;

    private UserEntity getAuthenticatedUser(HttpSession session) {
        if (session != null) {
            UserEntity user = (UserEntity) session.getAttribute("user");
            if (user != null) return user;
        }
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserEntity user) {
            return user;
        }
        return null;
    }

    @GetMapping
    public List<BookSummaryDTO> getAll() {
        return repositoryService.getBookRepository()
                .findAll()
                .stream()
                .map(this::entityToSummaryDTO)
                .collect(Collectors.toList());
    }

    @GetMapping("/newest")
    public ResponseEntity<?> getAllOrderedByCreatedAtDesc(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false, defaultValue = "20") Integer size,
            @RequestParam(required = false, defaultValue = "100") Integer limit
    ) {
        return getBooksOrderedByCreatedAt("desc", page, size, limit);
    }

    @GetMapping("/oldest")
    public ResponseEntity<?> getAllOrderedByCreatedAtAsc(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false, defaultValue = "20") Integer size,
            @RequestParam(required = false, defaultValue = "100") Integer limit
    ) {
        return getBooksOrderedByCreatedAt("asc", page, size, limit);
    }

    @GetMapping("/upcoming")
    public List<BookSummaryDTO> getUpcoming() {
        ZonedDateTime now = ZonedDateTime.now(ZoneId.systemDefault());
        Instant startOfTomorrow = now.toLocalDate().plusDays(1).atStartOfDay(now.getZone()).toInstant();
        Instant endOfWindow = now.toLocalDate().plusMonths(6).atTime(LocalTime.MAX).atZone(now.getZone()).toInstant();

        return repositoryService.getBookRepository()
                .findAllByReleaseDateBetweenOrderByReleaseDateAsc(startOfTomorrow, endOfWindow)
                .stream()
                .map(this::entityToSummaryDTO)
                .collect(Collectors.toList());
    }

    @GetMapping("/recent")
    public List<BookSummaryDTO> getRecent() {
        ZonedDateTime now = ZonedDateTime.now(ZoneId.systemDefault());
        Instant startOfWindow = now.toLocalDate().minusMonths(2).atStartOfDay(now.getZone()).toInstant();
        Instant endOfToday = now.toLocalDate().atTime(LocalTime.MAX).atZone(now.getZone()).toInstant();

        return repositoryService.getBookRepository()
                .findAllByReleaseDateBetweenOrderByReleaseDateDesc(startOfWindow, endOfToday)
                .stream()
                .map(this::entityToSummaryDTO)
                .collect(Collectors.toList());
    }

    private ResponseEntity<?> getBooksOrderedByCreatedAt(String order, Integer page, Integer size, Integer limit) {
        final BookRepository repository = repositoryService.getBookRepository();

        Sort.Direction direction = "asc".equalsIgnoreCase(order) ? Sort.Direction.ASC : Sort.Direction.DESC;
        Sort sort = Sort.by(direction, "createdAt").and(Sort.by(direction, "id"));

        if (page == null) {
            Pageable pageable = (limit != null && limit > 0)
                    ? PageRequest.of(0, limit, sort)
                    : PageRequest.of(0, 100, sort);

            Page<BookEntity> books = repository.findAll(pageable);
            return ResponseEntity.ok(books.getContent().stream()
                    .map(this::entityToSummaryDTO)
                    .collect(Collectors.toList()));
        }

        int pageIndex = Math.max(0, page - 1);
        int pageSize = (size != null && size > 0) ? size : 20;
        Pageable pageable = PageRequest.of(pageIndex, pageSize, sort);

        Page<BookEntity> booksPage = repository.findAll(pageable);

        long dbTotal = booksPage.getTotalElements();
        long effectiveTotal = (limit != null && limit > 0) ? Math.min(limit, dbTotal) : dbTotal;
        int effectiveTotalPages = (int) Math.max(1, Math.ceil((double) effectiveTotal / pageSize));

        List<BookSummaryDTO> content;
        long startOffset = (long) pageIndex * pageSize;
        if (startOffset >= effectiveTotal) {
            content = Collections.emptyList();
        } else {
            long remaining = effectiveTotal - startOffset;
            int countToTake = (int) Math.min(booksPage.getContent().size(), remaining);
            content = booksPage.getContent().subList(0, Math.max(0, countToTake)).stream()
                    .map(this::entityToSummaryDTO)
                    .collect(Collectors.toList());
        }

        PageDTO<BookSummaryDTO> pageDTO = new PageDTO<>(
                content,
                effectiveTotal,
                effectiveTotalPages,
                pageIndex + 1,
                pageSize
        );

        return ResponseEntity.ok(pageDTO);
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
        UserEntity userEntity = getAuthenticatedUser(session);

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
                .searchByTitleOrIsbnOrAuthor(query)
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
        if (book.getReleaseDate() != null) {
            dto.setReleaseDate(book.getReleaseDate().toString());
        }
        if (book.getCreatedAt() != null) {
            dto.setCreatedAt(book.getCreatedAt().toString());
        }
        dto.setCoverUrl(book.getCoverUrl());
        if (book.getSeries() != null) {
            dto.setSeriesName(book.getSeries().getName());
            if (book.getSeries().getCategory() != null) {
                dto.setCategory(book.getSeries().getCategory().getName());
            }
        }
        dto.setPageCount(book.getPageCount());
        if (book.getBookHasAuthors() != null && !book.getBookHasAuthors().isEmpty()) {
            String authorStr = book.getBookHasAuthors().stream()
                    .filter(bha -> bha.getAuthor() != null)
                    .map(bha -> ((bha.getAuthor().getFirstname() != null ? bha.getAuthor().getFirstname() : "") + " "
                            + (bha.getAuthor().getLastname() != null ? bha.getAuthor().getLastname() : "")).trim())
                    .filter(s -> !s.isEmpty())
                    .distinct()
                    .collect(Collectors.joining(", "));
            dto.setAuthor(authorStr);
        }
        dto.setType(book.getType());
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
        if (bookEntity.getReleaseDate() != null) {
            dto.setReleaseDate(bookEntity.getReleaseDate().toString());
        }
        dto.setIsbn(bookEntity.getIsbn());
        dto.setWeight(bookEntity.getWeight());
        dto.setHeight(bookEntity.getHeight());
        dto.setLength(bookEntity.getLength());
        dto.setThickness(bookEntity.getThickness());
        dto.setPageCount(bookEntity.getPageCount());
        dto.setDescription(bookEntity.getDescription());
        dto.setCoverUrl(bookEntity.getCoverUrl());
        dto.setType(bookEntity.getType());

        List<String> themes = new ArrayList<>();
        if (bookEntity.getSeries() != null && bookEntity.getSeries().getId() != null) {
            List<SeriesHasThemeEntity> seriesThemes = repositoryService.getSeriesHasThemeRepository()
                    .findAllBySeriesId(bookEntity.getSeries().getId());
            for (SeriesHasThemeEntity sht : seriesThemes) {
                if (sht.getTheme() != null && sht.getTheme().getName() != null) {
                    themes.add(sht.getTheme().getName());
                }
            }
        }
        dto.setThemes(themes);

        // Previous and Next book in the same series
        if (bookEntity.getSeries() != null && bookEntity.getSeries().getId() != null) {
            List<BookEntity> seriesBooks = repositoryService.getBookRepository()
                    .findAllBySeriesId(bookEntity.getSeries().getId());

            if (seriesBooks != null && seriesBooks.size() > 1) {
                BookEntity prevBook = null;
                BookEntity nextBook = null;

                if (bookEntity.getVolume() != null) {
                    int currentVol = bookEntity.getVolume();

                    Optional<Integer> prevVol = seriesBooks.stream()
                            .map(BookEntity::getVolume)
                            .filter(v -> v != null && v < currentVol)
                            .max(Integer::compareTo);
                    if (prevVol.isPresent()) {
                        prevBook = seriesBooks.stream()
                                .filter(b -> b.getVolume() != null && b.getVolume().equals(prevVol.get()))
                                .min(Comparator.comparing(BookEntity::getId))
                                .orElse(null);
                    }

                    Optional<Integer> nextVol = seriesBooks.stream()
                            .map(BookEntity::getVolume)
                            .filter(v -> v != null && v > currentVol)
                            .min(Integer::compareTo);
                    if (nextVol.isPresent()) {
                        nextBook = seriesBooks.stream()
                                .filter(b -> b.getVolume() != null && b.getVolume().equals(nextVol.get()))
                                .min(Comparator.comparing(BookEntity::getId))
                                .orElse(null);
                    }
                } else {
                    List<BookEntity> sorted = seriesBooks.stream()
                            .sorted(Comparator.comparing(BookEntity::getReleaseDate, Comparator.nullsLast(Comparator.naturalOrder()))
                                    .thenComparing(BookEntity::getId))
                            .toList();
                    int idx = -1;
                    for (int i = 0; i < sorted.size(); i++) {
                        if (sorted.get(i).getId().equals(bookEntity.getId())) {
                            idx = i;
                            break;
                        }
                    }
                    if (idx > 0) {
                        prevBook = sorted.get(idx - 1);
                    }
                    if (idx >= 0 && idx < sorted.size() - 1) {
                        nextBook = sorted.get(idx + 1);
                    }
                }

                if (prevBook != null) {
                    dto.setPreviousBookId(prevBook.getId());
                    dto.setPreviousBook(entityToSummaryDTO(prevBook));
                }
                if (nextBook != null) {
                    dto.setNextBookId(nextBook.getId());
                    dto.setNextBook(entityToSummaryDTO(nextBook));
                }
            }
        }

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

        if (withStatus && userEntity != null) {
            dto.setStatus(repositoryService.getUserOwnsBooksRepository()
                    .findByUserIdAndBookId(userEntity.getId(), bookEntity.getId())
                    .map(UserOwnsBookEntity::getStatus)
                    .orElse(null));

            dto.setReadingStatus(repositoryService.getBookStatusRepository()
                    .findByUserIdAndBookId(userEntity.getId(), bookEntity.getId())
                    .map(BookStatusEntity::getStatus)
                    .orElse("UNREAD"));
        }

        return dto;
    }
}
