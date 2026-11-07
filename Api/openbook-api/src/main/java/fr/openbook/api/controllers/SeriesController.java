package fr.openbook.api.controllers;

import fr.openbook.api.dtos.*;
import fr.openbook.api.entities.*;
import fr.openbook.api.services.RepositoryService;
import fr.openbook.api.services.SeriesService;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/series")
@RequiredArgsConstructor
public class SeriesController {

    private final RepositoryService repositoryService;

    private UserEntity getAuthenticatedUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated() || "anonymousUser".equals(authentication.getName())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not authenticated");
        }
        String username = authentication.getName();
        return repositoryService.getUserRepository()
                .findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
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
    public List<SeriesDTO> getAll(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String category
    ) {
        UserEntity currentUser = getOptionalAuthenticatedUser().orElse(null);

        List<SeriesEntity> seriesList;
        if (query != null && !query.trim().isEmpty()) {
            seriesList = repositoryService.getSeriesRepository().findByNameContainingIgnoreCaseOrderByNameAsc(query.trim());
        } else {
            seriesList = repositoryService.getSeriesRepository().findAllByOrderByNameAsc();
        }

        if (category != null && !category.trim().isEmpty() && !"all".equalsIgnoreCase(category.trim())) {
            seriesList = seriesList.stream()
                    .filter(s -> s.getCategory() != null && Arrays.stream(category.split(",")).map(String::trim).anyMatch(c -> c.equalsIgnoreCase("all") || c.equalsIgnoreCase(s.getCategory().getName())))
                    .toList();
        }

        Set<Integer> followedSeriesIds = Collections.emptySet();
        Map<Integer, Integer> ownedCountMap = Collections.emptyMap();

        if (currentUser != null) {
            followedSeriesIds = repositoryService.getUserFollowsSeriesRepository()
                    .findAllByUserId(currentUser.getId()).stream()
                    .map(ufs -> ufs.getSeries().getId())
                    .collect(Collectors.toSet());

            List<UserOwnsBookEntity> ownedBooks = repositoryService.getUserOwnsBooksRepository()
                    .findAllByUserId(currentUser.getId()).stream()
                    .filter(uob -> UserOwnsBookStatus.OWNED.name().equalsIgnoreCase(uob.getStatus()))
                    .toList();

            ownedCountMap = new HashMap<>();
            for (UserOwnsBookEntity uob : ownedBooks) {
                if (uob.getBook() != null && uob.getBook().getSeries() != null) {
                    Integer sId = uob.getBook().getSeries().getId();
                    ownedCountMap.put(sId, ownedCountMap.getOrDefault(sId, 0) + 1);
                }
            }
        }

        final Set<Integer> fFollowedIds = followedSeriesIds;
        final Map<Integer, Integer> fOwnedCountMap = ownedCountMap;

        return seriesList.stream().map(s -> {
            SeriesDTO dto = SeriesService.entityToDTO(s);
            dto.setIsFollowed(fFollowedIds.contains(s.getId()));
            dto.setOwnedCount(fOwnedCountMap.getOrDefault(s.getId(), 0));
            return dto;
        }).toList();
    }

    @GetMapping("/categories")
    public List<CategoryEntity> getCategories() {
        return repositoryService.getCategoryRepository().findAll();
    }

    @GetMapping("/{id}")
    public SeriesDTO getById(@PathVariable Long id) {
        SeriesEntity series = repositoryService.getSeriesRepository().findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Series not found"));

        UserEntity currentUser = getOptionalAuthenticatedUser().orElse(null);
        return mapSeriesWithBooks(series, currentUser);
    }

    @PostMapping
    public SeriesDTO create(@RequestBody CreateSeriesDTO req) {
        UserEntity currentUser = getAuthenticatedUser();

        if (req.getName() == null || req.getName().trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Series name is required");
        }

        String cleanName = req.getName().trim();
        if (repositoryService.getSeriesRepository().findByNameIgnoreCase(cleanName).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A series with this name already exists");
        }

        CategoryEntity category = null;
        if (req.getCategoryId() != null) {
            category = repositoryService.getCategoryRepository().findById(req.getCategoryId().longValue()).orElse(null);
        }
        if (category == null && req.getCategory() != null && !req.getCategory().trim().isEmpty()) {
            String catName = req.getCategory().trim();
            category = repositoryService.getCategoryRepository().findAll().stream()
                    .filter(c -> c.getName().equalsIgnoreCase(catName))
                    .findFirst()
                    .orElse(null);
        }
        if (category == null) {
            // Default to Comics (ID 3)
            category = repositoryService.getCategoryRepository().findById(3L)
                    .orElseGet(() -> repositoryService.getCategoryRepository().findAll().stream().findFirst().orElse(null));
        }

        SeriesStatus status = SeriesStatus.ON_GOING;
        if (req.getStatus() != null) {
            try {
                status = SeriesStatus.valueOf(req.getStatus().toUpperCase());
            } catch (IllegalArgumentException ignored) {}
        }

        SeriesEntity entity = new SeriesEntity();
        entity.setName(cleanName);
        entity.setDescription(req.getDescription() != null ? req.getDescription().trim() : null);
        entity.setCategory(category);
        entity.setStatus(status);
        entity.setCreatedByUser(currentUser);

        SeriesEntity saved = repositoryService.getSeriesRepository().save(entity);

        // Auto-follow created series for the creator
        if (!repositoryService.getUserFollowsSeriesRepository().existsByUserIdAndSeriesId(currentUser.getId(), saved.getId())) {
            UserFollowsSeriesEntity ufs = new UserFollowsSeriesEntity();
            ufs.setUser(currentUser);
            ufs.setSeries(saved);
            repositoryService.getUserFollowsSeriesRepository().save(ufs);
        }

        // Link initial books if provided
        if (req.getBookIds() != null && !req.getBookIds().isEmpty()) {
            for (Long bookId : req.getBookIds()) {
                if (bookId != null) {
                    repositoryService.getBookRepository().findById(bookId).ifPresent(book -> {
                        book.setSeries(saved);
                        repositoryService.getBookRepository().save(book);
                    });
                }
            }
        }

        return mapSeriesWithBooks(saved, currentUser);
    }

    @PutMapping("/{id}")
    public SeriesDTO update(@PathVariable Long id, @RequestBody UpdateSeriesDTO req) {
        UserEntity currentUser = getAuthenticatedUser();
        SeriesEntity series = repositoryService.getSeriesRepository().findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Series not found"));

        if (req.getName() != null && !req.getName().trim().isEmpty()) {
            String newName = req.getName().trim();
            Optional<SeriesEntity> existing = repositoryService.getSeriesRepository().findByNameIgnoreCase(newName);
            if (existing.isPresent() && !existing.get().getId().equals(series.getId())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "A series with this name already exists");
            }
            series.setName(newName);
        }

        if (req.getDescription() != null) {
            series.setDescription(req.getDescription().trim());
        }

        if (req.getCategoryId() != null) {
            repositoryService.getCategoryRepository().findById(req.getCategoryId().longValue())
                    .ifPresent(series::setCategory);
        } else if (req.getCategory() != null && !req.getCategory().trim().isEmpty()) {
            String catName = req.getCategory().trim();
            repositoryService.getCategoryRepository().findAll().stream()
                    .filter(c -> c.getName().equalsIgnoreCase(catName))
                    .findFirst()
                    .ifPresent(series::setCategory);
        }

        if (req.getStatus() != null) {
            try {
                series.setStatus(SeriesStatus.valueOf(req.getStatus().toUpperCase()));
            } catch (IllegalArgumentException ignored) {}
        }

        SeriesEntity updated = repositoryService.getSeriesRepository().save(series);
        return mapSeriesWithBooks(updated, currentUser);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        getAuthenticatedUser();
        SeriesEntity series = repositoryService.getSeriesRepository().findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Series not found"));

        Integer sId = series.getId();

        // 1. Unlink all books and clear their volume (no series = no volume)
        List<BookEntity> books = repositoryService.getBookRepository().findAllBySeriesId(sId);
        for (BookEntity book : books) {
            book.setSeries(null);
            book.setVolume(null);
            repositoryService.getBookRepository().save(book);
        }

        // 2. Remove follows
        repositoryService.getUserFollowsSeriesRepository().deleteAllBySeriesId(sId);

        // 3. Remove themes
        repositoryService.getSeriesHasThemeRepository().deleteAllBySeriesId(sId);

        // 4. Delete series
        repositoryService.getSeriesRepository().deleteById(id);
    }

    @PostMapping("/{id}/books")
    public SeriesDTO addBookToSeries(@PathVariable Long id, @RequestBody LinkBookToSeriesDTO req) {
        UserEntity currentUser = getAuthenticatedUser();
        SeriesEntity series = repositoryService.getSeriesRepository().findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Series not found"));

        if (req.getBookId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "bookId is required");
        }

        BookEntity book = repositoryService.getBookRepository().findById(req.getBookId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Book not found"));

        book.setSeries(series);
        if (req.getVolume() != null) {
            book.setVolume(req.getVolume());
        }
        repositoryService.getBookRepository().save(book);

        return mapSeriesWithBooks(series, currentUser);
    }

    @DeleteMapping("/{id}/books/{bookId}")
    public SeriesDTO removeBookFromSeries(@PathVariable Long id, @PathVariable Long bookId) {
        UserEntity currentUser = getAuthenticatedUser();
        SeriesEntity series = repositoryService.getSeriesRepository().findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Series not found"));

        BookEntity book = repositoryService.getBookRepository().findById(bookId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Book not found"));

        if (book.getSeries() != null && book.getSeries().getId().equals(series.getId())) {
            book.setSeries(null);
            book.setVolume(null);
            repositoryService.getBookRepository().save(book);
        }

        return mapSeriesWithBooks(series, currentUser);
    }

    @PutMapping("/{id}/books/{bookId}")
    public SeriesDTO updateBookVolumeInSeries(
            @PathVariable Long id,
            @PathVariable Long bookId,
            @RequestBody UpdateBookVolumeDTO req
    ) {
        UserEntity currentUser = getAuthenticatedUser();
        SeriesEntity series = repositoryService.getSeriesRepository().findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Series not found"));

        BookEntity book = repositoryService.getBookRepository().findById(bookId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Book not found"));

        if (book.getSeries() != null && book.getSeries().getId().equals(series.getId())) {
            book.setVolume(req.getVolume());
            repositoryService.getBookRepository().save(book);
        }

        return mapSeriesWithBooks(series, currentUser);
    }

    private SeriesDTO mapSeriesWithBooks(SeriesEntity series, UserEntity currentUser) {
        SeriesDTO dto = SeriesService.entityToDTO(series);

        List<BookEntity> books = repositoryService.getBookRepository()
                .findAllBySeriesIdOrderByVolumeAscIdAsc(series.getId());

        Map<Long, String> userOwnershipMap = Collections.emptyMap();
        Map<Long, String> readingStatusMap = Collections.emptyMap();
        boolean isFollowed = false;

        if (currentUser != null) {
            isFollowed = repositoryService.getUserFollowsSeriesRepository()
                    .existsByUserIdAndSeriesId(currentUser.getId(), series.getId());

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

        dto.setIsFollowed(isFollowed);
        dto.setOwnedCount(ownedCount);
        dto.setBooks(bookDTOs);
        if (dto.getCoverUrl() == null && !bookDTOs.isEmpty()) {
            dto.setCoverUrl(bookDTOs.get(0).getCoverUrl());
        }
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
