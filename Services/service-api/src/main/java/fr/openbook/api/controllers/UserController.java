package fr.openbook.api.controllers;

import fr.openbook.api.dtos.BookDTO;
import fr.openbook.api.dtos.UserOwnsBookDTO;
import fr.openbook.api.dtos.UserProfileDTO;
import fr.openbook.api.entities.BookEntity;
import fr.openbook.api.entities.UserEntity;
import fr.openbook.api.entities.UserOwnsBookEntity;
import fr.openbook.api.entities.UserOwnsBookStatus;
import fr.openbook.api.repositories.UserOwnsBooksRepository;
import fr.openbook.api.services.RepositoryService;
import jakarta.servlet.http.HttpSession;
import lombok.AllArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Optional;

@RestController
@AllArgsConstructor
@RequestMapping("/user")
public class UserController {

    private final RepositoryService repositoryService;
    private final UserOwnsBooksRepository userOwnsBooksRepository;

    @GetMapping("/profile")
    public UserProfileDTO getProfile(HttpSession session) {
        UserEntity user = (UserEntity) session.getAttribute("user");
        if (user == null) {
            throw new RuntimeException("User not logged in");
        }

        UserProfileDTO userProfileDTO = new UserProfileDTO();
        userProfileDTO.setUsername(user.getRealUsername());
        userProfileDTO.setBooksCount(0);
        userProfileDTO.setBooksToReadCount(0);
        userProfileDTO.setBooksReadThisYearCount(0);

        return userProfileDTO;
    }

    @PostMapping("/addBook/{id}/{status}")
    public UserOwnsBookDTO addBook(
        HttpSession session,
        @PathVariable Long id,
        @PathVariable String status
    ) {
        UserEntity user = (UserEntity) session.getAttribute("user");
        if (user == null) {
            throw new RuntimeException("User not logged in");
        }

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
        UserEntity user = (UserEntity) session.getAttribute("user");
        if (user == null) {
            throw new RuntimeException("User not logged in");
        }

        repositoryService.getUserOwnsBooksRepository()
                .findByUserIdAndBookId(user.getId(), id)
                .ifPresent(entity -> repositoryService.getUserOwnsBooksRepository().delete(entity));
    }

    @GetMapping("/books")
    public List<UserOwnsBookDTO> getUserBooks(HttpSession session) {
        UserEntity user = (UserEntity) session.getAttribute("user");
        if (user == null) {
            throw new RuntimeException("User not logged in");
        }

        return repositoryService.getUserOwnsBooksRepository()
                .findAllByUserIdAndStatus(user.getId(), UserOwnsBookStatus.OWNED.name())
                .stream()
                .map(UserOwnsBookDTO::from)
                .toList();
    }
}
