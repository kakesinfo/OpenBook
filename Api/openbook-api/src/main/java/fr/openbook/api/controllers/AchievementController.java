package fr.openbook.api.controllers;

import fr.openbook.api.dtos.AchievementDTO;
import fr.openbook.api.dtos.CreateAchievementDTO;
import fr.openbook.api.dtos.UpdateAchievementDTO;
import fr.openbook.api.entities.AchievementEntity;
import fr.openbook.api.entities.UserEntity;
import fr.openbook.api.services.RepositoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping({"/achievements", "/user/achievements"})
@RequiredArgsConstructor
public class AchievementController {

    private final RepositoryService repositoryService;

    private UserEntity getAuthenticatedUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated() && !"anonymousUser".equals(authentication.getPrincipal())) {
            String username = authentication.getName();
            return repositoryService.getUserRepository().findByUsername(username)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
    }

    private AchievementDTO entityToDTO(AchievementEntity entity) {
        if (entity == null) return null;
        AchievementDTO dto = new AchievementDTO();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        dto.setTotalSteps(entity.getTotalSteps());
        dto.setCompletedSteps(entity.getCompletedSteps());
        dto.setIcon(entity.getIcon());
        dto.setOrnament(entity.getOrnament());
        dto.setIconColor(entity.getIconColor());
        dto.setBackgroundColor(entity.getBackgroundColor());
        dto.setUnlocked(entity.getCompletedSteps() >= entity.getTotalSteps());
        dto.setUnlockedAt(entity.getUnlockedAt());
        dto.setCreatedAt(entity.getCreatedAt());
        dto.setUpdatedAt(entity.getUpdatedAt());
        return dto;
    }

    @GetMapping
    public List<AchievementDTO> getAllAchievements() {
        UserEntity user = getAuthenticatedUser();
        return repositoryService.getAchievementRepository()
                .findAllByUserIdOrderByCreatedAtDesc(user.getId())
                .stream()
                .map(this::entityToDTO)
                .collect(Collectors.toList());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public AchievementDTO createAchievement(@RequestBody CreateAchievementDTO createDTO) {
        UserEntity user = getAuthenticatedUser();
        if (createDTO == null || createDTO.getName() == null || createDTO.getName().trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "name is required");
        }

        String name = validateMaxLength(createDTO.getName().trim(), 150, "name");
        int totalSteps = createDTO.getTotalSteps() != null ? Math.max(1, Math.min(100_000, createDTO.getTotalSteps())) : 1;

        AchievementEntity entity = new AchievementEntity();
        entity.setUser(user);
        entity.setName(name);
        entity.setTotalSteps(totalSteps);
        if (createDTO.getUnlockedAt() != null) {
            entity.setCompletedSteps(totalSteps);
            entity.setUnlockedAt(createDTO.getUnlockedAt());
        } else {
            entity.setCompletedSteps(0);
            entity.setUnlockedAt(null);
        }
        entity.setIcon(isNonBlank(createDTO.getIcon()) ? validateMaxLength(createDTO.getIcon().trim(), 60, "icon") : "trophy");
        entity.setOrnament(isNonBlank(createDTO.getOrnament()) ? validateMaxLength(createDTO.getOrnament().trim(), 40, "ornament") : "laurel");
        entity.setIconColor(isNonBlank(createDTO.getIconColor()) ? validateHexColor(createDTO.getIconColor().trim(), "iconColor") : "#f59e0b");
        entity.setBackgroundColor(isNonBlank(createDTO.getBackgroundColor()) ? validateHexColor(createDTO.getBackgroundColor().trim(), "backgroundColor") : "#fef3c7");

        AchievementEntity saved = repositoryService.getAchievementRepository().save(entity);
        return entityToDTO(saved);
    }

    @PutMapping("/{id}")
    @Transactional
    public AchievementDTO updateAchievement(@PathVariable Long id, @RequestBody UpdateAchievementDTO updateDTO) {
        UserEntity user = getAuthenticatedUser();
        if (updateDTO == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "body is required");
        }

        AchievementEntity entity = repositoryService.getAchievementRepository()
                .findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Achievement not found"));

        if (updateDTO.getName() != null) {
            String trimmed = updateDTO.getName().trim();
            if (trimmed.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "name cannot be empty");
            }
            entity.setName(validateMaxLength(trimmed, 150, "name"));
        }

        if (updateDTO.getTotalSteps() != null) {
            entity.setTotalSteps(Math.max(1, Math.min(100_000, updateDTO.getTotalSteps())));
        }

        if (updateDTO.getCompletedSteps() != null) {
            int clamped = Math.max(0, Math.min(entity.getTotalSteps(), updateDTO.getCompletedSteps()));
            entity.setCompletedSteps(clamped);
        } else if (entity.getCompletedSteps() > entity.getTotalSteps()) {
            entity.setCompletedSteps(entity.getTotalSteps());
        }

        if (isNonBlank(updateDTO.getIcon())) {
            entity.setIcon(validateMaxLength(updateDTO.getIcon().trim(), 60, "icon"));
        }
        if (isNonBlank(updateDTO.getOrnament())) {
            entity.setOrnament(validateMaxLength(updateDTO.getOrnament().trim(), 40, "ornament"));
        }
        if (isNonBlank(updateDTO.getIconColor())) {
            entity.setIconColor(validateHexColor(updateDTO.getIconColor().trim(), "iconColor"));
        }
        if (isNonBlank(updateDTO.getBackgroundColor())) {
            entity.setBackgroundColor(validateHexColor(updateDTO.getBackgroundColor().trim(), "backgroundColor"));
        }

        if (entity.getCompletedSteps() >= entity.getTotalSteps()) {
            if (updateDTO.getUnlockedAt() != null) {
                entity.setUnlockedAt(updateDTO.getUnlockedAt());
            } else if (entity.getUnlockedAt() == null) {
                entity.setUnlockedAt(Instant.now());
            }
        } else {
            entity.setUnlockedAt(null);
        }

        AchievementEntity saved = repositoryService.getAchievementRepository().save(entity);
        return entityToDTO(saved);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void deleteAchievement(@PathVariable Long id) {
        UserEntity user = getAuthenticatedUser();
        AchievementEntity entity = repositoryService.getAchievementRepository()
                .findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Achievement not found"));
        repositoryService.getAchievementRepository().delete(entity);
    }

    private boolean isNonBlank(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private String validateMaxLength(String value, int maxLength, String fieldName) {
        if (value.length() > maxLength) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, fieldName + " must be at most " + maxLength + " characters");
        }
        return value;
    }

    private String validateHexColor(String value, String fieldName) {
        if (value.length() > 20 || !value.matches("^#[0-9a-fA-F]{3,8}$")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, fieldName + " must be a valid hex color");
        }
        return value;
    }
}
