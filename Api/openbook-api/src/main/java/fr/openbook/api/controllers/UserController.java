package fr.openbook.api.controllers;
import java.util.Objects;
import java.util.Collections;

import fr.openbook.api.dtos.BookStatusDTO;
import fr.openbook.api.dtos.ReadingSessionDTO;
import fr.openbook.api.entities.BookEntity;
import fr.openbook.api.entities.BookHasAuthorEntity;
import fr.openbook.api.entities.BookReadingStatus;
import fr.openbook.api.entities.BookStatusEntity;
import fr.openbook.api.entities.CategoryEntity;
import fr.openbook.api.entities.ReadingSessionEntity;
import fr.openbook.api.entities.SeriesEntity;
import fr.openbook.api.entities.SeriesStatus;
import fr.openbook.api.entities.UserEntity;
import fr.openbook.api.entities.UserOwnsBookEntity;
import fr.openbook.api.entities.UserSellsBookEntity;
import fr.openbook.api.entities.UserBookTransactionEntity;
import fr.openbook.api.dtos.UserBookTransactionDTO;
import fr.openbook.api.dtos.CreateBookTransactionRequestDTO;
import fr.openbook.api.dtos.SaleStatusUpdateRequestDTO;
import java.time.LocalDate;
import java.time.Year;
import java.time.YearMonth;

import org.springframework.web.bind.annotation.RequestMethod;
import fr.openbook.api.entities.UserOwnsBookStatus;
import org.springframework.web.server.ResponseStatusException;
import fr.openbook.api.dtos.CollectionPageDTO;
import fr.openbook.api.dtos.BookDTO;
import fr.openbook.api.dtos.BookSummaryDTO;
import fr.openbook.api.dtos.SeriesDTO;
import fr.openbook.api.services.SeriesService;
import fr.openbook.api.dtos.UserSeriesSummaryDTO;
import java.util.Comparator;
import java.util.Set;
import fr.openbook.api.dtos.UserOwnsBookDTO;
import fr.openbook.api.dtos.UserProfileDTO;
import fr.openbook.api.dtos.UserRetrospectiveDTO;
import fr.openbook.api.dtos.UserStatisticsDTO;
import org.springframework.http.HttpStatus;
import fr.openbook.api.dtos.stats.AuthorHighlightDTO;
import fr.openbook.api.dtos.stats.BookHighlightDTO;
import fr.openbook.api.dtos.stats.CategoryStatDTO;
import fr.openbook.api.dtos.stats.PublisherStatDTO;
import fr.openbook.api.dtos.stats.DecadeStatDTO;
import java.time.ZoneId;
import fr.openbook.api.dtos.user.UpdatePasswordRequestDTO;
import fr.openbook.api.dtos.user.UpdateProfileRequestDTO;
import fr.openbook.api.dtos.user.DeleteAccountRequestDTO;
import fr.openbook.api.repositories.UserOwnsBooksRepository;
import fr.openbook.api.services.JwtService;
import fr.openbook.api.services.RepositoryService;
import jakarta.servlet.http.HttpSession;
import lombok.AllArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeSet;
import java.util.stream.Collectors;
import fr.openbook.api.services.AvatarService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;

@RestController
@AllArgsConstructor
@RequestMapping("/user")
public class UserController {

    private final RepositoryService repositoryService;
    private final UserOwnsBooksRepository userOwnsBooksRepository;
    private final BCryptPasswordEncoder bCryptPasswordEncoder;
    private final JwtService jwtService;
    private final AvatarService avatarService;

