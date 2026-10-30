package fr.openbook.api.controllers;

import fr.openbook.api.dtos.setup.SetupAdminRequestDTO;
import fr.openbook.api.entities.UserEntity;
import fr.openbook.api.repositories.UserRepository;
import fr.openbook.api.services.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/setup")
@RequiredArgsConstructor
public class SetupController {

    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final BCryptPasswordEncoder passwordEncoder;

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getSetupStatus() {
        boolean hasAdmin = userRepository.countByRole("ROLE_ADMIN") > 0;
        Map<String, Object> response = new HashMap<>();
        response.put("setupRequired", !hasAdmin);
        response.put("configured", hasAdmin);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/admin")
    public ResponseEntity<?> setupAdmin(@RequestBody SetupAdminRequestDTO request) {
        if (userRepository.countByRole("ROLE_ADMIN") > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le serveur est déjà configuré.");
        }

        if (request == null || request.getUsername() == null || request.getUsername().trim().length() < 3) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le nom d'utilisateur doit contenir au moins 3 caractères.");
        }

        if (request.getPassword() == null || request.getPassword().length() < 6) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le mot de passe doit contenir au moins 6 caractères.");
        }

        String username = request.getUsername().trim();
        String email = (request.getEmail() != null && !request.getEmail().trim().isEmpty())
                ? request.getEmail().trim()
                : (username.toLowerCase() + "@openbook.local");

        if (userRepository.findByUsernameIgnoreCase(username).isPresent()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ce nom d'utilisateur est déjà utilisé.");
        }

        if (userRepository.findByEmailIgnoreCase(email).isPresent()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cette adresse e-mail est déjà utilisée.");
        }

        UserEntity admin = new UserEntity();
        admin.setUsername(username);
        admin.setEmail(email);
        admin.setPassword(passwordEncoder.encode(request.getPassword()));
        admin.setRole("ROLE_ADMIN");

        UserEntity savedAdmin = userRepository.save(admin);

        HashMap<String, Object> claims = new HashMap<>();
        claims.put("username", savedAdmin.getRealUsername());
        claims.put("email", savedAdmin.getEmail());
        claims.put("avatar", savedAdmin.getAvatar());
        claims.put("role", savedAdmin.getRole());

        String jwtToken = jwtService.generateToken(claims, savedAdmin);

        Map<String, Object> response = new HashMap<>();
        response.put("token", jwtToken);
        response.put("expiresIn", jwtService.getExpirationTime());
        response.put("role", savedAdmin.getRole());
        response.put("username", savedAdmin.getRealUsername());
        response.put("email", savedAdmin.getEmail());

        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}
