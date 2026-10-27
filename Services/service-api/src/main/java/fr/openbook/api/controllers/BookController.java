package fr.openbook.api.controllers;

import fr.openbook.api.dtos.AuthorDTO;
import fr.openbook.api.dtos.BookDTO;
import fr.openbook.api.dtos.BookHasAuthorDTO;
import fr.openbook.api.dtos.BookSummaryDTO;
import fr.openbook.api.dtos.CollectionDTO;
import fr.openbook.api.dtos.EditorDTO;
import fr.openbook.api.dtos.PageDTO;
import fr.openbook.api.dtos.SetBookSeriesDTO;
import fr.openbook.api.dtos.UpdateBookDTO;
import fr.openbook.api.entities.AuthorEntity;
import fr.openbook.api.entities.AuthorTypeEntity;
import fr.openbook.api.entities.BookEntity;
import fr.openbook.api.entities.BookHasAuthorEntity;
import fr.openbook.api.entities.BookStatusEntity;
import fr.openbook.api.entities.CollectionEntity;
import fr.openbook.api.entities.EditorEntity;
import fr.openbook.api.entities.SeriesEntity;
import fr.openbook.api.entities.SeriesHasThemeEntity;
import fr.openbook.api.entities.UserEntity;
import fr.openbook.api.entities.UserOwnsBookEntity;
import fr.openbook.api.entities.UserSellsBookEntity;
import fr.openbook.api.repositories.BookRepository;
import fr.openbook.api.services.CollectionService;
import fr.openbook.api.services.EditorService;
import fr.openbook.api.services.RepositoryService;
import fr.openbook.api.services.SeriesService;
import fr.openbook.api.services.media.MediaServiceClient;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/books")
@RequiredArgsConstructor(onConstructor = @__(@Autowired))
public class BookController {

    private final RepositoryService repositoryService;
    private final MediaServiceClient mediaServiceClient;

