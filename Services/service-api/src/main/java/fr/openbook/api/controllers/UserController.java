package fr.openbook.api.controllers;

import fr.openbook.api.dtos.BookDTO;
import fr.openbook.api.dtos.BookSummaryDTO;
import fr.openbook.api.dtos.UserOwnsBookDTO;
import fr.openbook.api.dtos.UserProfileDTO;
import fr.openbook.api.dtos.user.UpdateEmailRequestDTO;
import fr.openbook.api.dtos.user.UpdatePasswordRequestDTO;
import fr.openbook.api.dtos.user.UpdateProfileRequestDTO;
import fr.openbook.api.entities.BookEntity;
import fr.openbook.api.entities.UserEntity;
import fr.openbook.api.entities.UserOwnsBookEntity;
import fr.openbook.api.entities.UserOwnsBookStatus;
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

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
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
        dto.setVolume(book.getVolume());
        dto.setPrice(book.getPrice());
        if (book.getReleaseDate() != null) {
            dto.setReleaseDate(book.getReleaseDate().toString());
        }
        dto.setCoverUrl(book.getCoverUrl());
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

        Map<String, Object> response = new HashMap<>();
        response.put("message", "Adresse email mise à jour avec succès.");
        response.put("email", newEmail);
        response.put("token", newToken);

        return ResponseEntity.ok(response);
    }

    @PutMapping("/password")
    public ResponseEntity<?> updatePassword(@RequestBody UpdatePasswordRequestDTO request, HttpSession session) {
        UserEntity user = getAuthenticatedUser(session);

        if (request.getCurrentPassword() == null || request.getCurrentPassword().isEmpty()) {
            return ResponseEntity.badRequest().body("Le mot de passe actuel est requis pour confirmer le changement.");
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

    @PostMapping("/addBook/{id}/{status}")
    public UserOwnsBookDTO addBook(
        HttpSession session,
        @PathVariable Long id,
        @PathVariable String status
    ) {
        UserEntity user = getAuthenticatedUser(session);

        if (!UserOwnsBookStatus.OWNED.name().equalsIgnoreCase(status)
            && !UserOwnsBookStatus.WISHLISTED.name().equalsIgnoreCase(status)) {
            throw new RuntimeException("Invalid status: " + status);
        }

        System.out.println("Adding book with ID " + id + " and status " + status + " for user " + user.getRealUsername());

        final BookEntity book = repositoryService.getBookRepository()
                .findById(id)
                .orElseThrow(() -> new RuntimeException("Book not found"));

        UserOwnsBookEntity entity = repositoryService.getUserOwnsBooksRepository()
                .findByUserIdAndBookId(user.getId(), id)
                .orElseGet(() -> {
                    UserOwnsBookEntity userOwnsBookEntity = new UserOwnsBookEntity();
                    userOwnsBookEntity.setUser(user);
                    userOwnsBookEntity.setBook(book);
                    return userOwnsBookEntity;
                });

        entity.setStatus(status.toUpperCase());
        System.out.println("Status to save: " + entity.getStatus());

        try {
            UserOwnsBookDTO userOwnsBookDTO = UserOwnsBookDTO.from(repositoryService.getUserOwnsBooksRepository().saveAndFlush(entity));
            System.out.println("New entity: " + userOwnsBookDTO);
            return userOwnsBookDTO;
        } catch (RuntimeException e) {
            System.err.println("Error saving UserOwnsBookEntity: " + e.getMessage());
            throw e;
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
    }

    @GetMapping("/books")
    public List<BookSummaryDTO> getUserBooks(HttpSession session) {
        return getCollection(session);
    }

    @GetMapping("/collection")
    public List<BookSummaryDTO> getCollection(HttpSession session) {
        UserEntity user = getAuthenticatedUser(session);

        return repositoryService.getUserOwnsBooksRepository()
                .findAllByUserIdAndStatus(user.getId(), UserOwnsBookStatus.OWNED.name())
                .stream()
                .map(entity -> entityToSummaryDTO(entity.getBook()))
                .toList();
    }

    @GetMapping("/wishlist")
    public List<BookSummaryDTO> getWishlist(HttpSession session) {
        UserEntity user = getAuthenticatedUser(session);

        return repositoryService.getUserOwnsBooksRepository()
                .findAllByUserIdAndStatus(user.getId(), UserOwnsBookStatus.WISHLISTED.name())
                .stream()
                .map(entity -> entityToSummaryDTO(entity.getBook()))
                .toList();
    }
}
