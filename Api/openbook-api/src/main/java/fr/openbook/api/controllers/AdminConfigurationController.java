package fr.openbook.api.controllers;

import fr.openbook.api.dtos.admin.AdminConfigurationDTO;
import fr.openbook.api.dtos.admin.AdminUpdateConfigurationRequestDTO;
import fr.openbook.api.entities.ConfigurationEntity;
import fr.openbook.api.services.ConfigurationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping({"/admin/configurations", "/admin/config"})
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class AdminConfigurationController {

    private final ConfigurationService configurationService;

    private AdminConfigurationDTO toDto(ConfigurationEntity entity) {
        AdminConfigurationDTO dto = new AdminConfigurationDTO();
        dto.setId(entity.getId());
        dto.setKey(entity.getKey());
        dto.setValue(entity.getValue());
        dto.setDefaultValue(entity.getDefaultValue());
        dto.setValueType(entity.getValueType() != null ? entity.getValueType().name() : "STRING");
        dto.setDescription(entity.getDescription());
        dto.setDefault(Objects.equals(entity.getValue(), entity.getDefaultValue()));
        dto.setCreatedAt(entity.getCreatedAt());
        dto.setUpdatedAt(entity.getUpdatedAt());
        return dto;
    }

    /**
     * Lists all site configurations.
     */
    @GetMapping
    public ResponseEntity<List<AdminConfigurationDTO>> getAllConfigurations() {
        List<ConfigurationEntity> entities = configurationService.getAllConfigurations();
        List<AdminConfigurationDTO> dtos = entities.stream().map(this::toDto).collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    /**
     * Updates a configuration value by ID.
     */
    @PutMapping("/{id}")
    public ResponseEntity<?> updateConfiguration(
            @PathVariable Long id,
            @RequestBody AdminUpdateConfigurationRequestDTO request
    ) {
        if (request == null || request.getValue() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "La valeur de configuration est requise."));
        }
        try {
            ConfigurationEntity updated = configurationService.updateConfiguration(id, request.getValue());
            return ResponseEntity.ok(Map.of(
                    "message", "Configuration mise à jour avec succès.",
                    "configuration", toDto(updated)
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            log.error("[AdminConfiguration] Error updating configuration id={}: {}", id, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Erreur lors de la mise à jour de la configuration."));
        }
    }

    /**
     * Resets a configuration value to its default value by ID.
     */
    @PostMapping("/{id}/reset")
    public ResponseEntity<?> resetConfiguration(@PathVariable Long id) {
        try {
            ConfigurationEntity reset = configurationService.resetToDefault(id);
            return ResponseEntity.ok(Map.of(
                    "message", "Configuration restaurée à sa valeur par défaut.",
                    "configuration", toDto(reset)
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            log.error("[AdminConfiguration] Error resetting configuration id={}: {}", id, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Erreur lors de la restauration de la configuration."));
        }
    }

    @PutMapping("/{id}/reset")
    public ResponseEntity<?> resetConfigurationPut(@PathVariable Long id) {
        return resetConfiguration(id);
    }
}
