package fr.openbook.api.controllers;

import fr.openbook.api.dtos.auth.LoginRequestDTO;
import fr.openbook.api.dtos.auth.LoginResponseDTO;
import fr.openbook.api.entities.UserEntity;
import fr.openbook.api.services.AuthService;
import fr.openbook.api.services.JwtService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.AllArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.LockedException;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.Map;

@RestController
@AllArgsConstructor
@RequestMapping("/auth")
public class AuthController
{
    private final AuthService authService;
    private final JwtService jwtService;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequestDTO loginDTO, HttpSession session) {
        try {
            UserEntity result = authService.login(loginDTO);

            if (result == null)
                return ResponseEntity.badRequest().body(Map.of("message", "Identifiants invalides"));

            if (result.isBlocked()) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("message", "Ce compte a été suspendu ou bloqué par un administrateur."));
            }

            session.setAttribute("user", result);

            HashMap<String, Object> claims = new HashMap<>();
            claims.put("username", result.getRealUsername());
            claims.put("avatar", result.getAvatar());
            claims.put("role", result.getRole());
            claims.put("mustChangePassword", result.isMustChangePassword());

            String jwtToken = jwtService.generateToken(claims, result);

            LoginResponseDTO responseDTO = new LoginResponseDTO();
            responseDTO.setToken(jwtToken);
            responseDTO.setExpiresIn(jwtService.getExpirationTime());
            responseDTO.setRole(result.getRole());
            responseDTO.setMustChangePassword(result.isMustChangePassword());

            return ResponseEntity.ok().body(responseDTO);
        } catch (ResponseStatusException rse) {
            return ResponseEntity.status(rse.getStatusCode()).body(Map.of("message", rse.getReason()));
        } catch (LockedException | DisabledException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Ce compte a été suspendu ou bloqué par un administrateur."));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", "Identifiants invalides"));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpSession session, HttpServletResponse response) {
        session.invalidate();

        return ResponseEntity.ok().body("Logged out");
    }
}
