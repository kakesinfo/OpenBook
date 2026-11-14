package fr.openbook.api.controllers;

import fr.openbook.api.dtos.CreateNoteDTO;
import fr.openbook.api.dtos.NoteDTO;
import fr.openbook.api.dtos.UpdateNoteDTO;
import fr.openbook.api.entities.BookEntity;
import fr.openbook.api.entities.NoteEntity;
import fr.openbook.api.entities.UserEntity;
import fr.openbook.api.services.BookMapper;
import fr.openbook.api.services.RepositoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping({"/notes", "/user/notes"})
@RequiredArgsConstructor
public class NoteController {

    private final RepositoryService repositoryService;

    private UserEntity getAuthenticatedUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated() && !"anonymousUser".equals(authentication.getPrincipal())) {
            String username = authentication.getName();
            return repositoryService.getUserRepository().findByUsername(username)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
    }

    private NoteDTO entityToDTO(NoteEntity note) {
        if (note == null) return null;
        NoteDTO dto = new NoteDTO();
        dto.setId(note.getId());
        if (note.getBook() != null) {
            dto.setBookId(note.getBook().getId());
            dto.setBook(BookMapper.toSummaryDTO(note.getBook()));
        }
        dto.setContent(note.getContent());
        if (note.getUser() != null) {
            dto.setUsername(note.getUser().getUsername());
        }
        dto.setCreatedAt(note.getCreatedAt());
        dto.setUpdatedAt(note.getUpdatedAt());
        return dto;
    }

    @GetMapping
    public List<NoteDTO> getAllNotes(@RequestParam(value = "query", required = false) String query) {
        UserEntity user = getAuthenticatedUser();
        List<NoteEntity> notes;
        if (query != null && !query.trim().isEmpty()) {
            notes = repositoryService.getNoteRepository().searchWithBookByUserId(user.getId(), query.trim());
        } else {
            notes = repositoryService.getNoteRepository().findAllWithBookByUserIdOrderByUpdatedAtDesc(user.getId());
        }
        return notes.stream().map(this::entityToDTO).collect(Collectors.toList());
    }

    @GetMapping("/{id}")
    public NoteDTO getNoteById(@PathVariable Long id) {
        UserEntity user = getAuthenticatedUser();
        NoteEntity note = repositoryService.getNoteRepository().findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Note not found"));
        return entityToDTO(note);
    }

    @GetMapping("/book/{bookId}")
    public ResponseEntity<NoteDTO> getNoteByBookId(@PathVariable Long bookId) {
        UserEntity user = getAuthenticatedUser();
        Optional<NoteEntity> note = repositoryService.getNoteRepository().findByBookIdAndUserId(bookId, user.getId());
        return note.map(n -> ResponseEntity.ok(entityToDTO(n)))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public NoteDTO createNote(@RequestBody CreateNoteDTO createDTO) {
        UserEntity user = getAuthenticatedUser();
        if (createDTO == null || createDTO.getBookId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "bookId is required");
        }
        if (createDTO.getContent() == null || createDTO.getContent().trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "content is required");
        }

        BookEntity book = repositoryService.getBookRepository().findById(createDTO.getBookId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Book not found"));

        if (repositoryService.getNoteRepository().existsByBookIdAndUserId(createDTO.getBookId(), user.getId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Une note existe déjà pour ce livre");
        }

        NoteEntity note = new NoteEntity();
        note.setBook(book);
        note.setContent(createDTO.getContent().trim());
        note.setUser(user);

        NoteEntity saved = repositoryService.getNoteRepository().save(note);
        return entityToDTO(saved);
    }

    @PutMapping("/{id}")
    @Transactional
    public NoteDTO updateNote(@PathVariable Long id, @RequestBody UpdateNoteDTO updateDTO) {
        UserEntity user = getAuthenticatedUser();
        if (updateDTO == null || updateDTO.getContent() == null || updateDTO.getContent().trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "content is required");
        }

        NoteEntity note = repositoryService.getNoteRepository().findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Note not found"));

        note.setContent(updateDTO.getContent().trim());
        NoteEntity saved = repositoryService.getNoteRepository().save(note);
        return entityToDTO(saved);
    }

    @PutMapping("/book/{bookId}")
    @Transactional
    public NoteDTO upsertNoteByBookId(@PathVariable Long bookId, @RequestBody UpdateNoteDTO updateDTO) {
        UserEntity user = getAuthenticatedUser();
        if (updateDTO == null || updateDTO.getContent() == null || updateDTO.getContent().trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "content is required");
        }

        BookEntity book = repositoryService.getBookRepository().findById(bookId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Book not found"));

        NoteEntity note = repositoryService.getNoteRepository().findByBookIdAndUserId(bookId, user.getId())
                .orElseGet(() -> {
                    NoteEntity newNote = new NoteEntity();
                    newNote.setBook(book);
                    newNote.setUser(user);
                    return newNote;
                });

        note.setContent(updateDTO.getContent().trim());
        NoteEntity saved = repositoryService.getNoteRepository().save(note);
        return entityToDTO(saved);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void deleteNote(@PathVariable Long id) {
        UserEntity user = getAuthenticatedUser();
        NoteEntity note = repositoryService.getNoteRepository().findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Note not found"));
        repositoryService.getNoteRepository().delete(note);
    }

    @DeleteMapping("/book/{bookId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void deleteNoteByBookId(@PathVariable Long bookId) {
        UserEntity user = getAuthenticatedUser();
        Optional<NoteEntity> note = repositoryService.getNoteRepository().findByBookIdAndUserId(bookId, user.getId());
        if (note.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Note not found for this book");
        }
        repositoryService.getNoteRepository().delete(note.get());
    }
}
