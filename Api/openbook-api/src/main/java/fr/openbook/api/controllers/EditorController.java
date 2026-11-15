package fr.openbook.api.controllers;

import fr.openbook.api.dtos.BookSummaryDTO;
import fr.openbook.api.dtos.EditorDTO;
import fr.openbook.api.entities.BookEntity;
import fr.openbook.api.entities.BookStatusEntity;
import fr.openbook.api.entities.EditorEntity;
import fr.openbook.api.entities.UserEntity;
import fr.openbook.api.entities.UserOwnsBookEntity;
import fr.openbook.api.services.RepositoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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
@RequestMapping({"/editors", "/editor"})
@RequiredArgsConstructor
public class EditorController {

    private final RepositoryService repositoryService;

    private Optional<UserEntity> getOptionalAuthenticatedUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated() || "anonymousUser".equals(authentication.getName())) {
            return Optional.empty();
        }
        return repositoryService.getUserRepository().findByUsername(authentication.getName());
    }

    @GetMapping
    public List<EditorDTO> getAll(@RequestParam(required = false) String query) {
        List<EditorEntity> editorList = repositoryService.getEditorRepository().findAllByOrderByNameAsc();
        if (query != null && !query.trim().isEmpty()) {
            String q = query.trim().toLowerCase();
            editorList = editorList.stream()
                    .filter(e -> e.getName() != null && e.getName().toLowerCase().contains(q))
                    .toList();
        }

        return editorList.stream().map(e -> {
            EditorDTO dto = new EditorDTO();
            dto.setId(e.getId());
            dto.setName(e.getName());
            return dto;
        }).toList();
    }

    @GetMapping("/{id}")
    public EditorDTO getById(@PathVariable Long id) {
        EditorEntity editor = repositoryService.getEditorRepository().findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Editor not found"));

        UserEntity currentUser = getOptionalAuthenticatedUser().orElse(null);

        EditorDTO dto = new EditorDTO();
        dto.setId(editor.getId());
        dto.setName(editor.getName());

        boolean isFollowed = false;
        Map<Long, String> userOwnershipMap = Collections.emptyMap();
        Map<Long, String> readingStatusMap = Collections.emptyMap();

        if (currentUser != null) {
            isFollowed = repositoryService.getUserFollowsEditorRepository()
                    .existsByUserIdAndEditorId(currentUser.getId(), editor.getId());

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
                .findAllByEditorIdOrderByReleaseDateDescIdAsc(editor.getId());

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
