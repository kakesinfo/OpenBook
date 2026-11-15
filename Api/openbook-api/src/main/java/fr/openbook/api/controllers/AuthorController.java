package fr.openbook.api.controllers;

import fr.openbook.api.dtos.AuthorDTO;
import fr.openbook.api.dtos.BookSummaryDTO;
import fr.openbook.api.entities.AuthorEntity;
import fr.openbook.api.entities.BookEntity;
import fr.openbook.api.entities.BookStatusEntity;
import fr.openbook.api.entities.UserEntity;
import fr.openbook.api.entities.UserOwnsBookEntity;
import fr.openbook.api.services.AuthorDeduplicationService;
import fr.openbook.api.services.RepositoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping({"/authors", "/author"})
@RequiredArgsConstructor
public class AuthorController {

    private final RepositoryService repositoryService;
    private final AuthorDeduplicationService authorDeduplicationService;

    @PostMapping
    public ResponseEntity<AuthorDTO> createOrFindAuthor(@RequestBody AuthorDTO dto) {
        if (dto == null || ((dto.getFirstname() == null || dto.getFirstname().trim().isEmpty())
                && (dto.getLastname() == null || dto.getLastname().trim().isEmpty()))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Author firstname or lastname is required");
        }
        AuthorEntity author = authorDeduplicationService.findOrCreateAuthor(dto.getFirstname(), dto.getLastname());
        AuthorDTO res = new AuthorDTO();
        res.setId(author.getId() != null ? author.getId().longValue() : null);
        res.setFirstname(author.getFirstname());
        res.setLastname(author.getLastname());
        return ResponseEntity.ok(res);
    }

    private Optional<UserEntity> getOptionalAuthenticatedUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated() || "anonymousUser".equals(authentication.getName())) {
            return Optional.empty();
        }
        String username = authentication.getName();
        return repositoryService.getUserRepository()
                .findByUsername(username);
    }

    @GetMapping
    public List<AuthorDTO> getAll(@RequestParam(required = false) String query) {
        List<AuthorEntity> authorList = repositoryService.getAuthorRepository().findAllByOrderByLastnameAscFirstnameAsc()
                .stream()
                .filter(a -> !a.isCollectif())
                .toList();
        if (query != null && !query.trim().isEmpty()) {
            String q = query.trim().toLowerCase();
            authorList = authorList.stream()
                    .filter(a -> {
                        String first = a.getFirstname() != null ? a.getFirstname().toLowerCase() : "";
                        String last = a.getLastname() != null ? a.getLastname().toLowerCase() : "";
                        return first.contains(q) || last.contains(q) || (first + " " + last).contains(q);
                    })
                    .toList();
        }

        return authorList.stream().map(a -> {
            AuthorDTO dto = new AuthorDTO();
            dto.setId(a.getId() != null ? a.getId().longValue() : null);
            dto.setFirstname(a.getFirstname());
            dto.setLastname(a.getLastname());
            return dto;
        }).toList();
    }

    @GetMapping("/{id}")
    public AuthorDTO getById(@PathVariable Long id) {
        AuthorEntity author = repositoryService.getAuthorRepository().findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Author not found"));
        if (author.isCollectif()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Author not found");
        }

        UserEntity currentUser = getOptionalAuthenticatedUser().orElse(null);

        AuthorDTO dto = new AuthorDTO();
        dto.setId(author.getId() != null ? author.getId().longValue() : null);
        dto.setFirstname(author.getFirstname());
        dto.setLastname(author.getLastname());

        boolean isFollowed = false;
        Map<Long, String> userOwnershipMap = Collections.emptyMap();
        Map<Long, String> readingStatusMap = Collections.emptyMap();

        if (currentUser != null) {
            isFollowed = repositoryService.getUserFollowsAuthorRepository()
                    .existsByUserIdAndAuthorId(currentUser.getId(), author.getId());

            userOwnershipMap = repositoryService.getUserOwnsBooksRepository()
                    .findAllByUserId(currentUser.getId()).stream()
                    .filter(uob -> uob.getBook() != null)
                    .collect(Collectors.toMap(
                            uob -> uob.getBook().getId(),
                            UserOwnsBookEntity::getStatus,
                            (s1, s2) -> s1
                    ));

            readingStatusMap = repositoryService.getBookStatusRepository()
                    .findAllByUserId(currentUser.getId()).stream()
                    .filter(bse -> bse.getBook() != null)
                    .collect(Collectors.toMap(
                            bse -> bse.getBook().getId(),
                            BookStatusEntity::getStatus,
                            (s1, s2) -> s1
                    ));
        }

        List<BookEntity> books = repositoryService.getBookRepository()
                .findAllByAuthorIdOrderByReleaseDateAsc(author.getId());

        List<BookSummaryDTO> bookDTOs = new ArrayList<>();
        for (BookEntity book : books) {
            BookSummaryDTO bDto = entityToSummaryDTO(book);
            String ownership = userOwnershipMap.get(book.getId());
            if (ownership != null) {
                bDto.setStatus(ownership);
            }
            bDto.setReadingStatus(readingStatusMap.getOrDefault(book.getId(), "UNREAD"));
            bookDTOs.add(bDto);
        }

        dto.setIsFollowed(isFollowed);
        dto.setBooksCount(bookDTOs.size());
        dto.setBooks(bookDTOs);

        return dto;
    }

    private BookSummaryDTO entityToSummaryDTO(BookEntity book) {
        BookSummaryDTO dto = new BookSummaryDTO();
        dto.setId(book.getId());
        dto.setTitle(book.getTitle());
        dto.setVolume(book.getSeries() != null ? book.getVolume() : null);
        dto.setPrice(book.getPrice());
        if (book.getReleaseDate() != null) {
            dto.setReleaseDate(book.getReleaseDate().toString());
        }
        if (book.getCreatedAt() != null) {
            dto.setCreatedAt(book.getCreatedAt().toString());
        }
        dto.setCoverUrl(book.getCoverUrl());
        if (book.getSeries() != null) {
            dto.setSeriesId(book.getSeries().getId() != null ? book.getSeries().getId().longValue() : null);
            dto.setSeriesName(book.getSeries().getName());
            dto.setSeriesTotalVolumes(book.getSeries().getTotalVolumes());
            dto.setSeriesCoverUrl(book.getSeries().getCoverUrl());
            if (book.getSeries().getCategory() != null) {
                dto.setCategory(book.getSeries().getCategory().getName());
            }
        } else if (book.getType() != null) {
            dto.setCategory(book.getType());
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
}
