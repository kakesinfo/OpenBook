package fr.openbook.api.controllers;

import fr.openbook.api.dtos.BookSummaryDTO;
import fr.openbook.api.dtos.CreateWordDTO;
import fr.openbook.api.dtos.UpdateWordDTO;
import fr.openbook.api.dtos.WordDTO;
import fr.openbook.api.entities.BookEntity;
import fr.openbook.api.entities.BookHasWordEntity;
import fr.openbook.api.entities.WordEntity;
import fr.openbook.api.services.BookMapper;
import fr.openbook.api.services.RepositoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping({"/words", "/glossary"})
@RequiredArgsConstructor
public class WordController {

    private final RepositoryService repositoryService;

    private WordDTO entityToDTO(WordEntity wordEntity) {
        if (wordEntity == null) return null;
        WordDTO dto = new WordDTO();
        dto.setId(wordEntity.getId());
        dto.setWord(wordEntity.getWord());
        dto.setDefinition(wordEntity.getDefinition());
        dto.setCreatedAt(wordEntity.getCreatedAt());
        dto.setUpdatedAt(wordEntity.getUpdatedAt());

        List<BookSummaryDTO> books = new ArrayList<>();
        if (wordEntity.getBookHasWords() != null) {
            for (BookHasWordEntity bhw : wordEntity.getBookHasWords()) {
                if (bhw.getBook() != null) {
                    books.add(BookMapper.toSummaryDTO(bhw.getBook()));
                }
            }
        }
        dto.setBooks(books);
        return dto;
    }

    @GetMapping
    public List<WordDTO> getAllWords(
            @RequestParam(value = "query", required = false) String query,
            @RequestParam(value = "bookId", required = false) Long bookId
    ) {
        if (bookId != null) {
            List<WordEntity> words = repositoryService.getWordRepository().findAllByBookId(bookId);
            return words.stream().map(this::entityToDTO).collect(Collectors.toList());
        }

        List<WordEntity> words;
        if (query != null && !query.trim().isEmpty()) {
            words = repositoryService.getWordRepository().searchWithBooks(query.trim());
        } else {
            words = repositoryService.getWordRepository().findAllWithBooksOrderByWordAsc();
        }
        return words.stream().map(this::entityToDTO).collect(Collectors.toList());
    }

    @GetMapping("/{id}")
    public WordDTO getWordById(@PathVariable Long id) {
        WordEntity word = repositoryService.getWordRepository().findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Word not found"));
        return entityToDTO(word);
    }

    @GetMapping("/book/{bookId}")
    public List<WordDTO> getWordsByBookId(@PathVariable Long bookId) {
        List<BookHasWordEntity> bhws = repositoryService.getBookHasWordRepository().findAllByBookIdWithWord(bookId);
        return bhws.stream()
                .map(BookHasWordEntity::getWord)
                .filter(Objects::nonNull)
                .distinct()
                .map(this::entityToDTO)
                .collect(Collectors.toList());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public WordDTO createWord(@RequestBody CreateWordDTO createDTO) {
        if (createDTO == null || createDTO.getWord() == null || createDTO.getWord().trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "word is required");
        }
        if (createDTO.getDefinition() == null || createDTO.getDefinition().trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "definition is required");
        }

        String cleanWord = createDTO.getWord().trim();
        if (repositoryService.getWordRepository().existsByWordIgnoreCase(cleanWord)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ce mot existe déjà dans le glossaire");
        }

        WordEntity word = new WordEntity();
        word.setWord(cleanWord);
        word.setDefinition(createDTO.getDefinition().trim());
        WordEntity savedWord = repositoryService.getWordRepository().save(word);

        if (createDTO.getBookIds() != null && !createDTO.getBookIds().isEmpty()) {
            List<BookHasWordEntity> links = new ArrayList<>();
            for (Long bookId : createDTO.getBookIds()) {
                Optional<BookEntity> bookOpt = repositoryService.getBookRepository().findById(bookId);
                if (bookOpt.isPresent()) {
                    BookHasWordEntity bhw = new BookHasWordEntity();
                    bhw.setWord(savedWord);
                    bhw.setBook(bookOpt.get());
                    links.add(bhw);
                }
            }
            if (!links.isEmpty()) {
                repositoryService.getBookHasWordRepository().saveAll(links);
                savedWord.setBookHasWords(links);
            }
        }

