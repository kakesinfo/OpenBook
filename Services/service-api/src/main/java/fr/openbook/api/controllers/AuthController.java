package fr.openbook.api.controllers;

import fr.openbook.api.dtos.auth.LoginRequestDTO;
import fr.openbook.api.dtos.auth.LoginResponseDTO;
import fr.openbook.api.dtos.auth.RegisterRequestDTO;
import fr.openbook.api.dtos.auth.RegisterResponseDTO;
import fr.openbook.api.entities.UserEntity;
import fr.openbook.api.services.AuthService;
import fr.openbook.api.services.JwtService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.AllArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;

@RestController
@AllArgsConstructor
@RequestMapping("/auth")
public class AuthController
{
    private final AuthService authService;

    private final JwtService jwtService;

    @PostMapping("/register")
    public ResponseEntity<Object> register(@RequestBody RegisterRequestDTO request) throws Exception {
        RegisterResponseDTO user = authService.register(request);

        if (user == null)
            return ResponseEntity.badRequest().body("User already exists");

        return ResponseEntity.status(HttpStatus.OK)
                .body(new RegisterResponseDTO(user.getId()));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequestDTO loginDTO, HttpSession session) {
        UserEntity result = authService.login(loginDTO);

        if (result == null)
            return ResponseEntity.badRequest().body("Invalid credentials");

        session.setAttribute("user", result);

        HashMap<String, Object> claims = new HashMap<>();
        claims.put("username", result.getRealUsername());
        claims.put("email", result.getEmail());

        String jwtToken = jwtService.generateToken(claims, result);

        LoginResponseDTO responseDTO = new LoginResponseDTO();
        responseDTO.setToken(jwtToken);
        responseDTO.setExpiresIn(jwtService.getExpirationTime());

        return ResponseEntity.ok().body(responseDTO);
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpSession session, HttpServletResponse response) {
        session.invalidate();

        return ResponseEntity.ok().body("Logged out");
    }
}