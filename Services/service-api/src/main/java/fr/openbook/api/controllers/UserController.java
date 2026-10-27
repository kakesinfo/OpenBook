package fr.openbook.api.controllers;

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

import org.springframework.web.bind.annotation.RequestMethod;
import fr.openbook.api.entities.UserOwnsBookStatus;
import org.springframework.web.server.ResponseStatusException;
import fr.openbook.api.dtos.BookDTO;
import fr.openbook.api.dtos.BookSummaryDTO;
import fr.openbook.api.dtos.SeriesDTO;
import fr.openbook.api.services.SeriesService;
import fr.openbook.api.dtos.UserSeriesSummaryDTO;
import java.util.Comparator;
import java.util.Set;
import fr.openbook.api.dtos.UserOwnsBookDTO;
import fr.openbook.api.dtos.UserProfileDTO;
import fr.openbook.api.dtos.UserStatisticsDTO;
import fr.openbook.api.dtos.stats.AuthorHighlightDTO;
import fr.openbook.api.dtos.stats.BookHighlightDTO;
import fr.openbook.api.dtos.stats.CategoryStatDTO;
import fr.openbook.api.dtos.stats.CountryStatDTO;
import fr.openbook.api.dtos.stats.PublisherStatDTO;
import fr.openbook.api.dtos.stats.DecadeStatDTO;
import java.time.ZoneId;
import fr.openbook.api.dtos.user.UpdateEmailRequestDTO;
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
import java.util.stream.Collectors;
import fr.openbook.api.services.AvatarService;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.multipart.MultipartFile;

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
        if (book.getBookHasAuthors() != null && !book.getBookHasAuthors().isEmpty()) {
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
        userProfileDTO.setEmail(user.getEmail());
        userProfileDTO.setAvatar(user.getAvatar());
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
            user.setAvatar(request.getAvatar().trim());
        }

        user = repositoryService.getUserRepository().save(user);

        if (session != null) {
            session.setAttribute("user", user);
        }

        HashMap<String, Object> claims = new HashMap<>();
        claims.put("username", user.getRealUsername());
        claims.put("email", user.getEmail());
        if (user.getAvatar() != null) {
            claims.put("avatar", user.getAvatar());
        }

        String newToken = jwtService.generateToken(claims, user);

        UserProfileDTO profileDTO = new UserProfileDTO();
        profileDTO.setUsername(user.getRealUsername());
        profileDTO.setEmail(user.getEmail());
        profileDTO.setAvatar(user.getAvatar());

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
            String filename = avatarService.saveAvatar(file);
            String avatarUrl = "/user/avatar/" + filename;

            user.setAvatar(avatarUrl);
            user = repositoryService.getUserRepository().save(user);

            if (session != null) {
                session.setAttribute("user", user);
            }

            HashMap<String, Object> claims = new HashMap<>();
            claims.put("username", user.getRealUsername());
            claims.put("email", user.getEmail());
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

    @GetMapping("/avatar/{filename}")
    public ResponseEntity<Resource> getAvatar(@PathVariable String filename) {
        Resource resource = avatarService.loadAvatarResource(filename);
        if (resource == null) {
            return ResponseEntity.notFound().build();
        }

        MediaType mediaType = filename.toLowerCase().endsWith(".png")
                ? MediaType.IMAGE_PNG
                : MediaType.IMAGE_JPEG;

        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CACHE_CONTROL, "public, max-age=86400")
                .header("X-Content-Type-Options", "nosniff")
                .body(resource);
    }

    @PutMapping("/email")
    public ResponseEntity<?> updateEmail(@RequestBody UpdateEmailRequestDTO request, HttpSession session) {
        UserEntity user = getAuthenticatedUser(session);

        if (request.getCurrentPassword() == null || request.getCurrentPassword().isEmpty()) {
            return ResponseEntity.badRequest().body("Le mot de passe actuel est requis pour confirmer la modification de l'email.");
        }

        if (!bCryptPasswordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
            return ResponseEntity.badRequest().body("Mot de passe actuel incorrect.");
        }

        if (request.getEmail() == null || request.getEmail().trim().isEmpty()) {
            return ResponseEntity.badRequest().body("La nouvelle adresse email est requise.");
        }

        String newEmail = request.getEmail().trim();
        if (repositoryService.getUserRepository().existsByEmailAndIdNot(newEmail, user.getId())) {
            return ResponseEntity.badRequest().body("Cette adresse email est déjà utilisée.");
        }

        user.setEmail(newEmail);
        user = repositoryService.getUserRepository().save(user);

        if (session != null) {
            session.setAttribute("user", user);
        }

        HashMap<String, Object> claims = new HashMap<>();
        claims.put("username", user.getRealUsername());
        claims.put("email", user.getEmail());
        if (user.getAvatar() != null) {
            claims.put("avatar", user.getAvatar());
        }

        String newToken = jwtService.generateToken(claims, user);

        return ResponseEntity.ok(Map.of(
                "message", "Adresse email modifiée avec succès.",
                "email", newEmail,
                "token", newToken
        ));
    }

    @PutMapping("/password")
    public ResponseEntity<?> updatePassword(@RequestBody UpdatePasswordRequestDTO request, HttpSession session) {
        UserEntity user = getAuthenticatedUser(session);

        if (request.getCurrentPassword() == null || request.getCurrentPassword().isEmpty()) {
            return ResponseEntity.badRequest().body("Le mot de passe actuel est requis.");
        }

        if (!bCryptPasswordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
            return ResponseEntity.badRequest().body("Mot de passe actuel incorrect.");
        }

        if (request.getNewPassword() == null || request.getNewPassword().length() < 6) {
            return ResponseEntity.badRequest().body("Le nouveau mot de passe doit comporter au moins 6 caractères.");
        }

        user.setPassword(bCryptPasswordEncoder.encode(request.getNewPassword()));
        repositoryService.getUserRepository().save(user);

        return ResponseEntity.ok(Map.of("message", "Mot de passe modifié avec succès."));
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
    public UserOwnsBookDTO addBook(
        HttpSession session,
        @PathVariable Long id,
        @PathVariable String status
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
            if (uob.getBook() != null) {
                BookSummaryDTO dto = entityToSummaryDTO(uob.getBook());
                dto.setStatus(uob.getStatus());
                bookMap.put(uob.getBook().getId(), dto);
            }
        }

        // 2. Reading statuses from book_status
        List<BookStatusEntity> readingStatuses = repositoryService.getBookStatusRepository().findAllByUserId(userId);
        for (BookStatusEntity bse : readingStatuses) {
            if (bse.getBook() != null) {
                Long bId = bse.getBook().getId();
                BookSummaryDTO dto = bookMap.computeIfAbsent(bId, k -> {
                    BookSummaryDTO d = entityToSummaryDTO(bse.getBook());
                    d.setStatus("OWNED");
                    return d;
                });
                dto.setReadingStatus(bse.getStatus());
            }
        }

        // 3. Books from reading sessions
        List<ReadingSessionEntity> sessions = repositoryService.getReadingSessionRepository().findAllByUserIdOrderByCreatedAtAsc(userId);
        for (ReadingSessionEntity rse : sessions) {
            if (rse.getBook() != null) {
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

    @GetMapping({"/collection", "/library", "/bibliotheque"})
    public List<BookSummaryDTO> getCollection(HttpSession session) {
        UserEntity user = getAuthenticatedUser(session);

        List<UserOwnsBookEntity> ownedEntries = repositoryService.getUserOwnsBooksRepository()
                .findAllByUserId(user.getId()).stream()
                .filter(uob -> UserOwnsBookStatus.OWNED.name().equalsIgnoreCase(uob.getStatus()))
                .toList();

        Map<Long, String> readingStatusMap = repositoryService.getBookStatusRepository()
                .findAllByUserId(user.getId()).stream()
                .filter(bse -> bse.getBook() != null)
                .collect(Collectors.toMap(bse -> bse.getBook().getId(), BookStatusEntity::getStatus, (s1, s2) -> s1));

        return ownedEntries.stream()
                .map(entity -> {
                    BookSummaryDTO dto = entityToSummaryDTO(entity.getBook());
                    dto.setStatus(entity.getStatus());
                    dto.setReadingStatus(readingStatusMap.getOrDefault(entity.getBook().getId(), "UNREAD"));
                    return dto;
                })
                .toList();
    }

    @GetMapping({"/collection/series", "/library/series", "/bibliotheque/series"})
    public List<UserSeriesSummaryDTO> getCollectionGroupedBySeries(HttpSession session) {
        UserEntity user = getAuthenticatedUser(session);

        List<UserOwnsBookEntity> ownedEntries = repositoryService.getUserOwnsBooksRepository()
                .findAllByUserId(user.getId()).stream()
                .filter(uob -> UserOwnsBookStatus.OWNED.name().equalsIgnoreCase(uob.getStatus()))
                .toList();

        Map<Long, String> readingStatusMap = repositoryService.getBookStatusRepository()
                .findAllByUserId(user.getId()).stream()
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

            BookSummaryDTO bookDto = entityToSummaryDTO(book);
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
                    return dto;
                })
                .toList();
    }

    @RequestMapping(value = "/sales/{bookId}/status/{status}", method = {RequestMethod.PUT, RequestMethod.POST})
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

        entity.setStatus(upperStatus);
        if (request != null && request.getPrice() != null) {
            entity.setPrice(request.getPrice());
        }
        repositoryService.getUserSellsBookRepository().saveAndFlush(entity);

        if ("SOLD".equals(upperStatus)) {
            UserBookTransactionEntity tx = new UserBookTransactionEntity();
            tx.setUser(user);
            tx.setBook(entity.getBook());
            tx.setType("SOLD");
            LocalDate txDate = LocalDate.now();
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

        return repositoryService.getUserOwnsBooksRepository()
                .findAllByUserIdAndStatus(user.getId(), UserOwnsBookStatus.WISHLISTED.name())
                .stream()
                .map(entity -> {
                    BookSummaryDTO dto = entityToSummaryDTO(entity.getBook());
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
        if (!"BOUGHT".equals(type) && !"SOLD".equals(type)) {
            type = "BOUGHT";
        }

        UserBookTransactionEntity tx = new UserBookTransactionEntity();
        tx.setUser(user);
        tx.setBook(book);
        tx.setType(type);
        LocalDate txDate = LocalDate.now();
        if (req.getDate() != null && !req.getDate().trim().isEmpty()) {
            try {
                txDate = LocalDate.parse(req.getDate().trim());
            } catch (Exception ignored) {}
        }
        tx.setTransactionDate(txDate);
        tx.setPrice(req.getPrice());
        tx.setLocation(req.getLocation());
        tx.setMemo(req.getMemo());

        UserBookTransactionEntity saved = repositoryService.getUserBookTransactionRepository().saveAndFlush(tx);

        if ("BOUGHT".equals(type)) {
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
        if (dto.getCreatedAt() != null) {
            entity.setCreatedAt(Instant.ofEpochMilli(dto.getCreatedAt()));
        } else {
            entity.setCreatedAt(Instant.now());
        }

        return ReadingSessionDTO.from(repositoryService.getReadingSessionRepository().save(entity));
    }

    @DeleteMapping("/readingSessions/{id}")
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

    @GetMapping("/statistics")
    public UserStatisticsDTO getStatistics(HttpSession session) {
        UserEntity user = getAuthenticatedUser(session);

        List<UserOwnsBookEntity> ownedEntities = repositoryService.getUserOwnsBooksRepository()
                .findAllByUserIdAndStatus(user.getId(), UserOwnsBookStatus.OWNED.name());

        List<UserOwnsBookEntity> wishlistEntities = repositoryService.getUserOwnsBooksRepository()
                .findAllByUserIdAndStatus(user.getId(), UserOwnsBookStatus.WISHLISTED.name());

        UserStatisticsDTO stats = new UserStatisticsDTO();
        stats.setTotalOwnedBooks(ownedEntities.size());
        stats.setTotalWishlistBooks(wishlistEntities.size());

        if (ownedEntities.isEmpty()) {
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
            stats.setReadingProgressPercentage(0.0);
            stats.setTotalLoggedReadingMinutes(0);
            stats.setTotalReadingSessionsCount(0);
            stats.setHeightComparison("Votre pile est encore vide. Ajoutez vos premiers livres à votre collection !");
            stats.setWeightComparison("Votre bibliothèque est légère comme une plume !");
            stats.setCategoryBreakdown(new ArrayList<>());
            stats.setTotalCountriesCount(0);
            stats.setCountries(new ArrayList<>());
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
        Map<String, Integer> countryCounts = new HashMap<>();
        Map<String, Integer> authorCounts = new HashMap<>();
        Map<String, Integer> publisherCounts = new HashMap<>();
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

        for (UserOwnsBookEntity uob : ownedEntities) {
            BookEntity book = uob.getBook();
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

                int year = book.getReleaseDate().atZone(ZoneId.of("UTC")).getYear();
                if (year < 1980) {
                    decadeCounts.put("Avant 1980", decadeCounts.get("Avant 1980") + 1);
                } else if (year < 1990) {
                    decadeCounts.put("1980 - 1989", decadeCounts.get("1980 - 1989") + 1);
                } else if (year < 2000) {
                    decadeCounts.put("1990 - 1999", decadeCounts.get("1990 - 1999") + 1);
                } else if (year < 2010) {
                    decadeCounts.put("2000 - 2009", decadeCounts.get("2000 - 2009") + 1);
                } else if (year < 2020) {
                    decadeCounts.put("2010 - 2019", decadeCounts.get("2010 - 2019") + 1);
                } else {
                    decadeCounts.put("2020+", decadeCounts.get("2020+") + 1);
                }
            }

            if (book.getBookHasAuthors() != null) {
                for (var bha : book.getBookHasAuthors()) {
                    if (bha.getAuthor() != null) {
                        String authorName = (bha.getAuthor().getFirstname() + " " + bha.getAuthor().getLastname()).trim();
                        if (!authorName.isBlank()) {
                            authorCounts.put(authorName, authorCounts.getOrDefault(authorName, 0) + 1);
                        }
                    }
                }
            }

            String cCode = book.getOriginCountry();
            if (cCode == null || cCode.isBlank()) {
                cCode = inferCountry(book, category);
            }
            countryCounts.put(cCode.toUpperCase(), countryCounts.getOrDefault(cCode.toUpperCase(), 0) + 1);
        }

        int totalOwned = ownedEntities.size();
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
            if (bse.getBook() != null) {
                readingStatuses.put(bse.getBook().getId(), bse.getStatus());
            }
        }
        int readCount = 0;
        int readingCount = 0;
        int toReadCount = 0;
        int unreadCount = 0;
        int abandonedCount = 0;

        for (UserOwnsBookEntity uob : ownedEntities) {
            BookEntity book = uob.getBook();
            if (book == null) continue;
            String st = readingStatuses.get(book.getId());
            if (st == null) {
                unreadCount++;
            } else {
                switch (st.toUpperCase()) {
                    case "READ" -> readCount++;
                    case "READING" -> readingCount++;
                    case "TO_READ" -> toReadCount++;
                    case "ABANDONED" -> abandonedCount++;
                    default -> unreadCount++;
                }
            }
        }
        stats.setBooksReadCount(readCount);
        stats.setBooksReadingCount(readingCount);
        stats.setBooksToReadCount(toReadCount);
        stats.setBooksUnreadCount(unreadCount);
        stats.setBooksAbandonedCount(abandonedCount);
        double progressPct = totalOwned > 0 ? Math.round((readCount * 100.0 / totalOwned) * 10.0) / 10.0 : 0.0;
        stats.setReadingProgressPercentage(progressPct);

        // Reading sessions
        List<ReadingSessionEntity> sessions = repositoryService.getReadingSessionRepository().findAllByUserIdOrderByCreatedAtAsc(user.getId());
        int totalMinutes = 0;
        for (ReadingSessionEntity rs : sessions) {
            if (rs.getMinutesRead() != null) {
                totalMinutes += rs.getMinutesRead();
            }
        }
        stats.setTotalLoggedReadingMinutes(totalMinutes);
        stats.setTotalReadingSessionsCount(sessions.size());

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
            "Beau-livre", "#06b6d4"
        );
        for (var entry : categoryCounts.entrySet()) {
            double pct = Math.round((entry.getValue() * 100.0 / totalOwned) * 10.0) / 10.0;
            String color = categoryColors.getOrDefault(entry.getKey(), "#64748b");
            categoryList.add(new CategoryStatDTO(entry.getKey(), entry.getValue(), pct, color));
        }
        categoryList.sort((a, b) -> Integer.compare(b.getCount(), a.getCount()));
        stats.setCategoryBreakdown(categoryList);

        // Countries
        List<CountryStatDTO> countryList = new ArrayList<>();
        for (var entry : countryCounts.entrySet()) {
            String code = entry.getKey();
            int count = entry.getValue();
            double pct = Math.round((count * 100.0 / totalOwned) * 10.0) / 10.0;
            countryList.add(new CountryStatDTO(code, getCountryName(code), getCountryFlag(code), count, pct));
        }
        countryList.sort((a, b) -> Integer.compare(b.getCount(), a.getCount()));
        stats.setCountries(countryList);
        stats.setTotalCountriesCount(countryList.size());

        // Authors (Top 5)
        List<AuthorHighlightDTO> topAuthorsList = new ArrayList<>();
        var sortedAuthors = authorCounts.entrySet().stream()
                .sorted((a, b) -> Integer.compare(b.getValue(), a.getValue()))
                .toList();

        for (int i = 0; i < Math.min(5, sortedAuthors.size()); i++) {
            var entry = sortedAuthors.get(i);
            double pct = Math.round((entry.getValue() * 100.0 / totalOwned) * 10.0) / 10.0;
            topAuthorsList.add(new AuthorHighlightDTO(entry.getKey(), entry.getValue(), "Auteur", pct));
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
            topPubList.add(new PublisherStatDTO(entry.getKey(), entry.getValue(), pct));
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
            int year = oldestBookEntity.getReleaseDate() != null ? oldestBookEntity.getReleaseDate().atZone(ZoneId.of("UTC")).getYear() : 0;
            stats.setOldestBook(new BookHighlightDTO(
                oldestBookEntity.getId(),
                oldestBookEntity.getTitle(),
                oldestBookEntity.getReleaseDate() != null ? oldestBookEntity.getReleaseDate().toString() : "",
                oldestBookEntity.getCoverUrl(),
                cat,
                oldestBookEntity.getPageCount(),
                oldestBookEntity.getPrice(),
                year > 0 ? "Paru en " + year : ""
            ));
        }

        if (newestBookEntity != null) {
            String cat = (newestBookEntity.getSeries() != null && newestBookEntity.getSeries().getCategory() != null)
                    ? newestBookEntity.getSeries().getCategory().getName() : "";
            int year = newestBookEntity.getReleaseDate() != null ? newestBookEntity.getReleaseDate().atZone(ZoneId.of("UTC")).getYear() : 0;
            stats.setNewestBook(new BookHighlightDTO(
                newestBookEntity.getId(),
                newestBookEntity.getTitle(),
                newestBookEntity.getReleaseDate() != null ? newestBookEntity.getReleaseDate().toString() : "",
                newestBookEntity.getCoverUrl(),
                cat,
                newestBookEntity.getPageCount(),
                newestBookEntity.getPrice(),
                year > 0 ? "Paru en " + year : ""
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
        if (lower.contains("manga")) return 15;
        if (lower.contains("comics")) return 14;
        if (lower.contains("bande") || lower.contains("bd")) return 11;
        if (lower.contains("roman") && !lower.contains("graphique")) return 22;
        return 16;
    }

    private int getDefaultWeightG(String category) {
        String lower = category.toLowerCase();
        if (lower.contains("manga")) return 190;
        if (lower.contains("comics")) return 450;
        if (lower.contains("bande") || lower.contains("bd")) return 520;
        if (lower.contains("roman")) return 350;
        return 350;
    }

    private String inferCountry(BookEntity book, String category) {
        String lowerCat = category.toLowerCase();
        if (lowerCat.contains("manga")) return "JP";
        if (lowerCat.contains("comics")) return "US";
        if (lowerCat.contains("bande") || lowerCat.contains("bd")) {
            String title = book.getTitle().toLowerCase();
            if (title.contains("tintin") || title.contains("spirou") || title.contains("seuls")) return "BE";
            return "FR";
        }
        return "FR";
    }

    private String getCountryName(String code) {
        return switch (code) {
            case "FR" -> "France";
            case "US" -> "États-Unis";
            case "JP" -> "Japon";
            case "GB" -> "Royaume-Uni";
            case "BE" -> "Belgique";
            case "DE" -> "Allemagne";
            case "IT" -> "Italie";
            case "ES" -> "Espagne";
            case "CA" -> "Canada";
            case "KR" -> "Corée du Sud";
            default -> code;
        };
    }

    private String getCountryFlag(String code) {
        return switch (code) {
            case "FR" -> "🇫🇷";
            case "US" -> "🇺🇸";
            case "JP" -> "🇯🇵";
            case "GB" -> "🇬🇧";
            case "BE" -> "🇧🇪";
            case "DE" -> "🇩🇪";
            case "IT" -> "🇮🇹";
            case "ES" -> "🇪🇸";
            case "CA" -> "🇨🇦";
            case "KR" -> "🇰🇷";
            default -> "🌐";
        };
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
}