    private UserEntity getAuthenticatedUser(HttpSession session) {
        if (session != null) {
            UserEntity user = (UserEntity) session.getAttribute("user");
            if (user != null) return user;
        }
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserEntity user) {
            return user;
        }
        throw new RuntimeException("User not logged in");
    }

    private BookSummaryDTO entityToSummaryDTO(BookEntity book) {
        return entityToSummaryDTO(book, null);
    }

    private BookSummaryDTO entityToSummaryDTO(BookEntity book, List<String> preloadedAuthors) {
        BookSummaryDTO dto = new BookSummaryDTO();
        dto.setId(book.getId());
        dto.setTitle(book.getTitle());
        dto.setVolume(book.getSeries() != null ? book.getVolume() : null);
        dto.setPrice(book.getPrice());
        if (book.getReleaseDate() != null) {
            dto.setReleaseDate(book.getReleaseDate().toString());
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
        if (preloadedAuthors != null) {
            dto.setAuthor(String.join(", ", preloadedAuthors));
        } else if (book.getBookHasAuthors() != null && !book.getBookHasAuthors().isEmpty()) {
            String authorStr = book.getBookHasAuthors().stream()
                    .filter(bha -> bha.getAuthor() != null)
                    .map(bha -> ((bha.getAuthor().getFirstname() != null ? bha.getAuthor().getFirstname() : "") + " "
                            + (bha.getAuthor().getLastname() != null ? bha.getAuthor().getLastname() : "")).trim())
                    .filter(s -> !s.isEmpty())
                    .collect(Collectors.joining(", "));
            dto.setAuthor(authorStr);
        }
        dto.setType(book.getType());
        return dto;
    }

    @GetMapping("/profile")
    public UserProfileDTO getProfile(HttpSession session) {
        UserEntity user = getAuthenticatedUser(session);

        UserProfileDTO userProfileDTO = new UserProfileDTO();
        userProfileDTO.setUsername(user.getRealUsername());
        userProfileDTO.setAvatar(user.getAvatar());
        userProfileDTO.setRole(user.getRole());
        userProfileDTO.setMustChangePassword(user.isMustChangePassword());
        userProfileDTO.setBlocked(user.isBlocked());
        userProfileDTO.setBooksCount(0);
        userProfileDTO.setBooksToReadCount(0);
        userProfileDTO.setBooksReadThisYearCount(0);

        return userProfileDTO;
    }

    @PutMapping("/profile")
    public ResponseEntity<?> updateProfile(@RequestBody UpdateProfileRequestDTO request, HttpSession session) {
        UserEntity user = getAuthenticatedUser(session);

        if (request.getUsername() != null && !request.getUsername().trim().isEmpty()) {
            String newUsername = request.getUsername().trim();
            if (repositoryService.getUserRepository().existsByUsernameAndIdNot(newUsername, user.getId())) {
                return ResponseEntity.badRequest().body("Ce pseudonyme est déjà utilisé.");
            }
            user.setUsername(newUsername);
        }

        if (request.getAvatar() != null) {
            String oldAvatar = user.getAvatar();
            String newAvatar = request.getAvatar().trim();
            user.setAvatar(newAvatar);
            if (oldAvatar != null && !oldAvatar.isBlank() && !oldAvatar.equals(newAvatar)) {
                avatarService.deleteAvatarFile(oldAvatar);
            }
        }

        user = repositoryService.getUserRepository().save(user);

        if (session != null) {
            session.setAttribute("user", user);
        }

        HashMap<String, Object> claims = new HashMap<>();
        claims.put("username", user.getRealUsername());
        claims.put("role", user.getRole());
        if (user.getAvatar() != null) {
            claims.put("avatar", user.getAvatar());
        }

        String newToken = jwtService.generateToken(claims, user);

        UserProfileDTO profileDTO = new UserProfileDTO();
        profileDTO.setUsername(user.getRealUsername());
        profileDTO.setAvatar(user.getAvatar());
        profileDTO.setRole(user.getRole());

        Map<String, Object> response = new HashMap<>();
        response.put("profile", profileDTO);
        response.put("token", newToken);
        response.put("message", "Profil mis à jour avec succès.");

        return ResponseEntity.ok(response);
    }

    @PostMapping(value = "/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadAvatar(
            @RequestParam("file") MultipartFile file,
            HttpSession session
    ) {
        UserEntity user = getAuthenticatedUser(session);

        try {
            String oldAvatar = user.getAvatar();
            String avatarUrl = avatarService.saveAvatar(file);

            user.setAvatar(avatarUrl);
            user = repositoryService.getUserRepository().save(user);

            if (oldAvatar != null && !oldAvatar.isBlank() && !oldAvatar.equals(avatarUrl)) {
                avatarService.deleteAvatarFile(oldAvatar);
            }

            if (session != null) {
                session.setAttribute("user", user);
            }

            HashMap<String, Object> claims = new HashMap<>();
            claims.put("username", user.getRealUsername());
            claims.put("role", user.getRole());
            claims.put("avatar", user.getAvatar());

            String newToken = jwtService.generateToken(claims, user);

            Map<String, Object> response = new HashMap<>();
            response.put("message", "Avatar mis à jour avec succès.");
            response.put("avatar", avatarUrl);
            response.put("token", newToken);

            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException | SecurityException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Erreur serveur lors de l'enregistrement de l'avatar."));
        }
    }

    @PutMapping("/password")
    public ResponseEntity<?> updatePassword(@RequestBody UpdatePasswordRequestDTO request, HttpSession session) {
        UserEntity user = getAuthenticatedUser(session);

        if (request.getCurrentPassword() == null || request.getCurrentPassword().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Le mot de passe actuel est requis."));
        }

        UserEntity freshUser = repositoryService.getUserRepository().findById(user.getId())
                .orElse(user);

        if (!bCryptPasswordEncoder.matches(request.getCurrentPassword(), freshUser.getPassword())) {
            return ResponseEntity.badRequest().body(Map.of("message", "Mot de passe actuel incorrect."));
        }

        if (request.getNewPassword() == null || request.getNewPassword().length() < 6) {
            return ResponseEntity.badRequest().body(Map.of("message", "Le nouveau mot de passe doit comporter au moins 6 caractères."));
        }

        freshUser.setPassword(bCryptPasswordEncoder.encode(request.getNewPassword()));
        freshUser.setMustChangePassword(false);
        freshUser = repositoryService.getUserRepository().save(freshUser);

        if (session != null) {
            session.setAttribute("user", freshUser);
        }

        HashMap<String, Object> claims = new HashMap<>();
        claims.put("username", freshUser.getRealUsername());
        claims.put("avatar", freshUser.getAvatar());
        claims.put("role", freshUser.getRole());
        claims.put("mustChangePassword", false);

        String newToken = jwtService.generateToken(claims, freshUser);

        return ResponseEntity.ok(Map.of(
            "message", "Mot de passe modifié avec succès.",
            "token", newToken,
            "mustChangePassword", false
        ));
    }

    @DeleteMapping("/account")
    public ResponseEntity<?> deleteAccount(@RequestBody DeleteAccountRequestDTO request, HttpSession session) {
        UserEntity user = getAuthenticatedUser(session);

        if (request.getPassword() == null || request.getPassword().isEmpty()) {
            return ResponseEntity.badRequest().body("Le mot de passe est obligatoire pour confirmer la suppression.");
        }

        if (!bCryptPasswordEncoder.matches(request.getPassword(), user.getPassword())) {
            return ResponseEntity.badRequest().body("Mot de passe incorrect.");
        }

        if (!"Je veux supprimer mon compte".equals(request.getConfirmationText())) {
            return ResponseEntity.badRequest().body("La phrase de confirmation est incorrecte. Vous devez saisir exactement : Je veux supprimer mon compte");
        }

        userOwnsBooksRepository.deleteAllByUserId(user.getId());

        if (user.getAvatar() != null) {
            avatarService.deleteAvatarFile(user.getAvatar());
        }

        repositoryService.getUserRepository().delete(user);

        if (session != null) {
            session.invalidate();
        }

        return ResponseEntity.ok(Map.of("message", "Votre compte a été supprimé définitivement."));
    }

    @PostMapping("/addBook/{id}/{status}")
    @CacheEvict(cacheNames = "user-statistics", allEntries = true)
    public UserOwnsBookDTO addBook(
        HttpSession session,
        @PathVariable Long id,
        @PathVariable String status,
        @RequestBody(required = false) SaleStatusUpdateRequestDTO request
    ) {
        UserEntity user = getAuthenticatedUser(session);
        String upperStatus = status.toUpperCase();

        if (!UserOwnsBookStatus.OWNED.name().equalsIgnoreCase(upperStatus)
            && !UserOwnsBookStatus.WISHLISTED.name().equalsIgnoreCase(upperStatus)
            && !UserOwnsBookStatus.FOR_SALE.name().equalsIgnoreCase(upperStatus)
            && !UserOwnsBookStatus.LENT.name().equalsIgnoreCase(upperStatus)
            && !UserOwnsBookStatus.SOLD.name().equalsIgnoreCase(upperStatus)) {
            throw new RuntimeException("Invalid status: " + status);
        }

        final BookEntity book = repositoryService.getBookRepository()
                .findById(id)
                .orElseThrow(() -> new RuntimeException("Book not found"));

        if ("FOR_SALE".equals(upperStatus) || "SOLD".equals(upperStatus)) {
            repositoryService.getUserOwnsBooksRepository()
                    .findByUserIdAndBookId(user.getId(), id)
                    .ifPresent(repositoryService.getUserOwnsBooksRepository()::delete);

            UserSellsBookEntity entity = repositoryService.getUserSellsBookRepository()
                    .findByUserIdAndBookId(user.getId(), id)
                    .orElseGet(() -> {
                        UserSellsBookEntity s = new UserSellsBookEntity();
                        s.setUser(user);
                        s.setBook(book);
                        return s;
                    });
            entity.setStatus(upperStatus);
                    if (request != null) {
                        entity.setPrice(request.getPrice());
                        entity.setListingUrl(request.getListingUrl());
                    }
                    return UserOwnsBookDTO.from(repositoryService.getUserSellsBookRepository().saveAndFlush(entity));
        } else {
            repositoryService.getUserSellsBookRepository()
                    .findByUserIdAndBookId(user.getId(), id)
                    .ifPresent(repositoryService.getUserSellsBookRepository()::delete);

            UserOwnsBookEntity entity = repositoryService.getUserOwnsBooksRepository()
                    .findByUserIdAndBookId(user.getId(), id)
                    .orElseGet(() -> {
                        UserOwnsBookEntity userOwnsBookEntity = new UserOwnsBookEntity();
                        userOwnsBookEntity.setUser(user);
                        userOwnsBookEntity.setBook(book);
                        return userOwnsBookEntity;
                    });

            entity.setStatus(upperStatus);
            return UserOwnsBookDTO.from(repositoryService.getUserOwnsBooksRepository().saveAndFlush(entity));
        }
    }

    @DeleteMapping("/removeBook/{id}")
    @CacheEvict(cacheNames = "user-statistics", allEntries = true)
    public void removeBook(
        HttpSession session,
        @PathVariable Long id
    ) {
        UserEntity user = getAuthenticatedUser(session);

        repositoryService.getUserOwnsBooksRepository()
                .findByUserIdAndBookId(user.getId(), id)
                .ifPresent(entity -> repositoryService.getUserOwnsBooksRepository().delete(entity));

        repositoryService.getUserSellsBookRepository()
                .findByUserIdAndBookId(user.getId(), id)
                .ifPresent(entity -> repositoryService.getUserSellsBookRepository().delete(entity));
    }

    @PostMapping("/readingStatus/{id}/{status}")
    @CacheEvict(cacheNames = "user-statistics", allEntries = true)
    public BookStatusDTO setReadingStatus(
        HttpSession session,
        @PathVariable Long id,
        @PathVariable String status
    ) {
        UserEntity user = getAuthenticatedUser(session);
        BookReadingStatus readingStatus;
        try {
            readingStatus = BookReadingStatus.fromString(status);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid reading status: " + status);
        }

        final BookEntity book = repositoryService.getBookRepository()
                .findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Book not found"));

        BookStatusEntity entity = repositoryService.getBookStatusRepository()
                .findByUserIdAndBookId(user.getId(), id)
                .orElseGet(() -> {
                    BookStatusEntity statusEntity = new BookStatusEntity();
                    statusEntity.setUser(user);
                    statusEntity.setBook(book);
                    return statusEntity;
                });

        entity.setStatus(readingStatus.name());
        return BookStatusDTO.from(repositoryService.getBookStatusRepository().saveAndFlush(entity));
    }

    @DeleteMapping("/readingStatus/{id}")
    @CacheEvict(cacheNames = "user-statistics", allEntries = true)
    public void removeReadingStatus(
        HttpSession session,
        @PathVariable Long id
    ) {
        UserEntity user = getAuthenticatedUser(session);
        repositoryService.getBookStatusRepository()
                .findByUserIdAndBookId(user.getId(), id)
                .ifPresent(entity -> repositoryService.getBookStatusRepository().delete(entity));
    }

    @GetMapping("/readingStatus/{id}")
    public ResponseEntity<String> getReadingStatus(
        HttpSession session,
        @PathVariable Long id
    ) {
        UserEntity user = getAuthenticatedUser(session);
        return ResponseEntity.ok(repositoryService.getBookStatusRepository()
                .findByUserIdAndBookId(user.getId(), id)
                .map(BookStatusEntity::getStatus)
                .orElse(BookReadingStatus.UNREAD.name()));
    }

    @GetMapping("/reading/{status}")
    public List<BookSummaryDTO> getBooksByReadingStatus(
        HttpSession session,
        @PathVariable String status
    ) {
        UserEntity user = getAuthenticatedUser(session);
        BookReadingStatus readingStatus;
        try {
            readingStatus = BookReadingStatus.fromString(status);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid reading status: " + status);
        }

        return repositoryService.getBookStatusRepository()
                .findAllByUserIdAndStatus(user.getId(), readingStatus.name())
                .stream()
                .map(entity -> entityToSummaryDTO(entity.getBook()))
                .toList();
    }

    @GetMapping("/books")
    public List<BookSummaryDTO> getUserBooks(HttpSession session) {
        UserEntity user = getAuthenticatedUser(session);
        Long userId = user.getId();

        Map<Long, BookSummaryDTO> bookMap = new LinkedHashMap<>();

        // 1. Owned / Wishlisted / Lent / Sold books from user_owns_book
        List<UserOwnsBookEntity> ownedBooks = repositoryService.getUserOwnsBooksRepository()
                .findAll().stream().filter(uob -> uob.getUser() != null && uob.getUser().getId().equals(userId)).toList();
        for (UserOwnsBookEntity uob : ownedBooks) {
            if (uob.getBook() != null && !Boolean.TRUE.equals(uob.getBook().getDeleted())) {
                BookSummaryDTO dto = entityToSummaryDTO(uob.getBook());
                dto.setStatus(uob.getStatus());
                bookMap.put(uob.getBook().getId(), dto);
            }
        }

        // 2. Reading statuses from book_status
        List<BookStatusEntity> readingStatuses = repositoryService.getBookStatusRepository().findAllByUserId(userId);
        for (BookStatusEntity bse : readingStatuses) {
            if (bse.getBook() != null && !Boolean.TRUE.equals(bse.getBook().getDeleted())) {
                Long bId = bse.getBook().getId();
                BookSummaryDTO dto = bookMap.computeIfAbsent(bId, k -> {
                    BookSummaryDTO d = entityToSummaryDTO(bse.getBook());
                    d.setStatus("OWNED");
                    return d;
                });
                dto.setReadingStatus(bse.getStatus());
            }
        }

        // 3. Books from reading sessions (only set to READING if reading status wasn't already specified)
        List<ReadingSessionEntity> sessions = repositoryService.getReadingSessionRepository().findAllByUserIdOrderByCreatedAtAsc(userId);
        for (ReadingSessionEntity rse : sessions) {
            if (rse.getBook() != null && !Boolean.TRUE.equals(rse.getBook().getDeleted())) {
                Long bId = rse.getBook().getId();
                bookMap.computeIfAbsent(bId, k -> {
                    BookSummaryDTO d = entityToSummaryDTO(rse.getBook());
                    d.setStatus("OWNED");
                    d.setReadingStatus("READING");
                    return d;
                });
            }
        }

        // Ensure reading status defaults to UNREAD if not present
        for (BookSummaryDTO dto : bookMap.values()) {
            if (dto.getReadingStatus() == null) {
                dto.setReadingStatus("UNREAD");
            }
            if (dto.getStatus() == null) {
                dto.setStatus("OWNED");
            }
        }

        return new ArrayList<>(bookMap.values());
    }

    private String normalizeCategory(String category, String type) {
        String raw = ((category != null ? category : "") + " " + (type != null ? type : "")).toLowerCase();
        if (raw.contains("manga")) return "manga";
        if (raw.contains("e-book") || raw.contains("ebook")) return "e-book";
        if (raw.contains("comic")) return "comics";
        if (raw.contains("bande") || raw.contains("bd") || raw.contains("roman") || raw.contains("cartonné") || raw.contains("cartonne")) return "bd";
        return "comics";
    }

    private boolean matchesTomeStatus(String readingStatus, String filter) {
        if (filter == null || filter.equalsIgnoreCase("all") || filter.isBlank()) {
            return true;
        }
        String rStatus = (readingStatus != null ? readingStatus : "UNREAD").toUpperCase();
        if (filter.equalsIgnoreCase("toread")) {
            return !rStatus.equals("READ") && !rStatus.equals("LU") && !rStatus.equals("ABANDONED") && !rStatus.equals("ABANDONNE");
        }
        if (filter.equalsIgnoreCase("read")) {
            return rStatus.equals("READ") || rStatus.equals("LU");
        }
        if (filter.equalsIgnoreCase("abandoned")) {
            return rStatus.equals("ABANDONED") || rStatus.equals("ABANDONNE");
        }
        return true;
    }

    private boolean matchesCategory(BookEntity b, String categoryFilter) {
        if (categoryFilter == null || categoryFilter.equalsIgnoreCase("all") || categoryFilter.isBlank()) {
            return true;
        }
        String cat = b.getSeries() != null && b.getSeries().getCategory() != null ? b.getSeries().getCategory().getName() : null;
        String type = b.getType();
        String normalized = normalizeCategory(cat, type); for (String part : categoryFilter.split(",")) { String c = part.trim(); if (c.equalsIgnoreCase("all") || c.equalsIgnoreCase(normalized)) return true; } return false;
    }

    private boolean matchesSearch(BookEntity b, String searchQuery) {
        if (searchQuery == null || searchQuery.isBlank()) {
            return true;
        }
        String q = searchQuery.trim().toLowerCase();
        String title = b.getTitle() != null ? b.getTitle().toLowerCase() : "";
        String seriesName = (b.getSeries() != null && b.getSeries().getName() != null) ? b.getSeries().getName().toLowerCase() : "";
        return title.contains(q) || seriesName.contains(q);
    }

    @GetMapping({"/collection", "/library", "/bibliotheque"})
    public ResponseEntity<?> getCollection(
            HttpSession session,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false, defaultValue = "24") Integer size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String status
    ) {
        UserEntity user = getAuthenticatedUser(session);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        List<UserOwnsBookEntity> ownedEntries = repositoryService.getUserOwnsBooksRepository()
                .findAllByUserIdAndStatusWithDetails(user.getId(), UserOwnsBookStatus.OWNED.name());

        if (ownedEntries.isEmpty()) {
            if (page == null) {
                return ResponseEntity.ok(Collections.emptyList());
            }
            Map<String, Long> emptyCounts = new HashMap<>();
            emptyCounts.put("all", 0L);
            emptyCounts.put("toread", 0L);
            emptyCounts.put("read", 0L);
            emptyCounts.put("abandoned", 0L);
            return ResponseEntity.ok(new CollectionPageDTO(Collections.emptyList(), 0L, 1, 1, size != null ? size : 24, emptyCounts, 0L));
        }

        Map<Long, String> readingStatusMap = repositoryService.getBookStatusRepository()
                .findAllByUserIdWithBook(user.getId()).stream()
                .filter(bse -> bse.getBook() != null)
                .collect(Collectors.toMap(bse -> bse.getBook().getId(), BookStatusEntity::getStatus, (s1, s2) -> s1));

        // If page is not specified, preserve legacy behavior (return all items as List<BookSummaryDTO>)
        if (page == null) {
            List<Long> bookIds = ownedEntries.stream()
                    .map(uob -> uob.getBook().getId())
                    .filter(Objects::nonNull)
                    .toList();

            Map<Long, List<String>> authorsByBookId = repositoryService.getBookHasAuthorRepository()
                    .findAllByBookIdInWithAuthor(bookIds).stream()
                    .filter(bha -> bha.getBook() != null && bha.getAuthor() != null)
                    .collect(Collectors.groupingBy(
                            bha -> bha.getBook().getId(),
                            Collectors.mapping(
                                    bha -> ((bha.getAuthor().getFirstname() != null ? bha.getAuthor().getFirstname() : "") + " "
                                            + (bha.getAuthor().getLastname() != null ? bha.getAuthor().getLastname() : "")).trim(),
                                    Collectors.filtering(s -> !s.isEmpty(), Collectors.toList())
                            )
                    ));

            List<BookSummaryDTO> list = ownedEntries.stream()
                    .map(entity -> {
                        BookEntity book = entity.getBook();
                        BookSummaryDTO dto = entityToSummaryDTO(book, authorsByBookId.get(book.getId()));
                        dto.setStatus(entity.getStatus());
                        dto.setReadingStatus(readingStatusMap.getOrDefault(book.getId(), "UNREAD"));
                        return dto;
                    })
                    .toList();
            return ResponseEntity.ok(list);
        }

        // Calculate status counts over all owned books for the user
        long allCount = ownedEntries.size();
        long readCount = 0;
        long abandonedCount = 0;
        long toReadCount = 0;

        for (UserOwnsBookEntity uob : ownedEntries) {
            if (uob.getBook() == null) continue;
            String rStatus = readingStatusMap.getOrDefault(uob.getBook().getId(), "UNREAD").toUpperCase();
            if ("READ".equals(rStatus) || "LU".equals(rStatus)) {
                readCount++;
            } else if ("ABANDONED".equals(rStatus) || "ABANDONNE".equals(rStatus)) {
                abandonedCount++;
            } else {
                toReadCount++;
            }
        }
        Map<String, Long> statusCounts = new HashMap<>();
        statusCounts.put("all", allCount);
        statusCounts.put("read", readCount);
        statusCounts.put("abandoned", abandonedCount);
        statusCounts.put("toread", toReadCount);

        // Filter by status, category, search
        List<UserOwnsBookEntity> filteredEntries = ownedEntries.stream().filter(uob -> {
            BookEntity b = uob.getBook();
            if (b == null) return false;

            // Reading status filter
            String rStatus = readingStatusMap.getOrDefault(b.getId(), "UNREAD");
            if (!matchesTomeStatus(rStatus, status)) return false;

            // Category filter
            if (!matchesCategory(b, category)) return false;

            // Search query filter
            if (!matchesSearch(b, search)) return false;

            return true;
        }).toList();

        long totalElements = filteredEntries.size();
        int pageSize = (size != null && size > 0) ? size : 24;
        boolean isAll = (size != null && (size == 0 || size >= 9999));
        int effectivePageSize = isAll ? Math.max(1, (int) totalElements) : pageSize;
        int totalPages = isAll ? 1 : (int) Math.max(1, Math.ceil((double) totalElements / effectivePageSize));
        int currentPage = Math.max(1, page);
        if (!isAll && totalPages > 0 && currentPage > totalPages) {
            currentPage = totalPages;
        }
        int pageIndex = currentPage - 1;
        int startIndex = totalElements == 0 ? 0 : pageIndex * effectivePageSize;
        int endIndex = isAll ? (int) totalElements : Math.min(startIndex + effectivePageSize, (int) totalElements);

        List<UserOwnsBookEntity> pagedEntries = (startIndex < totalElements && startIndex >= 0)
                ? filteredEntries.subList(startIndex, endIndex)
                : Collections.emptyList();

        List<Long> pageBookIds = pagedEntries.stream()
                .map(uob -> uob.getBook().getId())
                .filter(Objects::nonNull)
                .toList();

        Map<Long, List<String>> authorsByBookId = pageBookIds.isEmpty() ? Collections.emptyMap() :
                repositoryService.getBookHasAuthorRepository()
                        .findAllByBookIdInWithAuthor(pageBookIds).stream()
                        .filter(bha -> bha.getBook() != null && bha.getAuthor() != null)
                        .collect(Collectors.groupingBy(
                                bha -> bha.getBook().getId(),
                                Collectors.mapping(
                                        bha -> ((bha.getAuthor().getFirstname() != null ? bha.getAuthor().getFirstname() : "") + " "
                                                + (bha.getAuthor().getLastname() != null ? bha.getAuthor().getLastname() : "")).trim(),
                                        Collectors.filtering(s -> !s.isEmpty(), Collectors.toList())
                                )
                        ));

        List<BookSummaryDTO> content = pagedEntries.stream()
                .map(entity -> {
                    BookEntity book = entity.getBook();
                    BookSummaryDTO dto = entityToSummaryDTO(book, authorsByBookId.get(book.getId()));
                    dto.setStatus(entity.getStatus());
                    dto.setReadingStatus(readingStatusMap.getOrDefault(book.getId(), "UNREAD"));
                    return dto;
                })
                .toList();

        CollectionPageDTO result = new CollectionPageDTO(
                content,
                totalElements,
                totalPages,
                currentPage,
                effectivePageSize,
                statusCounts,
                allCount
        );

        return ResponseEntity.ok(result);
    }

    @GetMapping({"/collection/series", "/library/series", "/bibliotheque/series"})
    public List<UserSeriesSummaryDTO> getCollectionGroupedBySeries(HttpSession session) {
        UserEntity user = getAuthenticatedUser(session);
        if (user == null) {
            return Collections.emptyList();
        }

        List<UserOwnsBookEntity> ownedEntries = repositoryService.getUserOwnsBooksRepository()
                .findAllByUserIdAndStatusWithDetails(user.getId(), UserOwnsBookStatus.OWNED.name());

        if (ownedEntries.isEmpty()) {
            return Collections.emptyList();
        }

        List<Long> bookIds = ownedEntries.stream()
                .map(uob -> uob.getBook().getId())
                .filter(Objects::nonNull)
                .toList();

        Map<Long, List<String>> authorsByBookId = repositoryService.getBookHasAuthorRepository()
                .findAllByBookIdInWithAuthor(bookIds).stream()
                .filter(bha -> bha.getBook() != null && bha.getAuthor() != null)
                .collect(Collectors.groupingBy(
                        bha -> bha.getBook().getId(),
                        Collectors.mapping(
                                bha -> ((bha.getAuthor().getFirstname() != null ? bha.getAuthor().getFirstname() : "") + " "
                                        + (bha.getAuthor().getLastname() != null ? bha.getAuthor().getLastname() : "")).trim(),
                                Collectors.filtering(s -> !s.isEmpty(), Collectors.toList())
                        )
                ));

        Map<Long, String> readingStatusMap = repositoryService.getBookStatusRepository()
                .findAllByUserIdWithBook(user.getId()).stream()
                .filter(bse -> bse.getBook() != null)
                .collect(Collectors.toMap(bse -> bse.getBook().getId(), BookStatusEntity::getStatus, (s1, s2) -> s1));

        Map<Long, UserSeriesSummaryDTO> seriesMap = new LinkedHashMap<>();

        for (UserOwnsBookEntity uob : ownedEntries) {
            BookEntity book = uob.getBook();
            if (book == null) continue;

            SeriesEntity series = book.getSeries();
            if (series == null || series.getId() == null) continue;

            Long sId = series.getId().longValue();
            String sName = series.getName();
            String cat = series.getCategory() != null ? series.getCategory().getName() : (book.getType() != null ? book.getType() : "Comics");
            String sCover = series.getCoverUrl() != null ? series.getCoverUrl() : book.getCoverUrl();
            int total = series.getTotalVolumes() != null ? series.getTotalVolumes() : 1;

            UserSeriesSummaryDTO sDto = seriesMap.computeIfAbsent(sId, id -> {
                UserSeriesSummaryDTO dto = new UserSeriesSummaryDTO();
                dto.setId(id);
                dto.setName(sName);
                dto.setCategory(cat);
                dto.setCoverUrl(sCover);
                dto.setTotalVolumes(total);
                dto.setOwnedCount(0);
                dto.setBooks(new ArrayList<>());
                return dto;
            });

            BookSummaryDTO bookDto = entityToSummaryDTO(book, authorsByBookId.get(book.getId()));
            bookDto.setStatus(uob.getStatus());
            bookDto.setReadingStatus(readingStatusMap.getOrDefault(book.getId(), "UNREAD"));
            sDto.getBooks().add(bookDto);
        }

        for (UserSeriesSummaryDTO sDto : seriesMap.values()) {
            sDto.getBooks().sort(Comparator.comparingInt(b -> b.getVolume() != null ? b.getVolume() : 0));
            sDto.setOwnedCount(sDto.getBooks().size());
            if (sDto.getOwnedCount() > sDto.getTotalVolumes()) {
                sDto.setTotalVolumes(sDto.getOwnedCount());
            }
            if (sDto.getCoverUrl() == null && !sDto.getBooks().isEmpty()) {
                sDto.setCoverUrl(sDto.getBooks().get(0).getCoverUrl());
            }
        }

        List<UserSeriesSummaryDTO> result = new ArrayList<>(seriesMap.values());
        result.sort(Comparator.comparing(UserSeriesSummaryDTO::getName, String.CASE_INSENSITIVE_ORDER));
        return result;
    }

    @GetMapping({"/series", "/my-series"})
    public List<SeriesDTO> getUserSeries(HttpSession session) {
        UserEntity user = getAuthenticatedUser(session);
        List<SeriesEntity> seriesList = repositoryService.getSeriesRepository().findUserSeries(user.getId());

        Set<Integer> followedSeriesIds = repositoryService.getUserFollowsSeriesRepository()
                .findAllByUserId(user.getId()).stream()
                .map(ufs -> ufs.getSeries().getId())
                .collect(Collectors.toSet());

        Map<Long, String> userOwnershipMap = repositoryService.getUserOwnsBooksRepository()
                .findAllByUserId(user.getId()).stream()
                .filter(uob -> uob.getBook() != null)
                .collect(Collectors.toMap(
                        uob -> uob.getBook().getId(),
                        UserOwnsBookEntity::getStatus,
                        (s1, s2) -> s1
                ));

        Map<Long, String> readingStatusMap = repositoryService.getBookStatusRepository()
                .findAllByUserId(user.getId()).stream()
                .filter(bse -> bse.getBook() != null)
                .collect(Collectors.toMap(
                        bse -> bse.getBook().getId(),
                        BookStatusEntity::getStatus,
                        (s1, s2) -> s1
                ));

        List<SeriesDTO> result = new ArrayList<>();
        for (SeriesEntity series : seriesList) {
            SeriesDTO dto = SeriesService.entityToDTO(series);
            dto.setIsFollowed(followedSeriesIds.contains(series.getId()));

            List<BookEntity> books = repositoryService.getBookRepository()
                    .findAllBySeriesIdOrderByVolumeAscIdAsc(series.getId());

            int ownedCount = 0;
            List<BookSummaryDTO> bookDTOs = new ArrayList<>();
            for (BookEntity book : books) {
                BookSummaryDTO bDto = entityToSummaryDTO(book);
                String ownership = userOwnershipMap.get(book.getId());
                if (ownership != null) {
                    bDto.setStatus(ownership);
                    if (UserOwnsBookStatus.OWNED.name().equalsIgnoreCase(ownership)) {
                        ownedCount++;
                    }
                }
                bDto.setReadingStatus(readingStatusMap.getOrDefault(book.getId(), "UNREAD"));
                bookDTOs.add(bDto);
            }

            dto.setOwnedCount(ownedCount);
            dto.setBooks(bookDTOs);
            if (dto.getCoverUrl() == null && !bookDTOs.isEmpty()) {
                dto.setCoverUrl(bookDTOs.get(0).getCoverUrl());
            }
            if (ownedCount > 0) {
                result.add(dto);
            }
        }

        result.sort(Comparator.comparing(SeriesDTO::getName, String.CASE_INSENSITIVE_ORDER));
        return result;
    }


    @GetMapping({"/sales", "/ventes"})
    public List<BookSummaryDTO> getUserSales(HttpSession session) {
        UserEntity user = getAuthenticatedUser(session);

        List<UserSellsBookEntity> salesEntries = repositoryService.getUserSellsBookRepository()
                .findAllByUserId(user.getId());

        Map<Long, String> readingStatusMap = repositoryService.getBookStatusRepository()
                .findAllByUserId(user.getId()).stream()
                .filter(bse -> bse.getBook() != null)
                .collect(Collectors.toMap(bse -> bse.getBook().getId(), BookStatusEntity::getStatus, (s1, s2) -> s1));

        return salesEntries.stream()
                .filter(usb -> usb.getBook() != null)
                .map(entity -> {
                    BookSummaryDTO dto = entityToSummaryDTO(entity.getBook());
                    dto.setStatus(entity.getStatus());
                    dto.setReadingStatus(readingStatusMap.getOrDefault(entity.getBook().getId(), "UNREAD"));
                    if (entity.getPrice() != null) {
                        dto.setPrice(entity.getPrice().intValue());
                    }
                    dto.setListingUrl(entity.getListingUrl());
                    return dto;
                })
                .toList();
    }

    @RequestMapping(value = "/sales/{bookId}/status/{status}", method = {RequestMethod.PUT, RequestMethod.POST})
    @CacheEvict(cacheNames = "user-statistics", allEntries = true)
    public BookSummaryDTO updateSaleStatus(
        HttpSession session,
        @PathVariable Long bookId,
        @PathVariable String status,
        @RequestBody(required = false) SaleStatusUpdateRequestDTO request
    ) {
        UserEntity user = getAuthenticatedUser(session);
        String upperStatus = status.toUpperCase();
        if (!"FOR_SALE".equals(upperStatus) && !"SOLD".equals(upperStatus)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid sales status: " + status);
        }

        UserSellsBookEntity entity = repositoryService.getUserSellsBookRepository()
                .findByUserIdAndBookId(user.getId(), bookId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Book not found in sales"));

        String previousStatus = entity.getStatus();
        entity.setStatus(upperStatus);
        if (request != null && request.getPrice() != null) {
            entity.setPrice(request.getPrice());
        }
        if (request != null) {
            entity.setListingUrl(request.getListingUrl());
        }
        repositoryService.getUserSellsBookRepository().saveAndFlush(entity);

        if ("SOLD".equalsIgnoreCase(previousStatus) && "FOR_SALE".equals(upperStatus)) {
            List<UserBookTransactionEntity> existingTxs = repositoryService.getUserBookTransactionRepository()
                    .findAllByUserIdAndBookIdOrderByTransactionDateDescCreatedAtDesc(user.getId(), bookId);
            existingTxs.stream()
                    .filter(t -> "SOLD".equalsIgnoreCase(t.getType()))
                    .findFirst()
                    .ifPresent(repositoryService.getUserBookTransactionRepository()::delete);
        }

        if ("SOLD".equals(upperStatus)) {
            UserBookTransactionEntity tx = new UserBookTransactionEntity();
            tx.setUser(user);
            tx.setBook(entity.getBook());
            tx.setType("SOLD");
            LocalDate txDate = null;
            if (request != null && request.getDate() != null && !request.getDate().trim().isEmpty()) {
                try {
                    txDate = LocalDate.parse(request.getDate().trim());
                } catch (Exception ignored) {}
            }
            tx.setTransactionDate(txDate);
            tx.setPrice(request != null && request.getPrice() != null ? request.getPrice() : entity.getPrice());
            if (request != null) {
                tx.setLocation(request.getLocation());
                tx.setMemo(request.getMemo());
            }
            repositoryService.getUserBookTransactionRepository().saveAndFlush(tx);
        }

        BookSummaryDTO dto = entityToSummaryDTO(entity.getBook());
        dto.setStatus(entity.getStatus());
        if (entity.getPrice() != null) {
            dto.setPrice(entity.getPrice().intValue());
        }
        return dto;
    }

    @DeleteMapping("/sales/{bookId}")
    @CacheEvict(cacheNames = "user-statistics", allEntries = true)
    public ResponseEntity<Void> removeSale(
        HttpSession session,
        @PathVariable Long bookId
    ) {
        UserEntity user = getAuthenticatedUser(session);
        final BookEntity book = repositoryService.getBookRepository().findById(bookId).orElse(null);

        repositoryService.getUserSellsBookRepository()
                .findByUserIdAndBookId(user.getId(), bookId)
                .ifPresent(repositoryService.getUserSellsBookRepository()::delete);

        if (book != null) {
            UserOwnsBookEntity entity = repositoryService.getUserOwnsBooksRepository()
                    .findByUserIdAndBookId(user.getId(), bookId)
                    .orElseGet(() -> {
                        UserOwnsBookEntity u = new UserOwnsBookEntity();
                        u.setUser(user);
                        u.setBook(book);
                        return u;
                    });
            entity.setStatus(UserOwnsBookStatus.OWNED.name());
            repositoryService.getUserOwnsBooksRepository().saveAndFlush(entity);
        }

        return ResponseEntity.noContent().build();
    }

    @GetMapping("/wishlist")
    public List<BookSummaryDTO> getWishlist(HttpSession session) {
        UserEntity user = getAuthenticatedUser(session);
        if (user == null) {
            return Collections.emptyList();
        }

        List<UserOwnsBookEntity> wishlistedEntries = repositoryService.getUserOwnsBooksRepository()
                .findAllByUserIdAndStatusWithDetails(user.getId(), UserOwnsBookStatus.WISHLISTED.name());

        if (wishlistedEntries.isEmpty()) {
            return Collections.emptyList();
        }

        List<Long> bookIds = wishlistedEntries.stream()
                .map(uob -> uob.getBook().getId())
                .filter(Objects::nonNull)
                .toList();

        Map<Long, List<String>> authorsByBookId = repositoryService.getBookHasAuthorRepository()
                .findAllByBookIdInWithAuthor(bookIds).stream()
                .filter(bha -> bha.getBook() != null && bha.getAuthor() != null)
                .collect(Collectors.groupingBy(
                        bha -> bha.getBook().getId(),
                        Collectors.mapping(
                                bha -> ((bha.getAuthor().getFirstname() != null ? bha.getAuthor().getFirstname() : "") + " "
                                        + (bha.getAuthor().getLastname() != null ? bha.getAuthor().getLastname() : "")).trim(),
                                Collectors.filtering(s -> !s.isEmpty(), Collectors.toList())
                        )
                ));

        return wishlistedEntries.stream()
                .map(entity -> {
                    BookEntity book = entity.getBook();
                    BookSummaryDTO dto = entityToSummaryDTO(book, authorsByBookId.get(book.getId()));
                    dto.setStatus(UserOwnsBookStatus.WISHLISTED.name());
                    return dto;
                })
                .toList();
    }

    // --- Book Purchase & Sales Transactions Endpoints ---

    @GetMapping("/books/{bookId}/transactions")
    public List<UserBookTransactionDTO> getBookTransactions(
        HttpSession session,
        @PathVariable Long bookId
    ) {
        UserEntity user = getAuthenticatedUser(session);
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }

        return repositoryService.getUserBookTransactionRepository()
                .findAllByUserIdAndBookIdOrderByTransactionDateDescCreatedAtDesc(user.getId(), bookId)
                .stream()
                .map(UserBookTransactionDTO::from)
                .toList();
    }

    @PostMapping("/books/{bookId}/transactions")
    @CacheEvict(cacheNames = "user-statistics", allEntries = true)
    public UserBookTransactionDTO createBookTransaction(
        HttpSession session,
        @PathVariable Long bookId,
        @RequestBody CreateBookTransactionRequestDTO req
    ) {
        UserEntity user = getAuthenticatedUser(session);
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }

        BookEntity book = repositoryService.getBookRepository().findById(bookId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Book not found"));

        String type = (req.getType() != null) ? req.getType().toUpperCase() : "BOUGHT";
        if (!"BOUGHT".equals(type) && !"GIFT".equals(type) && !"SOLD".equals(type)) {
            type = "BOUGHT";
        }

        UserBookTransactionEntity tx = new UserBookTransactionEntity();
        tx.setUser(user);
        tx.setBook(book);
        tx.setType(type);
        LocalDate txDate = null;
        String datePrecision = null;
        String rawDate = req.getDate() != null ? req.getDate().trim() : "";
        String reqPrecision = req.getDatePrecision() != null ? req.getDatePrecision().trim().toUpperCase() : "";

        if (!"NONE".equals(reqPrecision)) {
            if (!rawDate.isEmpty()) {
                try {
                    if ("YEAR".equals(reqPrecision) || rawDate.matches("^\\d{4}$")) {
                        txDate = Year.parse(rawDate.substring(0, 4)).atDay(1);
                        datePrecision = "YEAR";
                    } else if ("MONTH".equals(reqPrecision) || rawDate.matches("^\\d{4}-\\d{2}$")) {
                        txDate = YearMonth.parse(rawDate.substring(0, 7)).atDay(1);
                        datePrecision = "MONTH";
                    } else {
                        txDate = LocalDate.parse(rawDate);
                        datePrecision = "DAY";
                    }
                } catch (Exception ignored) {}
            } else if ("BOUGHT".equals(type)) {
                txDate = LocalDate.now();
                datePrecision = "DAY";
            }
        }
        tx.setTransactionDate(txDate);
        tx.setDatePrecision(datePrecision);
        tx.setPrice("GIFT".equals(type) ? null : req.getPrice());
        tx.setLocation(req.getLocation());
        tx.setMemo(req.getMemo());

        UserBookTransactionEntity saved = repositoryService.getUserBookTransactionRepository().saveAndFlush(tx);

        if ("BOUGHT".equals(type) || "GIFT".equals(type)) {
            boolean owns = repositoryService.getUserOwnsBooksRepository()
                    .findByUserIdAndBookId(user.getId(), bookId).isPresent();
            boolean sells = repositoryService.getUserSellsBookRepository()
                    .findByUserIdAndBookId(user.getId(), bookId).isPresent();
            if (!owns && !sells) {
                UserOwnsBookEntity userOwnsBook = new UserOwnsBookEntity();
                userOwnsBook.setUser(user);
                userOwnsBook.setBook(book);
                userOwnsBook.setStatus(UserOwnsBookStatus.OWNED.name());
                repositoryService.getUserOwnsBooksRepository().saveAndFlush(userOwnsBook);
            }
        } else if ("SOLD".equals(type)) {
            UserSellsBookEntity saleEntity = repositoryService.getUserSellsBookRepository()
                    .findByUserIdAndBookId(user.getId(), bookId)
                    .orElseGet(() -> {
                        UserSellsBookEntity s = new UserSellsBookEntity();
                        s.setUser(user);
                        s.setBook(book);
                        return s;
                    });
            saleEntity.setStatus("SOLD");
            if (req.getPrice() != null) {
                saleEntity.setPrice(req.getPrice());
            }
            repositoryService.getUserSellsBookRepository().saveAndFlush(saleEntity);

            repositoryService.getUserOwnsBooksRepository()
                    .findByUserIdAndBookId(user.getId(), bookId)
                    .ifPresent(repositoryService.getUserOwnsBooksRepository()::delete);
        }

        return UserBookTransactionDTO.from(saved);
    }

    @DeleteMapping("/transactions/{id}")
    @CacheEvict(cacheNames = "user-statistics", allEntries = true)
    public ResponseEntity<Void> deleteTransaction(
        HttpSession session,
        @PathVariable Integer id
    ) {
        UserEntity user = getAuthenticatedUser(session);
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }

        repositoryService.getUserBookTransactionRepository()
                .findByIdAndUserId(id, user.getId())
                .ifPresent(repositoryService.getUserBookTransactionRepository()::delete);

        return ResponseEntity.noContent().build();
    }

    // --- Reading Sessions Endpoints ---

    @GetMapping("/readingSessions/{bookId}")
    public List<ReadingSessionDTO> getReadingSessions(HttpSession session, @PathVariable Long bookId) {
        UserEntity user = getAuthenticatedUser(session);
        return repositoryService.getReadingSessionRepository()
                .findAllByUserIdAndBookIdOrderByCreatedAtAsc(user.getId(), bookId)
                .stream()
                .map(ReadingSessionDTO::from)
                .toList();
    }

    @GetMapping("/readingSessions")
    public List<ReadingSessionDTO> getAllReadingSessions(HttpSession session) {
        UserEntity user = getAuthenticatedUser(session);
        return repositoryService.getReadingSessionRepository()
                .findAllByUserIdOrderByCreatedAtAsc(user.getId())
                .stream()
                .map(ReadingSessionDTO::from)
                .toList();
    }

    @PostMapping("/readingSessions")
    @CacheEvict(cacheNames = "user-statistics", allEntries = true)
    public ReadingSessionDTO addReadingSession(HttpSession session, @RequestBody ReadingSessionDTO dto) {
        UserEntity user = getAuthenticatedUser(session);
        BookEntity book = repositoryService.getBookRepository().findById(dto.getBookId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Book not found"));

        ReadingSessionEntity entity = new ReadingSessionEntity();
        entity.setUser(user);
        entity.setBook(book);
        entity.setCurrentPage(dto.getCurrentPage() != null ? dto.getCurrentPage() : 0);
        entity.setMinutesRead(dto.getMinutesRead() != null ? dto.getMinutesRead() : 0);
        entity.setSecondsRead(dto.getSecondsRead() != null ? dto.getSecondsRead() : 0);
        entity.setSessionType(dto.getSessionType() != null ? dto.getSessionType() : 1);
        entity.setIsCommon(dto.getIsCommon() != null ? dto.getIsCommon() : false);
        if (dto.getCreatedAt() != null) {
            entity.setCreatedAt(Instant.ofEpochMilli(dto.getCreatedAt()));
        } else {
            entity.setCreatedAt(Instant.now());
        }

        return ReadingSessionDTO.from(repositoryService.getReadingSessionRepository().save(entity));
    }

    @DeleteMapping("/readingSessions/{id}")
    @CacheEvict(cacheNames = "user-statistics", allEntries = true)
    public ResponseEntity<?> deleteReadingSession(HttpSession session, @PathVariable Long id) {
        UserEntity user = getAuthenticatedUser(session);
        return repositoryService.getReadingSessionRepository().findById(id).map(entity -> {
            if (!entity.getUser().getId().equals(user.getId())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }
            repositoryService.getReadingSessionRepository().delete(entity);
            return ResponseEntity.ok().build();
        }).orElse(ResponseEntity.notFound().build());
    }

    private Integer extractTransactionYear(UserBookTransactionEntity tx) {
        if (tx.getTransactionDate() != null) {
            return tx.getTransactionDate().getYear();
        }
        if (tx.getCreatedAt() != null) {
            return tx.getCreatedAt().atZone(ZoneId.of("UTC")).getYear();
        }
        return null;
    }

    @GetMapping("/statistics")
    @Cacheable(cacheNames = "user-statistics", key = "#session.id + ':' + (#year != null ? #year : 'all')", sync = true)
    public UserStatisticsDTO getStatistics(
            HttpSession session,
            @RequestParam(required = false) Integer year
    ) {
        UserEntity user = getAuthenticatedUser(session);

        List<UserOwnsBookEntity> ownedEntities = repositoryService.getUserOwnsBooksRepository()
                .findAllByUserIdAndStatus(user.getId(), UserOwnsBookStatus.OWNED.name())
                .stream()
                .filter(uob -> uob.getBook() != null && !Boolean.TRUE.equals(uob.getBook().getDeleted()))
                .toList();

        List<UserOwnsBookEntity> wishlistEntities = repositoryService.getUserOwnsBooksRepository()
                .findAllByUserIdAndStatus(user.getId(), UserOwnsBookStatus.WISHLISTED.name())
                .stream()
                .filter(uob -> uob.getBook() != null && !Boolean.TRUE.equals(uob.getBook().getDeleted()))
                .toList();

        List<ReadingSessionEntity> allSessions = repositoryService.getReadingSessionRepository()
                .findAllByUserIdOrderByCreatedAtAsc(user.getId())
                .stream()
                .filter(rs -> rs.getBook() != null && !Boolean.TRUE.equals(rs.getBook().getDeleted()))
                .toList();

        List<UserBookTransactionEntity> allTransactions = repositoryService.getUserBookTransactionRepository()
                .findAllByUserIdOrderByTransactionDateDescCreatedAtDesc(user.getId())
                .stream()
                .filter(tx -> tx.getBook() != null && !Boolean.TRUE.equals(tx.getBook().getDeleted()))
                .toList();

        Set<Integer> yearsSet = new TreeSet<>(Comparator.reverseOrder());
        for (ReadingSessionEntity rs : allSessions) {
            if (rs.getCreatedAt() != null) {
                yearsSet.add(rs.getCreatedAt().atZone(ZoneId.of("UTC")).getYear());
            }
        }
        for (UserBookTransactionEntity tx : allTransactions) {
            Integer txYear = extractTransactionYear(tx);
            if (txYear != null) {
                yearsSet.add(txYear);
            }
        }

        List<ReadingSessionEntity> periodSessions = (year == null)
                ? allSessions
                : allSessions.stream()
                        .filter(rs -> rs.getCreatedAt() != null && rs.getCreatedAt().atZone(ZoneId.of("UTC")).getYear() == year)
                        .toList();

        List<UserBookTransactionEntity> periodTransactions = (year == null)
                ? allTransactions
                : allTransactions.stream()
                        .filter(tx -> Objects.equals(extractTransactionYear(tx), year))
                        .toList();

        int boughtCount = 0;
        double boughtAmount = 0.0;
        int giftCount = 0;
        int soldCount = 0;
        double soldAmount = 0.0;

        for (UserBookTransactionEntity tx : periodTransactions) {
            String type = tx.getType() != null ? tx.getType().toUpperCase() : "";
            double txPrice = tx.getPrice() != null ? tx.getPrice().doubleValue() : 0.0;
            if ("BOUGHT".equals(type)) {
                boughtCount++;
                boughtAmount += txPrice;
            } else if ("GIFT".equals(type)) {
                giftCount++;
            } else if ("SOLD".equals(type)) {
                soldCount++;
                soldAmount += txPrice;
            }
        }

        List<BookEntity> targetBooks;
        int targetWishlistCount;
        if (year == null) {
            targetBooks = ownedEntities.stream()
                    .map(UserOwnsBookEntity::getBook)
                    .filter(Objects::nonNull)
                    .toList();
            targetWishlistCount = wishlistEntities.size();
        } else {
            Map<Long, BookEntity> activeBooksMap = new LinkedHashMap<>();
            for (ReadingSessionEntity rs : periodSessions) {
                if (rs.getBook() != null) {
                    activeBooksMap.putIfAbsent(rs.getBook().getId(), rs.getBook());
                }
            }
            for (UserBookTransactionEntity tx : periodTransactions) {
                if (tx.getBook() != null) {
                    activeBooksMap.putIfAbsent(tx.getBook().getId(), tx.getBook());
                }
            }
            targetBooks = new ArrayList<>(activeBooksMap.values());
            targetWishlistCount = (int) wishlistEntities.stream()
                    .filter(uob -> uob.getCreatedAt() != null && uob.getCreatedAt().atZone(ZoneId.of("UTC")).getYear() == year)
                    .count();
        }

        UserStatisticsDTO stats = new UserStatisticsDTO();
        stats.setAvailableYears(new ArrayList<>(yearsSet));
        stats.setTotalOwnedBooks(targetBooks.size());
        stats.setTotalWishlistBooks(targetWishlistCount);
        stats.setTotalBoughtCount(boughtCount);
        stats.setTotalBoughtAmount(Math.round(boughtAmount * 100.0) / 100.0);
        stats.setTotalGiftCount(giftCount);
        stats.setTotalSoldCount(soldCount);
        stats.setTotalSoldAmount(Math.round(soldAmount * 100.0) / 100.0);
        stats.setNetSpentAmount(Math.round((boughtAmount - soldAmount) * 100.0) / 100.0);

        if (targetBooks.isEmpty()) {
            stats.setTotalSeriesCount(0);
            stats.setCompletedSeriesCount(0);
            stats.setTotalPages(0);
            stats.setTotalHeightMeters(0.0);
            stats.setTotalWeightKg(0.0);
            stats.setTotalEstimatedValue(0);
            stats.setAveragePrice(0.0);
            stats.setAveragePagesPerBook(0);
            stats.setBooksReadCount(0);
            stats.setBooksReadingCount(0);
            stats.setBooksToReadCount(0);
            stats.setBooksUnreadCount(0);
            stats.setBooksAbandonedCount(0);
            stats.setBooksOnHoldCount(0);
            stats.setReadingProgressPercentage(0.0);
            stats.setTotalLoggedReadingMinutes(0);
            stats.setTotalReadingSessionsCount(0);
            stats.setHeightComparison("Votre pile est encore vide. Ajoutez vos premiers livres à votre collection !");
            stats.setWeightComparison("Votre bibliothèque est légère comme une plume !");
            stats.setCategoryBreakdown(new ArrayList<>());
            stats.setTopAuthors(new ArrayList<>());
            stats.setTopPublishers(new ArrayList<>());
            stats.setPublicationDecades(new ArrayList<>());
            return stats;
        }

        int totalPages = 0;
        int totalThicknessMm = 0;
        int totalWeightG = 0;
        int totalValue = 0;
        int pricedBooksCount = 0;

        Map<String, Integer> categoryCounts = new LinkedHashMap<>();
        Map<String, Integer> authorCounts = new HashMap<>();
        Map<String, Integer> authorIds = new HashMap<>();
        Map<String, Integer> publisherCounts = new HashMap<>();
        Map<String, Long> publisherIds = new HashMap<>();
        Map<Integer, Integer> seriesOwnedCount = new HashMap<>();
        Map<Integer, SeriesEntity> seriesMap = new HashMap<>();
        Map<String, Integer> decadeCounts = new LinkedHashMap<>();

        decadeCounts.put("Avant 1980", 0);
        decadeCounts.put("1980 - 1989", 0);
        decadeCounts.put("1990 - 1999", 0);
        decadeCounts.put("2000 - 2009", 0);
        decadeCounts.put("2010 - 2019", 0);
        decadeCounts.put("2020+", 0);

        BookEntity oldestBookEntity = null;
        BookEntity newestBookEntity = null;
        BookEntity thickestBookEntity = null;
        BookEntity mostValuableBookEntity = null;
        int maxPages = 0;
        int maxPrice = 0;

        for (BookEntity book : targetBooks) {
            if (book == null) continue;

            String category = "Autre";
            if (book.getSeries() != null && book.getSeries().getCategory() != null) {
                category = book.getSeries().getCategory().getName();
            } else if (book.getType() != null) {
                category = book.getType();
            }
            categoryCounts.put(category, categoryCounts.getOrDefault(category, 0) + 1);

            if (book.getEditor() != null && book.getEditor().getName() != null && !book.getEditor().getName().isBlank()) {
                String edName = book.getEditor().getName().trim();
                publisherCounts.put(edName, publisherCounts.getOrDefault(edName, 0) + 1);
                publisherIds.putIfAbsent(edName, book.getEditor().getId());
            }

            if (book.getSeries() != null && book.getSeries().getId() != null) {
                seriesOwnedCount.put(book.getSeries().getId(), seriesOwnedCount.getOrDefault(book.getSeries().getId(), 0) + 1);
                seriesMap.putIfAbsent(book.getSeries().getId(), book.getSeries());
            }

            int pages = (book.getPageCount() != null && book.getPageCount() > 0)
                    ? book.getPageCount()
                    : getDefaultPages(category);
            totalPages += pages;

            if (pages > maxPages) {
                maxPages = pages;
                thickestBookEntity = book;
            }

            int thickness = (book.getThickness() != null && book.getThickness() > 0)
                    ? book.getThickness()
                    : getDefaultThicknessMm(category);
            totalThicknessMm += thickness;

            int weight = (book.getWeight() != null && book.getWeight() > 0)
                    ? book.getWeight()
                    : getDefaultWeightG(category);
            totalWeightG += weight;

            if (book.getPrice() != null && book.getPrice() > 0) {
                totalValue += book.getPrice();
                pricedBooksCount++;
                if (book.getPrice() > maxPrice) {
                    maxPrice = book.getPrice();
                    mostValuableBookEntity = book;
                }
            }

            if (book.getReleaseDate() != null) {
                if (oldestBookEntity == null || book.getReleaseDate().isBefore(oldestBookEntity.getReleaseDate())) {
                    oldestBookEntity = book;
                }
                if (newestBookEntity == null || book.getReleaseDate().isAfter(newestBookEntity.getReleaseDate())) {
                    newestBookEntity = book;
                }

                int releaseYear = book.getReleaseDate().atZone(ZoneId.of("UTC")).getYear();
                if (releaseYear < 1980) {
                    decadeCounts.put("Avant 1980", decadeCounts.get("Avant 1980") + 1);
                } else if (releaseYear < 1990) {
                    decadeCounts.put("1980 - 1989", decadeCounts.get("1980 - 1989") + 1);
                } else if (releaseYear < 2000) {
                    decadeCounts.put("1990 - 1999", decadeCounts.get("1990 - 1999") + 1);
                } else if (releaseYear < 2010) {
                    decadeCounts.put("2000 - 2009", decadeCounts.get("2000 - 2009") + 1);
                } else if (releaseYear < 2020) {
                    decadeCounts.put("2010 - 2019", decadeCounts.get("2010 - 2019") + 1);
                } else {
                    decadeCounts.put("2020+", decadeCounts.get("2020+") + 1);
                }
            }

            if (book.getBookHasAuthors() != null) {
                for (var bha : book.getBookHasAuthors()) {
                    if (bha.getAuthor() != null && !bha.getAuthor().isCollectif()) {
                        String authorName = (bha.getAuthor().getFirstname() + " " + bha.getAuthor().getLastname()).trim();
                        if (!authorName.isBlank()) {
                            authorCounts.put(authorName, authorCounts.getOrDefault(authorName, 0) + 1);
                            authorIds.putIfAbsent(authorName, bha.getAuthor().getId());
                        }
                    }
                }
            }

        }

        int totalOwned = targetBooks.size();
        stats.setTotalPages(totalPages);
        double heightM = Math.round((totalThicknessMm / 1000.0) * 100.0) / 100.0;
        double weightKg = Math.round((totalWeightG / 1000.0) * 10.0) / 10.0;
        stats.setTotalHeightMeters(heightM);
        stats.setTotalWeightKg(weightKg);
        stats.setTotalEstimatedValue(totalValue);
        stats.setAveragePrice(pricedBooksCount > 0 ? Math.round((totalValue * 1.0 / pricedBooksCount) * 100.0) / 100.0 : 0.0);
        stats.setAveragePagesPerBook(totalOwned > 0 ? (int) Math.round((double) totalPages / totalOwned) : 0);

        stats.setTotalSeriesCount(seriesMap.size());
        int completedSeries = 0;
        for (var entry : seriesOwnedCount.entrySet()) {
            SeriesEntity se = seriesMap.get(entry.getKey());
            if (se != null && se.getTotalVolumes() != null && se.getTotalVolumes() > 0 && entry.getValue() >= se.getTotalVolumes()) {
                completedSeries++;
            }
        }
        stats.setCompletedSeriesCount(completedSeries);

        // Reading status breakdown
        List<BookStatusEntity> statusEntities = repositoryService.getBookStatusRepository().findAllByUserId(user.getId());
        Map<Long, String> readingStatuses = new HashMap<>();
        for (BookStatusEntity bse : statusEntities) {
            if (bse.getBook() != null && !Boolean.TRUE.equals(bse.getBook().getDeleted())) {
                readingStatuses.put(bse.getBook().getId(), bse.getStatus());
            }
        }
        int readCount = 0;
        int readingCount = 0;
        int toReadCount = 0;
        int unreadCount = 0;
        int abandonedCount = 0;
        int onHoldCount = 0;

        for (BookEntity book : targetBooks) {
            if (book == null) continue;
            String st = readingStatuses.get(book.getId());
            if (st == null) {
                toReadCount++;
            } else {
                switch (st.toUpperCase()) {
                    case "READ", "LU" -> readCount++;
                    case "READING", "EN_COURS" -> readingCount++;
                    case "ON_HOLD", "PAUSED", "EN_PAUSE" -> onHoldCount++;
                    case "ABANDONED", "ABANDONNE" -> abandonedCount++;
                    default -> toReadCount++;
                }
            }
        }
        stats.setBooksReadCount(readCount);
        stats.setBooksReadingCount(readingCount);
        stats.setBooksToReadCount(toReadCount);
        stats.setBooksUnreadCount(unreadCount);
        stats.setBooksAbandonedCount(abandonedCount);
        stats.setBooksOnHoldCount(onHoldCount);
        double progressPct = totalOwned > 0 ? Math.round((readCount * 100.0 / totalOwned) * 10.0) / 10.0 : 0.0;
        stats.setReadingProgressPercentage(progressPct);

        // Reading sessions
        int totalMinutes = 0;
        for (ReadingSessionEntity rs : periodSessions) {
            if (rs.getMinutesRead() != null) {
                totalMinutes += rs.getMinutesRead();
            }
        }
        stats.setTotalLoggedReadingMinutes(totalMinutes);
        stats.setTotalReadingSessionsCount(periodSessions.size());

        // Keep comparisons populated for DTO compatibility
        stats.setHeightComparison(computeHeightComparison(heightM));
        stats.setWeightComparison(computeWeightComparison(weightKg));

        // Category breakdown
        List<CategoryStatDTO> categoryList = new ArrayList<>();
        Map<String, String> categoryColors = Map.of(
            "Comics", "#3b82f6",
            "Bande dessinée", "#10b981",
            "Manga", "#f59e0b",
            "Roman", "#8b5cf6",
            "Roman Graphique", "#ec4899",
            "Beau-livre", "#06b6d4",
            "E-book", "#6366f1"
        );
        for (var entry : categoryCounts.entrySet()) {
            double pct = Math.round((entry.getValue() * 100.0 / totalOwned) * 10.0) / 10.0;
            String color = categoryColors.getOrDefault(entry.getKey(), "#64748b");
            categoryList.add(new CategoryStatDTO(entry.getKey(), entry.getValue(), pct, color));
        }
        categoryList.sort((a, b) -> Integer.compare(b.getCount(), a.getCount()));
        stats.setCategoryBreakdown(categoryList);

        // Authors (Top 5)
        List<AuthorHighlightDTO> topAuthorsList = new ArrayList<>();
        var sortedAuthors = authorCounts.entrySet().stream()
                .sorted((a, b) -> Integer.compare(b.getValue(), a.getValue()))
                .toList();

        for (int i = 0; i < Math.min(5, sortedAuthors.size()); i++) {
            var entry = sortedAuthors.get(i);
            double pct = Math.round((entry.getValue() * 100.0 / totalOwned) * 10.0) / 10.0;
            topAuthorsList.add(new AuthorHighlightDTO(
                    authorIds.get(entry.getKey()), entry.getKey(), entry.getValue(), "Auteur", pct
            ));
        }
        stats.setTopAuthors(topAuthorsList);
        if (!topAuthorsList.isEmpty()) {
            stats.setTopAuthor(topAuthorsList.get(0));
        }

        // Publishers (Top 5)
        List<PublisherStatDTO> topPubList = new ArrayList<>();
        var sortedPubs = publisherCounts.entrySet().stream()
                .sorted((a, b) -> Integer.compare(b.getValue(), a.getValue()))
                .toList();

        for (int i = 0; i < Math.min(5, sortedPubs.size()); i++) {
            var entry = sortedPubs.get(i);
            double pct = Math.round((entry.getValue() * 100.0 / totalOwned) * 10.0) / 10.0;
            topPubList.add(new PublisherStatDTO(publisherIds.get(entry.getKey()), entry.getKey(), entry.getValue(), pct));
        }
        stats.setTopPublishers(topPubList);
        if (!topPubList.isEmpty()) {
            stats.setTopPublisher(topPubList.get(0).getName() + " (" + topPubList.get(0).getCount() + " livres)");
        }

        // Publication Decades
        List<DecadeStatDTO> decadeList = new ArrayList<>();
        for (var entry : decadeCounts.entrySet()) {
            if (entry.getValue() > 0) {
                double pct = Math.round((entry.getValue() * 100.0 / totalOwned) * 10.0) / 10.0;
                decadeList.add(new DecadeStatDTO(entry.getKey(), entry.getValue(), pct));
            }
        }
        stats.setPublicationDecades(decadeList);

        // Oldest & Newest
        if (oldestBookEntity != null) {
            String cat = (oldestBookEntity.getSeries() != null && oldestBookEntity.getSeries().getCategory() != null)
                    ? oldestBookEntity.getSeries().getCategory().getName() : "";
            int releaseYear = oldestBookEntity.getReleaseDate() != null ? oldestBookEntity.getReleaseDate().atZone(ZoneId.of("UTC")).getYear() : 0;
            stats.setOldestBook(new BookHighlightDTO(
                oldestBookEntity.getId(),
                oldestBookEntity.getTitle(),
                oldestBookEntity.getReleaseDate() != null ? oldestBookEntity.getReleaseDate().toString() : "",
                oldestBookEntity.getCoverUrl(),
                cat,
                oldestBookEntity.getPageCount(),
                oldestBookEntity.getPrice(),
                releaseYear > 0 ? "Paru en " + releaseYear : ""
            ));
        }

        if (newestBookEntity != null) {
            String cat = (newestBookEntity.getSeries() != null && newestBookEntity.getSeries().getCategory() != null)
                    ? newestBookEntity.getSeries().getCategory().getName() : "";
            int releaseYear = newestBookEntity.getReleaseDate() != null ? newestBookEntity.getReleaseDate().atZone(ZoneId.of("UTC")).getYear() : 0;
            stats.setNewestBook(new BookHighlightDTO(
                newestBookEntity.getId(),
                newestBookEntity.getTitle(),
                newestBookEntity.getReleaseDate() != null ? newestBookEntity.getReleaseDate().toString() : "",
                newestBookEntity.getCoverUrl(),
                cat,
                newestBookEntity.getPageCount(),
                newestBookEntity.getPrice(),
                releaseYear > 0 ? "Paru en " + releaseYear : ""
            ));
        }

        // Thickest Book
        if (thickestBookEntity != null && maxPages > 0) {
            String cat = (thickestBookEntity.getSeries() != null && thickestBookEntity.getSeries().getCategory() != null)
                    ? thickestBookEntity.getSeries().getCategory().getName() : "";
            stats.setThickestBook(new BookHighlightDTO(
                thickestBookEntity.getId(),
                thickestBookEntity.getTitle(),
                thickestBookEntity.getReleaseDate() != null ? thickestBookEntity.getReleaseDate().toString() : "",
                thickestBookEntity.getCoverUrl(),
                cat,
                maxPages,
                thickestBookEntity.getPrice(),
                maxPages + " pages"
            ));
        }

        // Most Valuable Book
        if (mostValuableBookEntity != null && maxPrice > 0) {
            String cat = (mostValuableBookEntity.getSeries() != null && mostValuableBookEntity.getSeries().getCategory() != null)
                    ? mostValuableBookEntity.getSeries().getCategory().getName() : "";
            stats.setMostValuableBook(new BookHighlightDTO(
                mostValuableBookEntity.getId(),
                mostValuableBookEntity.getTitle(),
                mostValuableBookEntity.getReleaseDate() != null ? mostValuableBookEntity.getReleaseDate().toString() : "",
                mostValuableBookEntity.getCoverUrl(),
                cat,
                mostValuableBookEntity.getPageCount(),
                maxPrice,
                maxPrice + " €"
            ));
        }

        return stats;
    }

    private int getDefaultPages(String category) {
        String lower = category.toLowerCase();
        if (lower.contains("manga")) return 192;
        if (lower.contains("comics")) return 160;
        if (lower.contains("bande") || lower.contains("bd")) return 48;
        if (lower.contains("roman") && !lower.contains("graphique")) return 320;
        if (lower.contains("graphique")) return 200;
        return 180;
    }

    private int getDefaultThicknessMm(String category) {
        String lower = category.toLowerCase();
        if (lower.contains("e-book") || lower.contains("ebook")) return 0;
        if (lower.contains("manga")) return 15;
        if (lower.contains("comics")) return 14;
        if (lower.contains("bande") || lower.contains("bd")) return 11;
        if (lower.contains("roman") && !lower.contains("graphique")) return 22;
        return 16;
    }

    private int getDefaultWeightG(String category) {
        String lower = category.toLowerCase();
        if (lower.contains("e-book") || lower.contains("ebook")) return 0;
        if (lower.contains("manga")) return 190;
        if (lower.contains("comics")) return 450;
        if (lower.contains("bande") || lower.contains("bd")) return 520;
        if (lower.contains("roman")) return 350;
        return 350;
    }

    private String computeHeightComparison(double meters) {
        if (meters < 0.28) {
            return String.format("Déjà %.2f m : le début d'une grande collection !", meters);
        } else if (meters < 0.6) {
            return String.format("Votre pile mesure %.2f m : plus haut qu'une boîte de céréales géante !", meters);
        } else if (meters < 1.02) {
            double diff = 1.02 - meters;
            return String.format("Votre pile mesure %.2f m : encore %.2f m pour atteindre la taille d'un poney Shetland (1.02 m) !", meters, diff);
        } else if (meters < 1.75) {
            double diff = 1.75 - meters;
            return String.format("Votre pile mesure %.2f m : plus que %.2f m pour dépasser la taille moyenne d'un humain (1.75 m) !", meters, diff);
        } else if (meters < 2.05) {
            return String.format("Votre pile mesure %.2f m : plus haut que la porte de votre chambre (2.04 m) !", meters);
        } else if (meters < 5.5) {
            double diff = 5.5 - meters;
            return String.format("Votre pile mesure %.2f m : encore %.2f m pour rivaliser avec une girafe mâle adulte (5.50 m) !", meters, diff);
        } else if (meters < 11.0) {
            double diff = 11.0 - meters;
            return String.format("Votre pile mesure %.2f m : encore %.2f m pour arriver à l'envergure d'un Quetzalcoatlus (11 m, le ptérosaure géant) !", meters, diff);
        } else if (meters < 330.0) {
            double diff = 330.0 - meters;
            return String.format("Votre pile mesure %.2f m : encore %.1f m pour dépasser la Tour Eiffel (330 m) !", meters, diff);
        } else {
            return String.format("Incroyable ! Votre pile mesure %.2f m : plus haute que la Tour Eiffel !", meters);
        }
    }

    private String computeWeightComparison(double kg) {
        if (kg < 1.0) {
            return String.format("Votre collection pèse %.2f kg : le poids d'un pigeon voyageur !", kg);
        } else if (kg < 3.0) {
            return String.format("Votre collection pèse %.2f kg : le poids d'une belle miche de pain de campagne !", kg);
        } else if (kg < 6.0) {
            return String.format("Votre collection pèse %.1f kg : le poids d'un bon gros chat de gouttière (4.5 kg) !", kg);
        } else if (kg < 15.0) {
            return String.format("Votre collection pèse %.1f kg : l'équivalent d'un bouledogue français (12 kg) !", kg);
        } else if (kg < 35.0) {
            return String.format("Votre collection pèse %.1f kg : le poids d'un Golden Retriever (30 kg) !", kg);
        } else if (kg < 80.0) {
            return String.format("Votre collection pèse %.1f kg : le poids moyen d'un être humain adulte !", kg);
        } else if (kg < 150.0) {
            return String.format("Votre collection pèse %.1f kg : plus lourd qu'un panda géant (120 kg) !", kg);
        } else if (kg < 300.0) {
            return String.format("Votre collection pèse %.1f kg : le poids d'un lion d'Afrique (200 kg) !", kg);
        } else if (kg < 800.0) {
            return String.format("Votre collection pèse %.1f kg : le poids d'un cheval de selle (500 kg) !", kg);
        } else if (kg < 2000.0) {
            return String.format("Votre collection pèse %.1f kg : le poids d'une citadine automobile !", kg);
        } else if (kg < 5000.0) {
            double diff = 5000.0 - kg;
            return String.format("Votre collection pèse %.1f kg : encore %.0f kg pour atteindre le poids d'un éléphant d'Afrique (5 000 kg) !", kg, diff);
        } else {
            return String.format("Votre collection pèse %.1f kg : plus lourde qu'un éléphant d'Afrique ! Vos étagères supplient pitié !", kg);
        }
    }

    @GetMapping("/retrospective/years")
    public List<Integer> getRetrospectiveYears(HttpSession session) {
        UserEntity user = getAuthenticatedUser(session);
        Set<Integer> years = new TreeSet<>(Comparator.reverseOrder());
        ZoneId parisZone = ZoneId.of("Europe/Paris");

        List<ReadingSessionEntity> allSessions = repositoryService.getReadingSessionRepository()
                .findAllByUserIdOrderByCreatedAtAsc(user.getId());
        for (ReadingSessionEntity rs : allSessions) {
            if (rs.getBook() == null || Boolean.TRUE.equals(rs.getBook().getDeleted()) || rs.getCreatedAt() == null) {
                continue;
            }
            boolean hasReading = (rs.getMinutesRead() != null && rs.getMinutesRead() > 0)
                    || (rs.getSecondsRead() != null && rs.getSecondsRead() > 0)
                    || (rs.getCurrentPage() != null && rs.getCurrentPage() > 0)
                    || (rs.getSessionType() != null && rs.getSessionType() != 0);
            if (hasReading) {
                years.add(rs.getCreatedAt().atZone(parisZone).getYear());
            }
        }

        return new ArrayList<>(years);
    }

    @GetMapping("/retrospective")
    @Cacheable(cacheNames = "user-statistics", key = "'retro:' + #session.id + ':' + #year", sync = true)
    public UserRetrospectiveDTO getRetrospective(
            HttpSession session,
            @RequestParam int year
    ) {
        int currentYear = LocalDate.now(ZoneId.of("UTC")).getYear();
        if (year >= currentYear) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "La rétrospective " + year + " sera disponible à partir du 1er janvier " + (year + 1)
            );
        }

        UserEntity user = getAuthenticatedUser(session);
        ZoneId utc = ZoneId.of("UTC");

        List<ReadingSessionEntity> allSessions = repositoryService.getReadingSessionRepository()
                .findAllByUserIdOrderByCreatedAtAsc(user.getId())
                .stream()
                .filter(rs -> rs.getBook() != null && !Boolean.TRUE.equals(rs.getBook().getDeleted()))
                .toList();

        List<UserBookTransactionEntity> allTransactions = repositoryService.getUserBookTransactionRepository()
                .findAllByUserIdOrderByTransactionDateDescCreatedAtDesc(user.getId())
                .stream()
                .filter(tx -> tx.getBook() != null && !Boolean.TRUE.equals(tx.getBook().getDeleted()))
                .toList();

        List<BookStatusEntity> allStatuses = repositoryService.getBookStatusRepository().findAllByUserId(user.getId())
                .stream()
                .filter(bse -> bse.getBook() != null && !Boolean.TRUE.equals(bse.getBook().getDeleted()))
                .toList();

        Set<Integer> yearsSet = new TreeSet<>(Comparator.reverseOrder());
        for (ReadingSessionEntity rs : allSessions) {
            if (rs.getCreatedAt() != null) {
                yearsSet.add(rs.getCreatedAt().atZone(utc).getYear());
            }
        }
        for (UserBookTransactionEntity tx : allTransactions) {
            Integer txYear = extractTransactionYear(tx);
            if (txYear != null) {
                yearsSet.add(txYear);
            }
        }
        for (BookStatusEntity bse : allStatuses) {
            if (bse.getUpdatedAt() != null) {
                String st = bse.getStatus() != null ? bse.getStatus().toUpperCase() : "";
                if ("READ".equals(st) || "LU".equals(st)) {
                    yearsSet.add(bse.getUpdatedAt().atZone(utc).getYear());
                }
            }
        }

        // Per-book session tracking across all years to compute accurate page deltas in `year`
        Map<Long, BookEntity> bookMap = new LinkedHashMap<>();
        Map<Long, Integer> lastPageByBook = new HashMap<>();
        Map<Long, Integer> pagesReadInYearByBook = new HashMap<>();
        Map<Long, Long> secondsInYearByBook = new HashMap<>();
        Map<Long, Integer> sessionsCountInYearByBook = new HashMap<>();
        Map<Long, Integer> finishedMonthByBook = new HashMap<>();
        Set<LocalDate> readingDatesInYear = new TreeSet<>();

        long totalReadingSeconds = 0L;
        int pagesReadCount = 0;

        for (ReadingSessionEntity rs : allSessions) {
            if (rs.getCreatedAt() == null || rs.getBook() == null) continue;
            BookEntity book = rs.getBook();
            Long bookId = book.getId();
            int sessionYear = rs.getCreatedAt().atZone(utc).getYear();
            int sessionType = rs.getSessionType() != null ? rs.getSessionType() : 1;
            int currentPage = rs.getCurrentPage() != null ? rs.getCurrentPage() : 0;

            int prevPage = lastPageByBook.getOrDefault(bookId, 0);
            int delta = 0;
            if (sessionType == 0) {
                lastPageByBook.put(bookId, currentPage);
            } else {
                if (currentPage > prevPage) {
                    delta = currentPage - prevPage;
                }
                if (sessionType == 2) {
                    lastPageByBook.put(bookId, 0);
                } else {
                    lastPageByBook.put(bookId, currentPage);
                }
            }

            if (sessionYear == year) {
                bookMap.putIfAbsent(bookId, book);
                long sec = (rs.getMinutesRead() != null ? rs.getMinutesRead() * 60L : 0L)
                        + (rs.getSecondsRead() != null ? rs.getSecondsRead() : 0L);
                totalReadingSeconds += sec;
                secondsInYearByBook.put(bookId, secondsInYearByBook.getOrDefault(bookId, 0L) + sec);
                sessionsCountInYearByBook.put(bookId, sessionsCountInYearByBook.getOrDefault(bookId, 0) + 1);

                if (delta > 0) {
                    pagesReadCount += delta;
                    pagesReadInYearByBook.put(bookId, pagesReadInYearByBook.getOrDefault(bookId, 0) + delta);
                }

                LocalDate sessionDate = rs.getCreatedAt().atZone(utc).toLocalDate();
                readingDatesInYear.add(sessionDate);

                if (sessionType == 2) {
                    finishedMonthByBook.putIfAbsent(bookId, sessionDate.getMonthValue());
                }
            }
        }

        // Also include books marked READ/LU in `year` without an END session
        for (BookStatusEntity bse : allStatuses) {
            if (bse.getUpdatedAt() == null || bse.getBook() == null) continue;
            String st = bse.getStatus() != null ? bse.getStatus().toUpperCase() : "";
            if (!"READ".equals(st) && !"LU".equals(st)) continue;
            int statusYear = bse.getUpdatedAt().atZone(utc).getYear();
            if (statusYear == year) {
                BookEntity book = bse.getBook();
                Long bookId = book.getId();
                bookMap.putIfAbsent(bookId, book);
                if (!finishedMonthByBook.containsKey(bookId)) {
                    int month = bse.getUpdatedAt().atZone(utc).getMonthValue();
                    finishedMonthByBook.put(bookId, month);
                    if (!pagesReadInYearByBook.containsKey(bookId) && book.getPageCount() != null && book.getPageCount() > 0) {
                        pagesReadCount += book.getPageCount();
                    }
                }
            }
        }

        // Books considered "read" in `year`
        List<BookEntity> finishedBooks = new ArrayList<>();
        for (Long bookId : finishedMonthByBook.keySet()) {
            BookEntity b = bookMap.get(bookId);
            if (b != null) {
                finishedBooks.add(b);
            }
        }
        // Fallback to active books with reading sessions if no book was explicitly finished
        List<BookEntity> analysisBooks = finishedBooks.isEmpty()
                ? new ArrayList<>(bookMap.values())
                : finishedBooks;

        // Best month
        int[] monthCounts = new int[13];
        for (Integer m : finishedMonthByBook.values()) {
            if (m != null && m >= 1 && m <= 12) {
                monthCounts[m]++;
            }
        }
        String[] frenchMonths = {
                "", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
                "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
        };
        UserRetrospectiveDTO.BestMonthDTO bestMonth = null;
        int bestMonthNum = 0;
        int bestMonthCount = 0;
        for (int m = 1; m <= 12; m++) {
            if (monthCounts[m] > bestMonthCount) {
                bestMonthCount = monthCounts[m];
                bestMonthNum = m;
            }
        }
        if (bestMonthNum > 0) {
            bestMonth = new UserRetrospectiveDTO.BestMonthDTO(bestMonthNum, frenchMonths[bestMonthNum], bestMonthCount);
        }

        // Category, Author, Publisher, Thickest book among analysisBooks
        Map<String, Integer> categoryCounts = new HashMap<>();
        Map<String, Integer> authorCounts = new HashMap<>();
        Map<String, Integer> publisherCounts = new HashMap<>();
        BookEntity thickestEntity = null;
        int maxPages = 0;

        for (BookEntity book : analysisBooks) {
            String cat = null;
            if (book.getSeries() != null && book.getSeries().getCategory() != null) {
                cat = book.getSeries().getCategory().getName();
            } else if (book.getType() != null && !book.getType().isBlank()) {
                cat = book.getType();
            }
            if (cat != null && !cat.isBlank()) {
                categoryCounts.put(cat, categoryCounts.getOrDefault(cat, 0) + 1);
            }

            if (book.getEditor() != null && book.getEditor().getName() != null && !book.getEditor().getName().isBlank()) {
                String ed = book.getEditor().getName().trim();
                publisherCounts.put(ed, publisherCounts.getOrDefault(ed, 0) + 1);
            }

            if (book.getBookHasAuthors() != null) {
                for (BookHasAuthorEntity bha : book.getBookHasAuthors()) {
                    if (bha.getAuthor() != null && !bha.getAuthor().isCollectif()) {
                        String name = (bha.getAuthor().getFirstname() + " " + bha.getAuthor().getLastname()).trim();
                        if (!name.isBlank()) {
                            authorCounts.put(name, authorCounts.getOrDefault(name, 0) + 1);
                        }
                    }
                }
            }

            if (book.getPageCount() != null && book.getPageCount() > maxPages) {
                maxPages = book.getPageCount();
                thickestEntity = book;
            }
        }

        // Longest read book, fastest book, slowest book (across all books with sessions in `year`)
        BookEntity longestReadEntity = null;
        long maxBookSeconds = 0L;
        BookEntity fastestEntity = null;
        double maxSpeed = -1.0;
        BookEntity slowestEntity = null;
        double minSpeed = Double.MAX_VALUE;

        for (Map.Entry<Long, Long> entry : secondsInYearByBook.entrySet()) {
            Long bookId = entry.getKey();
            long secs = entry.getValue();
            BookEntity book = bookMap.get(bookId);
            if (book == null) continue;

            if (secs > maxBookSeconds) {
                maxBookSeconds = secs;
                longestReadEntity = book;
            }

            int pages = pagesReadInYearByBook.getOrDefault(bookId, 0);
            if (pages > 0 && secs >= 60) {
                double speed = pages / (secs / 3600.0);
                if (speed > maxSpeed) {
                    maxSpeed = speed;
                    fastestEntity = book;
                }
                if (speed < minSpeed) {
                    minSpeed = speed;
                    slowestEntity = book;
                }
            }
        }

        // Transactions in `year`
        double totalSpent = 0.0;
        int boughtCount = 0;
        BookEntity mostExpensiveEntity = null;
        double maxTxPrice = 0.0;

        for (UserBookTransactionEntity tx : allTransactions) {
            Integer txYear = extractTransactionYear(tx);
            if (!Objects.equals(txYear, year)) continue;
            String type = tx.getType() != null ? tx.getType().toUpperCase() : "";
            if ("BOUGHT".equals(type)) {
                boughtCount++;
                double p = tx.getPrice() != null ? tx.getPrice().doubleValue() : 0.0;
                totalSpent += p;
                if (p > maxTxPrice) {
                    maxTxPrice = p;
                    mostExpensiveEntity = tx.getBook();
                }
            }
        }

        // Longest streak in `year`
        int readingDaysCount = readingDatesInYear.size();
        int longestStreak = 0;
        LocalDate bestStreakStart = null;
        LocalDate bestStreakEnd = null;
        LocalDate curStart = null;
        LocalDate prevDate = null;
        int curStreak = 0;

        for (LocalDate d : readingDatesInYear) {
            if (prevDate != null && d.equals(prevDate.plusDays(1))) {
                curStreak++;
            } else {
                curStreak = 1;
                curStart = d;
            }
            if (curStreak > longestStreak) {
                longestStreak = curStreak;
                bestStreakStart = curStart;
                bestStreakEnd = d;
            }
            prevDate = d;
        }

        UserRetrospectiveDTO dto = new UserRetrospectiveDTO();
        dto.setYear(year);
        dto.setAvailableYears(new ArrayList<>(yearsSet));
        dto.setBooksReadCount(finishedBooks.size());
        dto.setPagesReadCount(pagesReadCount);
        dto.setThickestBook(toRetroBook(thickestEntity, null, null, null, null, null));
        dto.setTotalReadingSeconds(totalReadingSeconds);
        dto.setLongestReadBook(longestReadEntity != null
                ? toRetroBook(longestReadEntity, null, maxBookSeconds, sessionsCountInYearByBook.get(longestReadEntity.getId()), null, null)
                : null);
        dto.setBestMonth(bestMonth);
        dto.setTopCategory(topEntry(categoryCounts, analysisBooks.size()));
        dto.setTopAuthor(topEntry(authorCounts, analysisBooks.size()));
        dto.setTopPublisher(topEntry(publisherCounts, analysisBooks.size()));
        dto.setTotalSpentAmount(Math.round(totalSpent * 100.0) / 100.0);
        dto.setBoughtBooksCount(boughtCount);
        dto.setMostExpensiveBook(mostExpensiveEntity != null
                ? toRetroBook(mostExpensiveEntity, Math.round(maxTxPrice * 100.0) / 100.0, null, null, null, null)
                : null);
        dto.setFastestBook(fastestEntity != null
                ? toRetroBook(
                        fastestEntity,
                        null,
                        secondsInYearByBook.get(fastestEntity.getId()),
                        null,
                        Math.round(maxSpeed * 10.0) / 10.0,
                        pagesReadInYearByBook.get(fastestEntity.getId())
                )
                : null);
        dto.setSlowestBook(slowestEntity != null
                ? toRetroBook(
                        slowestEntity,
                        null,
                        secondsInYearByBook.get(slowestEntity.getId()),
                        null,
                        Math.round(minSpeed * 10.0) / 10.0,
                        pagesReadInYearByBook.get(slowestEntity.getId())
                )
                : null);
        dto.setLongestStreakDays(longestStreak);
        dto.setLongestStreakStart(bestStreakStart != null ? bestStreakStart.toString() : null);
        dto.setLongestStreakEnd(bestStreakEnd != null ? bestStreakEnd.toString() : null);
        dto.setReadingDaysCount(readingDaysCount);

        return dto;
    }

    private UserRetrospectiveDTO.RetrospectiveBookDTO toRetroBook(
            BookEntity book,
            Double overridePrice,
            Long readingSeconds,
            Integer sessionsCount,
            Double pagesPerHour,
            Integer pagesRead
    ) {
        if (book == null) return null;
        String authorName = "";
        if (book.getBookHasAuthors() != null) {
            authorName = book.getBookHasAuthors().stream()
                    .filter(bha -> bha.getAuthor() != null && !bha.getAuthor().isCollectif())
                    .map(bha -> (bha.getAuthor().getFirstname() + " " + bha.getAuthor().getLastname()).trim())
                    .filter(s -> !s.isBlank())
                    .findFirst()
                    .orElse("");
        }
        Double price = overridePrice != null
                ? overridePrice
                : (book.getPrice() != null ? book.getPrice().doubleValue() : null);
        return new UserRetrospectiveDTO.RetrospectiveBookDTO(
                book.getId(),
                book.getTitle(),
                authorName,
                book.getCoverUrl(),
                book.getPageCount(),
                price,
                readingSeconds,
                sessionsCount,
                pagesPerHour,
                pagesRead
        );
    }

    private UserRetrospectiveDTO.TopStatDTO topEntry(Map<String, Integer> counts, int total) {
        if (counts.isEmpty()) return null;
        var best = counts.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .orElse(null);
        if (best == null) return null;
        double pct = total > 0 ? Math.round((best.getValue() * 100.0 / total) * 10.0) / 10.0 : 0.0;
        return new UserRetrospectiveDTO.TopStatDTO(best.getKey(), best.getValue(), pct);
    }
}
