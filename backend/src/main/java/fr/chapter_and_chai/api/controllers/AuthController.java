package fr.chapter_and_chai.api.controllers;

import fr.chapter_and_chai.api.dtos.auth.LoginRequestDTO;
import fr.chapter_and_chai.api.dtos.auth.LoginResponseDTO;
import fr.chapter_and_chai.api.dtos.auth.RegisterRequestDTO;
import fr.chapter_and_chai.api.dtos.auth.RegisterResponseDTO;
import fr.chapter_and_chai.api.entities.UserEntity;
import fr.chapter_and_chai.api.services.RepositoryService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.AllArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Optional;

@RestController
@AllArgsConstructor
@RequestMapping("/auth")
public class AuthController {

    private final RepositoryService repositoryService;
    private final BCryptPasswordEncoder bCryptPasswordEncoder;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequestDTO loginDTO, HttpSession session) {
        Optional<UserEntity> result = repositoryService.getUserRepository().findByEmail(loginDTO.getEmail());

        if (result.isEmpty())
            return ResponseEntity.badRequest().body("User not found");

        UserEntity userEntity = result.get();

        if (!bCryptPasswordEncoder.matches(loginDTO.getPassword(), userEntity.getPassword()))
            return ResponseEntity.badRequest().body("User not found");

        session.setAttribute("user", userEntity);

        LoginResponseDTO responseDTO = new LoginResponseDTO();
        responseDTO.setId(userEntity.getId());
        responseDTO.setUsername(userEntity.getUsername());
        responseDTO.setFirstname(userEntity.getFirstname());
        responseDTO.setLastname(userEntity.getLastname());
        responseDTO.setEmail(userEntity.getEmail());
        responseDTO.setCreated_at(userEntity.getCreatedAt());
        responseDTO.setUpdated_at(userEntity.getUpdatedAt());

        return ResponseEntity.ok().body(responseDTO);
    }

    @PostMapping("/register")
    public ResponseEntity<Object> register(@RequestBody RegisterRequestDTO user) throws Exception {
        if (repositoryService.getUserRepository()
                .existsByUsernameOrEmail(user.getUsername(), user.getEmail()))
            return ResponseEntity.badRequest().body("Username or email already exists");

        UserEntity userEntity = new UserEntity();
        userEntity.setUsername(user.getUsername());
        userEntity.setFirstname(user.getFirstname());
        userEntity.setLastname(user.getLastname());
        userEntity.setEmail(user.getEmail());
        userEntity.setPassword(bCryptPasswordEncoder.encode(user.getPassword()));

        userEntity = repositoryService.getUserRepository().save(userEntity);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new RegisterResponseDTO(userEntity.getId()));
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpSession session, HttpServletResponse response) {
        session.invalidate();

        return ResponseEntity.ok().body("Logged out");
    }
}