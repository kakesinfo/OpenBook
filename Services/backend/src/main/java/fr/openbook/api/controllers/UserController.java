package fr.openbook.api.controllers;

import fr.openbook.api.dtos.user.UserProfileDTO;
import fr.openbook.api.entities.UserEntity;
import fr.openbook.api.services.RepositoryService;
import jakarta.servlet.http.HttpSession;
import lombok.AllArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@AllArgsConstructor
@RequestMapping("/user")
public class UserController {

    private final RepositoryService repositoryService;

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
}
