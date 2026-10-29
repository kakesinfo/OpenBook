package fr.openbook.api.controllers;

import fr.openbook.api.entities.UserEntity;
import fr.openbook.api.services.ImportService;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/user/import")
@RequiredArgsConstructor
public class ImportController {

    private final ImportService importService;

    private UserEntity getAuthenticatedUser(HttpSession session) {
        if (session != null) {
            UserEntity user = (UserEntity) session.getAttribute("user");
            if (user != null) return user;
        }
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserEntity user) {
            return user;
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur non connecté");
    }

    @PostMapping(value = "/bookmory", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> importBookmory(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "wait", defaultValue = "false") boolean wait,
            HttpSession session
    ) {
        UserEntity user = getAuthenticatedUser(session);

        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Le fichier envoyé est vide"));
        }

        try {
            Map<String, Object> result = importService.importBookmory(file, user.getId(), wait);
            return ResponseEntity.ok(result);
        } catch (IOException ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Erreur lors de la lecture du fichier: " + ex.getMessage()));
        }
    }

    @GetMapping("/status/{jobId}")
    public ResponseEntity<Map<String, Object>> getJobStatus(
            @PathVariable String jobId,
            HttpSession session
    ) {
        // Authenticate user
        getAuthenticatedUser(session);
        Map<String, Object> status = importService.getJobStatus(jobId);
        return ResponseEntity.ok(status);
    }
}