        return entityToDTO(savedWord);
    }

    @PutMapping("/{id}")
    @Transactional
    public WordDTO updateWord(@PathVariable Long id, @RequestBody UpdateWordDTO updateDTO) {
        if (updateDTO == null || updateDTO.getWord() == null || updateDTO.getWord().trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "word is required");
        }
        if (updateDTO.getDefinition() == null || updateDTO.getDefinition().trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "definition is required");
        }

        WordEntity word = repositoryService.getWordRepository().findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Word not found"));

        String cleanWord = updateDTO.getWord().trim();
        if (repositoryService.getWordRepository().existsByWordIgnoreCaseAndIdNot(cleanWord, id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Un autre mot avec ce terme existe déjà");
        }

        word.setWord(cleanWord);
        word.setDefinition(updateDTO.getDefinition().trim());

        if (updateDTO.getBookIds() != null) {
            // Synchronize books
            List<BookHasWordEntity> existingLinks = repositoryService.getBookHasWordRepository().findAllByWordId(id);
            Set<Long> targetBookIds = new HashSet<>(updateDTO.getBookIds());

            // Remove links not in target
            for (BookHasWordEntity link : existingLinks) {
                if (link.getBook() != null && !targetBookIds.contains(link.getBook().getId())) {
                    repositoryService.getBookHasWordRepository().delete(link);
                }
            }

            // Add new links
            Set<Long> currentBookIds = existingLinks.stream()
                    .map(l -> l.getBook() != null ? l.getBook().getId() : null)
                    .filter(Objects::nonNull)
                    .collect(Collectors.toSet());

            List<BookHasWordEntity> newLinks = new ArrayList<>();
            for (Long bId : targetBookIds) {
                if (!currentBookIds.contains(bId)) {
                    Optional<BookEntity> bookOpt = repositoryService.getBookRepository().findById(bId);
                    if (bookOpt.isPresent()) {
                        BookHasWordEntity bhw = new BookHasWordEntity();
                        bhw.setWord(word);
                        bhw.setBook(bookOpt.get());
                        newLinks.add(bhw);
                    }
                }
            }
            if (!newLinks.isEmpty()) {
                repositoryService.getBookHasWordRepository().saveAll(newLinks);
            }
        }

        WordEntity updated = repositoryService.getWordRepository().save(word);
        // Refresh associations
        List<BookHasWordEntity> updatedLinks = repositoryService.getBookHasWordRepository().findAllByWordIdWithBook(id);
        updated.setBookHasWords(updatedLinks);

        return entityToDTO(updated);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void deleteWord(@PathVariable Long id) {
        if (!repositoryService.getWordRepository().existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Word not found");
        }
        repositoryService.getBookHasWordRepository().deleteAllByWordId(id);
        repositoryService.getWordRepository().deleteById(id);
    }

    @PostMapping("/{id}/books/{bookId}")
    @Transactional
    public WordDTO associateBook(@PathVariable Long id, @PathVariable Long bookId) {
        WordEntity word = repositoryService.getWordRepository().findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Word not found"));

        BookEntity book = repositoryService.getBookRepository().findById(bookId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Book not found"));

        Optional<BookHasWordEntity> existing = repositoryService.getBookHasWordRepository().findByBookIdAndWordId(bookId, id);
        if (existing.isEmpty()) {
            BookHasWordEntity bhw = new BookHasWordEntity();
            bhw.setWord(word);
            bhw.setBook(book);
            repositoryService.getBookHasWordRepository().save(bhw);
        }

        List<BookHasWordEntity> updatedLinks = repositoryService.getBookHasWordRepository().findAllByWordIdWithBook(id);
        word.setBookHasWords(updatedLinks);
        return entityToDTO(word);
    }

    @DeleteMapping("/{id}/books/{bookId}")
    @Transactional
    public WordDTO dissociateBook(@PathVariable Long id, @PathVariable Long bookId) {
        WordEntity word = repositoryService.getWordRepository().findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Word not found"));

        Optional<BookHasWordEntity> existing = repositoryService.getBookHasWordRepository().findByBookIdAndWordId(bookId, id);
        existing.ifPresent(repositoryService.getBookHasWordRepository()::delete);

        List<BookHasWordEntity> updatedLinks = repositoryService.getBookHasWordRepository().findAllByWordIdWithBook(id);
        word.setBookHasWords(updatedLinks);
        return entityToDTO(word);
    }
}
