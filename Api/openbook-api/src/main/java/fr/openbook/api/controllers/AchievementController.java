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

        int totalSteps = createDTO.getTotalSteps() != null ? Math.max(1, createDTO.getTotalSteps()) : 1;

        AchievementEntity entity = new AchievementEntity();
        entity.setUser(user);
        entity.setName(createDTO.getName().trim());
        entity.setTotalSteps(totalSteps);
        if (createDTO.getUnlockedAt() != null) {
            entity.setCompletedSteps(totalSteps);
            entity.setUnlockedAt(createDTO.getUnlockedAt());
        } else {
            entity.setCompletedSteps(0);
            entity.setUnlockedAt(null);
        }
        entity.setIcon(isNonBlank(createDTO.getIcon()) ? createDTO.getIcon().trim() : "trophy");
        entity.setOrnament(isNonBlank(createDTO.getOrnament()) ? createDTO.getOrnament().trim() : "laurel");
        entity.setIconColor(isNonBlank(createDTO.getIconColor()) ? createDTO.getIconColor().trim() : "#f59e0b");
        entity.setBackgroundColor(isNonBlank(createDTO.getBackgroundColor()) ? createDTO.getBackgroundColor().trim() : "#fef3c7");

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
            entity.setName(trimmed);
        }

        if (updateDTO.getTotalSteps() != null) {
            entity.setTotalSteps(Math.max(1, updateDTO.getTotalSteps()));
        }

        if (updateDTO.getCompletedSteps() != null) {
            int clamped = Math.max(0, Math.min(entity.getTotalSteps(), updateDTO.getCompletedSteps()));
            entity.setCompletedSteps(clamped);
        } else if (entity.getCompletedSteps() > entity.getTotalSteps()) {
            entity.setCompletedSteps(entity.getTotalSteps());
        }

        if (isNonBlank(updateDTO.getIcon())) {
            entity.setIcon(updateDTO.getIcon().trim());
        }
        if (isNonBlank(updateDTO.getOrnament())) {
            entity.setOrnament(updateDTO.getOrnament().trim());
        }
        if (isNonBlank(updateDTO.getIconColor())) {
            entity.setIconColor(updateDTO.getIconColor().trim());
        }
        if (isNonBlank(updateDTO.getBackgroundColor())) {
            entity.setBackgroundColor(updateDTO.getBackgroundColor().trim());
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
}
