package fr.openbook.api.controllers;

import fr.openbook.api.dtos.admin.AdminCreateUserRequestDTO;
import fr.openbook.api.dtos.admin.AdminResetPasswordRequestDTO;
import fr.openbook.api.dtos.admin.AdminSetBlockStatusRequestDTO;
import fr.openbook.api.dtos.admin.AdminUserDTO;
import fr.openbook.api.entities.UserEntity;
import fr.openbook.api.repositories.UserOwnsBooksRepository;
import fr.openbook.api.services.AuditLogService;
import fr.openbook.api.services.AvatarService;
import fr.openbook.api.services.RepositoryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/admin/users")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class AdminUserController {

    private final RepositoryService repositoryService;
    private final UserOwnsBooksRepository userOwnsBooksRepository;
    private final BCryptPasswordEncoder bCryptPasswordEncoder;
    private final AvatarService avatarService;
    private final AuditLogService auditLogService;

    private UserEntity getAuthenticatedUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserEntity user) {
            return user;
        }
        String username = auth != null ? auth.getName() : null;
        if (username != null) {
            return repositoryService.getUserRepository().findByUsernameIgnoreCase(username)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable"));
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Non authentifié");
    }

    private AdminUserDTO toDto(UserEntity entity) {
        AdminUserDTO dto = new AdminUserDTO();
        dto.setId(entity.getId());
        dto.setUsername(entity.getRealUsername());
        dto.setRole(entity.getRole());
        dto.setAvatar(entity.getAvatar());
        dto.setBlocked(entity.isBlocked());
        dto.setMustChangePassword(entity.isMustChangePassword());
        dto.setCreatedAt(entity.getCreatedAt());
        dto.setUpdatedAt(entity.getUpdatedAt());
        dto.setBooksCount(userOwnsBooksRepository.countByUserId(entity.getId()));
        return dto;
    }

    /**
     * Lists all users in the application.
     */
    @GetMapping
    public ResponseEntity<List<AdminUserDTO>> getAllUsers() {
        List<UserEntity> users = repositoryService.getUserRepository().findAll(Sort.by(Sort.Direction.ASC, "id"));
        List<AdminUserDTO> dtos = users.stream().map(this::toDto).collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    /**
     * Admin creates a user account with a temporary password and mustChangePassword=true.
     */
    @PostMapping
    public ResponseEntity<?> createUser(@RequestBody AdminCreateUserRequestDTO request) {
        if (request == null || request.getUsername() == null || request.getUsername().trim().length() < 3) {
            return ResponseEntity.badRequest().body(Map.of("message", "Le nom d'utilisateur doit contenir au moins 3 caractères."));
        }

        if (request.getTemporaryPassword() == null || request.getTemporaryPassword().trim().length() < 6) {
            return ResponseEntity.badRequest().body(Map.of("message", "Le mot de passe provisoire doit comporter au moins 6 caractères."));
        }

        String username = request.getUsername().trim();
        if (repositoryService.getUserRepository().findByUsernameIgnoreCase(username).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Ce nom d'utilisateur est déjà utilisé."));
        }

        String role = request.getRole() != null && !request.getRole().isBlank() ? request.getRole().trim().toUpperCase() : "ROLE_USER";
        if (!role.startsWith("ROLE_")) {
            role = "ROLE_" + role;
        }
        if (!"ROLE_USER".equals(role) && !"ROLE_ADMIN".equals(role)) {
            role = "ROLE_USER";
        }

        UserEntity user = new UserEntity();
        user.setUsername(username);
        user.setPassword(bCryptPasswordEncoder.encode(request.getTemporaryPassword().trim()));
        user.setRole(role);
        user.setBlocked(false);
        user.setMustChangePassword(true);

        UserEntity savedUser = repositoryService.getUserRepository().save(user);
        log.info("[AdminUser] Created user id={} username={} role={} with temporary password",
                savedUser.getId(), savedUser.getUsername(), savedUser.getRole());
        auditLogService.logAdmin("USER", "Création d'utilisateur", AuditLogService.STATUS_SUCCESS,
                "Utilisateur '" + savedUser.getRealUsername() + "' créé (" + savedUser.getRole() + ")");

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "message", "Compte utilisateur créé avec succès avec un mot de passe provisoire.",
                "user", toDto(savedUser),
                "temporaryPassword", request.getTemporaryPassword().trim()
        ));
    }

    /**
     * Block or unblock a user account.
     */
    @PutMapping("/{id}/block")
    public ResponseEntity<?> setBlockStatus(@PathVariable Long id, @RequestBody(required = false) AdminSetBlockStatusRequestDTO request) {
        UserEntity currentUser = getAuthenticatedUser();
        if (currentUser.getId().equals(id)) {
            return ResponseEntity.badRequest().body(Map.of("message", "Vous ne pouvez pas modifier le statut de blocage de votre propre compte."));
        }

        UserEntity user = repositoryService.getUserRepository().findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Utilisateur introuvable"));

        boolean newStatus = (request != null) ? request.isBlocked() : !user.isBlocked();
        user.setBlocked(newStatus);
        repositoryService.getUserRepository().save(user);

        log.info("[AdminUser] User id={} username={} blocked={}", user.getId(), user.getUsername(), newStatus);
        auditLogService.logAdmin("USER", "Modification d'utilisateur", AuditLogService.STATUS_SUCCESS,
                (newStatus ? "Blocage" : "Déblocage") + " de l'utilisateur '" + user.getRealUsername() + "'");

        return ResponseEntity.ok(Map.of(
                "message", newStatus ? "Utilisateur bloqué avec succès." : "Utilisateur débloqué avec succès.",
                "user", toDto(user)
        ));
    }

    @PostMapping("/{id}/block")
    public ResponseEntity<?> blockUser(@PathVariable Long id) {
        AdminSetBlockStatusRequestDTO req = new AdminSetBlockStatusRequestDTO();
        req.setBlocked(true);
        return setBlockStatus(id, req);
    }

    @PostMapping("/{id}/unblock")
    public ResponseEntity<?> unblockUser(@PathVariable Long id) {
        AdminSetBlockStatusRequestDTO req = new AdminSetBlockStatusRequestDTO();
        req.setBlocked(false);
        return setBlockStatus(id, req);
    }

    /**
     * Set a new temporary password for a user.
     */
    @PutMapping("/{id}/reset-password")
    public ResponseEntity<?> resetPassword(@PathVariable Long id, @RequestBody AdminResetPasswordRequestDTO request) {
        if (request == null || request.getTemporaryPassword() == null || request.getTemporaryPassword().trim().length() < 6) {
            return ResponseEntity.badRequest().body(Map.of("message", "Le nouveau mot de passe provisoire doit comporter au moins 6 caractères."));
        }

        UserEntity user = repositoryService.getUserRepository().findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Utilisateur introuvable"));

        user.setPassword(bCryptPasswordEncoder.encode(request.getTemporaryPassword().trim()));
        user.setMustChangePassword(true);
        repositoryService.getUserRepository().save(user);

        log.info("[AdminUser] Password reset for user id={} username={}", user.getId(), user.getUsername());
        auditLogService.logAdmin("USER", "Réinitialisation de mot de passe", AuditLogService.STATUS_SUCCESS,
                "Mot de passe provisoire réinitialisé pour '" + user.getRealUsername() + "'");

        return ResponseEntity.ok(Map.of(
                "message", "Nouveau mot de passe provisoire défini. L'utilisateur devra le changer à sa prochaine connexion.",
                "user", toDto(user),
                "temporaryPassword", request.getTemporaryPassword().trim()
        ));
    }

    /**
     * Deletes a user account and all their related data.
     */
    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<?> deleteUser(@PathVariable Long id) {
        UserEntity currentUser = getAuthenticatedUser();
        if (currentUser.getId().equals(id)) {
            return ResponseEntity.badRequest().body(Map.of("message", "Vous ne pouvez pas supprimer votre propre compte depuis ce panneau."));
        }

        UserEntity user = repositoryService.getUserRepository().findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Utilisateur introuvable"));

        // Delete user owned books
        userOwnsBooksRepository.deleteAllByUserId(id);

        // Delete avatar if exists
        if (user.getAvatar() != null) {
            avatarService.deleteAvatarFile(user.getAvatar());
        }

        // Delete user entity (cascade handles user_sells_book, book_status, reading_session, user_follows_*)
        repositoryService.getUserRepository().delete(user);

        log.info("[AdminUser] Deleted user id={} username={}", id, user.getUsername());
        auditLogService.logAdmin("USER", "Suppression d'utilisateur", AuditLogService.STATUS_SUCCESS,
                "Utilisateur '" + user.getRealUsername() + "' (id=" + id + ") supprimé");

        return ResponseEntity.ok(Map.of("message", "Utilisateur supprimé avec succès."));
    }
}