    private UserEntity getAuthenticatedUser(HttpSession session) {
        if (session != null) {
            UserEntity user = (UserEntity) session.getAttribute("user");
            if (user != null) return user;
        }
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserEntity user) {
            return user;
        }
        if (auth != null && auth.isAuthenticated() && auth.getName() != null) {
            return repositoryService.getUserRepository()
                    .findByUsername(auth.getName())
                    .or(() -> repositoryService.getUserRepository().findByEmail(auth.getName()))
                    .orElse(null);
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

    @GetMapping("/metadata-options")
    public Map<String, Object> getMetadataOptions() {
        List<AuthorDTO> authors = repositoryService.getAuthorRepository()
                .findAllByOrderByLastnameAscFirstnameAsc()
                .stream()
                .map(a -> {
                    AuthorDTO dto = new AuthorDTO();
                    dto.setId(a.getId() != null ? a.getId().longValue() : null);
                    dto.setFirstname(a.getFirstname());
                    dto.setLastname(a.getLastname());
                    return dto;
                })
                .toList();

        List<EditorDTO> editors = repositoryService.getEditorRepository()
                .findAllByOrderByNameAsc()
                .stream()
                .map(EditorService::entityToDTO)
                .toList();

        List<CollectionDTO> collections = repositoryService.getCollectionRepository()
                .findAllByOrderByNameAsc()
                .stream()
                .map(CollectionService::entityToDTO)
                .toList();

        return Map.of(
                "authors", authors,
                "editors", editors,
                "collections", collections
        );
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
    public List<BookSummaryDTO> getUpcoming(
            HttpSession session,
            @RequestParam(required = false, defaultValue = "false") boolean all
    ) {
        UserEntity user = getAuthenticatedUser(session);
        ZonedDateTime now = ZonedDateTime.now(ZoneId.systemDefault());
        Instant startOfTomorrow = now.toLocalDate().plusDays(1).atStartOfDay(now.getZone()).toInstant();
        Instant endOfWindow = now.toLocalDate().plusMonths(6).atTime(LocalTime.MAX).atZone(now.getZone()).toInstant();

        if (all) {
            return repositoryService.getBookRepository()
                    .findAllByReleaseDateBetweenOrderByReleaseDateAsc(startOfTomorrow, endOfWindow)
                    .stream()
                    .map(this::entityToSummaryDTO)
                    .collect(Collectors.toList());
        }

        if (user == null) {
            return Collections.emptyList();
        }

        return repositoryService.getBookRepository()
                .findPlanningUpcomingForUser(user.getId(), startOfTomorrow, endOfWindow)
                .stream()
                .map(this::entityToSummaryDTO)
                .collect(Collectors.toList());
    }

    @GetMapping("/recent")
    public List<BookSummaryDTO> getRecent(
            HttpSession session,
            @RequestParam(required = false, defaultValue = "false") boolean all
    ) {
        UserEntity user = getAuthenticatedUser(session);
        ZonedDateTime now = ZonedDateTime.now(ZoneId.systemDefault());
        Instant startOfWindow = now.toLocalDate().minusMonths(2).atStartOfDay(now.getZone()).toInstant();
        Instant endOfToday = now.toLocalDate().atTime(LocalTime.MAX).atZone(now.getZone()).toInstant();

        if (all) {
            return repositoryService.getBookRepository()
                    .findAllByReleaseDateBetweenOrderByReleaseDateDesc(startOfWindow, endOfToday)
                    .stream()
                    .map(this::entityToSummaryDTO)
                    .collect(Collectors.toList());
        }

        if (user == null) {
            return Collections.emptyList();
        }

        return repositoryService.getBookRepository()
                .findPlanningRecentForUser(user.getId(), startOfWindow, endOfToday)
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

    @GetMapping("/search")
    public List<BookSummaryDTO> searchWithParam(@RequestParam(name = "query", required = false) String query) {
        return performSearch(query);
    }

    @GetMapping("/search/{query}")
    public List<BookSummaryDTO> searchWithPath(@PathVariable String query) {
        return performSearch(query);
    }

    private List<BookSummaryDTO> performSearch(String rawQuery) {
        if (rawQuery == null || rawQuery.trim().isEmpty()) {
            return Collections.emptyList();
        }

        String trimmed = rawQuery.trim();
        String queryApos = trimmed.replace('’', '\'');

        String cleanDigits = trimmed.replaceAll("[^0-9Xx]", "");
        // If 18 digits (e.g. EAN-13 + EAN-5 barcode addon) starting with 978 or 979, extract 13-digit ISBN
        if (cleanDigits.length() > 13 && (cleanDigits.startsWith("978") || cleanDigits.startsWith("979"))) {
            cleanDigits = cleanDigits.substring(0, 13);
        }

        String cleanIsbn = "";
        String altIsbn = "";
        if (cleanDigits.length() == 10) {
            cleanIsbn = cleanDigits.toUpperCase();
            altIsbn = isbn10ToIsbn13(cleanIsbn);
        } else if (cleanDigits.length() == 13) {
            cleanIsbn = cleanDigits;
            altIsbn = isbn13ToIsbn10(cleanIsbn);
        } else if (cleanDigits.length() >= 8 && cleanDigits.length() <= 14) {
            cleanIsbn = cleanDigits;
        }

        return repositoryService.getBookRepository()
                .searchBooks(queryApos, trimmed, cleanIsbn, altIsbn)
                .stream()
                .map(this::entityToSummaryDTO)
                .collect(Collectors.toList());
    }

    private static String isbn10ToIsbn13(String isbn10) {
        if (isbn10 == null) return "";
        String clean = isbn10.replaceAll("[^0-9Xx]", "");
        if (clean.length() != 10) return "";
        String core = "978" + clean.substring(0, 9);
        int sum = 0;
        for (int i = 0; i < 12; i++) {
            int d = core.charAt(i) - '0';
            sum += (i % 2 == 0) ? d : d * 3;
        }
        int check = (10 - (sum % 10)) % 10;
        return core + check;
    }

    private static String isbn13ToIsbn10(String isbn13) {
        if (isbn13 == null) return "";
        String clean = isbn13.replaceAll("[^0-9Xx]", "");
        if (clean.length() != 13 || !clean.startsWith("978")) return "";
        String core = clean.substring(3, 12);
        int sum = 0;
        for (int i = 0; i < 9; i++) {
            int d = core.charAt(i) - '0';
            sum += d * (10 - i);
        }
        int check = (11 - (sum % 11)) % 11;
        char checkChar = (check == 10) ? 'X' : (char) ('0' + check);
        return core + checkChar;
    }

    @PostMapping
    public BookEntity create(@RequestBody BookEntity book) {
        return repositoryService.getBookRepository().save(book);
    }

    @PutMapping("/{id}")
    @Transactional
    public BookDTO updateBook(
            HttpSession session,
            @PathVariable Long id,
            @RequestBody UpdateBookDTO req
    ) {
        UserEntity user = getAuthenticatedUser(session);
        BookEntity book = repositoryService.getBookRepository().findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Album introuvable"));

        if (req.getTitle() != null) {
            String cleanTitle = req.getTitle().trim();
            if (cleanTitle.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le titre de l'album ne peut pas être vide");
            }
            if (repositoryService.getBookRepository().findByTitleIgnoreCaseAndIdNot(cleanTitle, id).isPresent()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Un autre album possède déjà ce titre (« " + cleanTitle + " »)");
            }
            book.setTitle(cleanTitle);
        }

        if (req.getIsbn() != null) {
            String cleanIsbn = req.getIsbn().trim();
            if (cleanIsbn.isEmpty()) {
                book.setIsbn(null);
            } else {
                if (repositoryService.getBookRepository().findByIsbnAndIdNot(cleanIsbn, id).isPresent()) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Cet ISBN / EAN (« " + cleanIsbn + " ») est déjà attribué à un autre album");
                }
                book.setIsbn(cleanIsbn);
            }
        }

        book.setPageCount(req.getPageCount() != null && req.getPageCount() > 0 ? req.getPageCount() : 0);
        book.setWeight(req.getWeight() != null && req.getWeight() > 0 ? req.getWeight() : 0);
        book.setHeight(req.getHeight() != null && req.getHeight() > 0 ? req.getHeight() : 0);
        book.setLength(req.getLength() != null && req.getLength() > 0 ? req.getLength() : 0);
        book.setThickness(req.getThickness() != null && req.getThickness() > 0 ? req.getThickness() : 0);
        book.setPrice(req.getPrice() != null && req.getPrice() >= 0 ? req.getPrice() : 0);

        if (req.getType() != null) {
            String cleanType = req.getType().trim();
            book.setType(cleanType.isEmpty() ? null : cleanType);
        }

        if (req.getDescription() != null) {
            String cleanDesc = req.getDescription().trim();
            book.setDescription(cleanDesc.isEmpty() ? null : cleanDesc);
        }

        if (req.getReleaseDate() != null) {
            String rawDate = req.getReleaseDate().trim();
            if (rawDate.isEmpty()) {
                book.setReleaseDate(null);
            } else {
                try {
                    if (rawDate.length() >= 10) {
                        LocalDate ld = LocalDate.parse(rawDate.substring(0, 10));
                        book.setReleaseDate(ld.atTime(12, 0).atZone(ZoneId.of("UTC")).toInstant());
                    } else {
                        book.setReleaseDate(Instant.parse(rawDate));
                    }
                } catch (Exception e) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Format de date de sortie invalide");
                }
            }
        }

        // Series & volume update: no series = no volume (tomaison)
        if (Boolean.TRUE.equals(req.getClearSeries())) {
            book.setSeries(null);
            book.setVolume(null);
        } else if (req.getSeriesId() != null) {
            SeriesEntity series = repositoryService.getSeriesRepository().findById(req.getSeriesId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Série introuvable"));
            book.setSeries(series);
            if (req.getVolume() != null) {
                book.setVolume(req.getVolume());
            }
        } else if (book.getSeries() == null) {
            book.setVolume(null);
        } else if (req.getVolume() != null) {
            book.setVolume(req.getVolume());
        }

        // Editor update
        if (req.getEditorName() != null) {
            String cleanEditor = req.getEditorName().trim();
            if (cleanEditor.isEmpty()) {
                book.setEditor(null);
            } else {
                EditorEntity editor = repositoryService.getEditorRepository()
                        .findByNameIgnoreCase(cleanEditor)
                        .orElseGet(() -> {
                            EditorEntity newEditor = new EditorEntity();
                            newEditor.setName(cleanEditor);
                            return repositoryService.getEditorRepository().save(newEditor);
                        });
                book.setEditor(editor);
            }
        }

        // Collection update
        if (req.getCollectionName() != null) {
            String cleanCollection = req.getCollectionName().trim();
            if (cleanCollection.isEmpty()) {
                book.setCollection(null);
            } else {
                CollectionEntity collection = repositoryService.getCollectionRepository()
                        .findByNameIgnoreCase(cleanCollection)
                        .orElseGet(() -> {
                            CollectionEntity newCol = new CollectionEntity();
                            newCol.setName(cleanCollection);
                            return repositoryService.getCollectionRepository().save(newCol);
                        });
                book.setCollection(collection);
            }
        }

        // Authors update (Scénaristes / Dessinateurs / Coloristes)
        if (req.getAuthors() != null) {
            if (book.getBookHasAuthors() == null) {
                book.setBookHasAuthors(new ArrayList<>());
            }

            Map<String, BookHasAuthorEntity> desiredMap = new LinkedHashMap<>();

            for (BookHasAuthorDTO aDto : req.getAuthors()) {
                if (aDto == null) continue;
                String fn = aDto.getFirstname() != null ? aDto.getFirstname().trim() : "";
                String ln = aDto.getLastname() != null ? aDto.getLastname().trim() : "";

                if (ln.isEmpty() && !fn.isEmpty()) {
                    int lastSpace = fn.lastIndexOf(' ');
                    if (lastSpace > 0) {
                        ln = fn.substring(lastSpace + 1).trim();
                        fn = fn.substring(0, lastSpace).trim();
                    } else {
                        ln = fn;
                        fn = "";
                    }
                }
                if (ln.isEmpty()) {
                    continue;
                }

                final String finalFn = fn;
                final String finalLn = ln;

                AuthorEntity author = repositoryService.getAuthorRepository()
                        .findByFirstnameIgnoreCaseAndLastnameIgnoreCase(finalFn, finalLn)
                        .orElseGet(() -> {
                            AuthorEntity newAuthor = new AuthorEntity();
                            newAuthor.setFirstname(finalFn);
                            newAuthor.setLastname(finalLn);
                            return repositoryService.getAuthorRepository().save(newAuthor);
                        });

                String rawRole = aDto.getType() != null ? aDto.getType().trim().toLowerCase() : "writer";
                final String targetTypeName;
                if (rawRole.contains("illustrator") || rawRole.contains("dessin") || rawRole.contains("pencil") || rawRole.contains("artist")) {
                    targetTypeName = "Illustrator";
                } else if (rawRole.contains("color") || rawRole.contains("couleur")) {
                    targetTypeName = "Colorist";
                } else {
                    targetTypeName = "Writer";
                }

                AuthorTypeEntity authorType = repositoryService.getAuthorTypeRepository()
                        .findByNameIgnoreCase(targetTypeName)
                        .orElseGet(() -> {
                            AuthorTypeEntity newType = new AuthorTypeEntity();
                            newType.setName(targetTypeName);
                            return repositoryService.getAuthorTypeRepository().save(newType);
                        });

                String key = author.getId() + "_" + authorType.getId();
                if (!desiredMap.containsKey(key)) {
                    BookHasAuthorEntity bha = new BookHasAuthorEntity();
                    bha.setBook(book);
                    bha.setAuthor(author);
                    bha.setAuthorType(authorType);
                    desiredMap.put(key, bha);
                }
            }

            Set<String> desiredKeys = desiredMap.keySet();
            book.getBookHasAuthors().removeIf(existing -> {
                if (existing.getAuthor() == null || existing.getAuthorType() == null) return true;
                String k = existing.getAuthor().getId() + "_" + existing.getAuthorType().getId();
                return !desiredKeys.contains(k);
            });

            Set<String> existingKeys = book.getBookHasAuthors().stream()
                    .filter(e -> e.getAuthor() != null && e.getAuthorType() != null)
                    .map(e -> e.getAuthor().getId() + "_" + e.getAuthorType().getId())
                    .collect(Collectors.toSet());

            for (Map.Entry<String, BookHasAuthorEntity> entry : desiredMap.entrySet()) {
                if (!existingKeys.contains(entry.getKey())) {
                    book.getBookHasAuthors().add(entry.getValue());
                }
            }
        }

        book = repositoryService.getBookRepository().save(book);
        return entityToDTO(book, user, true, true, true, true, true);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        repositoryService.getBookRepository().deleteById(id);
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
        if (book.getParentBook() != null) {
            dto.setParentBookId(book.getParentBook().getId());
        }
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
        dto.setVolume(bookEntity.getSeries() != null ? bookEntity.getVolume() : null);
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

        if (bookEntity.getParentBook() != null) {
            dto.setParentBookId(bookEntity.getParentBook().getId());
            dto.setParentBookTitle(bookEntity.getParentBook().getTitle());
            if (bookEntity.getParentBook().getVariants() != null && !bookEntity.getParentBook().getVariants().isEmpty()) {
                dto.setVariants(bookEntity.getParentBook().getVariants().stream().map(this::entityToSummaryDTO).collect(Collectors.toList()));
            }
        } else if (bookEntity.getVariants() != null && !bookEntity.getVariants().isEmpty()) {
            dto.setVariants(bookEntity.getVariants().stream().map(this::entityToSummaryDTO).collect(Collectors.toList()));
        }

        // Previous and Next book in the same series (filtering out variants so they do not disrupt sequence)
        if (bookEntity.getSeries() != null && bookEntity.getSeries().getId() != null) {
            List<BookEntity> rawBooks = repositoryService.getBookRepository()
                    .findAllBySeriesId(bookEntity.getSeries().getId());

            List<BookEntity> seriesBooks = (rawBooks != null)
                    ? rawBooks.stream().filter(b -> b.getParentBook() == null).collect(Collectors.toList())
                    : Collections.emptyList();

            if (seriesBooks.size() > 1) {
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

        if (withAuthors && bookEntity.getBookHasAuthors() != null) {
            List<BookHasAuthorDTO> authorsDTO = bookEntity.getBookHasAuthors()
                    .stream()
                    .filter(bha -> bha.getAuthor() != null && bha.getAuthorType() != null)
                    .map(bookHasAuthor -> {
                        AuthorEntity author = bookHasAuthor.getAuthor();
                        AuthorTypeEntity authorType = bookHasAuthor.getAuthorType();

                        BookHasAuthorDTO bookHasAuthorDto = new BookHasAuthorDTO();
                        bookHasAuthorDto.setId(author.getId());
                        bookHasAuthorDto.setFirstname(author.getFirstname());
                        bookHasAuthorDto.setLastname(author.getLastname());
                        bookHasAuthorDto.setType(authorType.getName());
                        return bookHasAuthorDto;
                    })
                    .toList();

            dto.setAuthors(authorsDTO);
        }

        if (withStatus && userEntity != null) {
            String status = repositoryService.getUserOwnsBooksRepository()
                    .findByUserIdAndBookId(userEntity.getId(), bookEntity.getId())
                    .map(UserOwnsBookEntity::getStatus)
                    .orElse(null);

            if (status == null) {
                status = repositoryService.getUserSellsBookRepository()
                        .findByUserIdAndBookId(userEntity.getId(), bookEntity.getId())
                        .map(UserSellsBookEntity::getStatus)
                        .orElse(null);
            }

            dto.setStatus(status);

            dto.setReadingStatus(repositoryService.getBookStatusRepository()
                    .findByUserIdAndBookId(userEntity.getId(), bookEntity.getId())
                    .map(BookStatusEntity::getStatus)
                    .orElse("UNREAD"));
        }

        return dto;
    }

    @PutMapping("/{id}/series")
    public BookDTO updateBookSeries(
            HttpSession session,
            @PathVariable Long id,
            @RequestBody SetBookSeriesDTO req
    ) {
        UserEntity user = getAuthenticatedUser(session);
        BookEntity book = repositoryService.getBookRepository().findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Book not found"));

        if (req.getSeriesId() != null) {
            SeriesEntity series = repositoryService.getSeriesRepository().findById(req.getSeriesId().longValue())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Series not found"));
            book.setSeries(series);
            if (req.getVolume() != null) {
                book.setVolume(req.getVolume());
            }
        } else {
            book.setSeries(null);
            book.setVolume(null);
        }

        book = repositoryService.getBookRepository().save(book);
        return entityToDTO(book, user, true, true, true, true, true);
    }

    private void cleanupOldCoverIfUnused(String oldCoverUrl, Long bookId) {
        if (oldCoverUrl == null || oldCoverUrl.isBlank()) {
            return;
        }
        String trimmed = oldCoverUrl.trim();
        if (trimmed.toLowerCase().startsWith("http://") || trimmed.toLowerCase().startsWith("https://")) {
            return;
        }
        long count = repositoryService.getBookRepository().countByCoverUrlAndIdNot(trimmed, bookId);
        if (count == 0) {
            mediaServiceClient.deleteImage(trimmed);
        }
    }

    @PostMapping(value = "/{id}/cover", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public BookDTO uploadBookCover(
            HttpSession session,
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file
    ) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Aucun fichier image fourni");
        }

        UserEntity user = getAuthenticatedUser(session);
        BookEntity book = repositoryService.getBookRepository().findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Album introuvable"));

        try {
            String oldCover = book.getCoverUrl();
            String newCoverUuid = mediaServiceClient.createVirtualImage();
            mediaServiceClient.uploadImage(newCoverUuid, file.getBytes(), file.getContentType());

            book.setCoverUrl(newCoverUuid);
            book = repositoryService.getBookRepository().save(book);

            if (oldCover != null && !oldCover.equals(newCoverUuid)) {
                cleanupOldCoverIfUnused(oldCover, book.getId());
            }

            return entityToDTO(book, user, true, true, true, true, true);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Erreur lors de l'envoi de l'image au service média : " + e.getMessage());
        }
    }

    @PutMapping(value = "/{id}/cover", consumes = MediaType.APPLICATION_JSON_VALUE)
    public BookDTO updateBookCoverByUrlOrId(
            HttpSession session,
            @PathVariable Long id,
            @RequestBody Map<String, String> payload
    ) {
        UserEntity user = getAuthenticatedUser(session);
        BookEntity book = repositoryService.getBookRepository().findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Album introuvable"));

        String remoteUrl = payload != null ? payload.get("url") : null;
        String coverId = payload != null ? payload.get("coverId") : null;

        if ((remoteUrl == null || remoteUrl.isBlank()) && (coverId == null || coverId.isBlank())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Veuillez fournir une URL ('url') ou un identifiant d'image ('coverId')");
        }

        try {
            String oldCover = book.getCoverUrl();
            String newCoverUuid;

            if (coverId != null && !coverId.isBlank()) {
                newCoverUuid = coverId.trim();
            } else {
                newCoverUuid = mediaServiceClient.createVirtualImage();
                mediaServiceClient.uploadRemoteUrl(newCoverUuid, remoteUrl.trim());
            }

            book.setCoverUrl(newCoverUuid);
            book = repositoryService.getBookRepository().save(book);

            if (oldCover != null && !oldCover.equals(newCoverUuid)) {
                cleanupOldCoverIfUnused(oldCover, book.getId());
            }

            return entityToDTO(book, user, true, true, true, true, true);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Erreur lors de la récupération de l'image via le service média : " + e.getMessage());
        }
    }
}
