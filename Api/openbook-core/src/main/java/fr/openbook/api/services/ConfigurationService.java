package fr.openbook.api.services;

import fr.openbook.api.entities.ConfigurationEntity;
import fr.openbook.api.entities.ConfigurationValueType;
import fr.openbook.api.repositories.ConfigurationRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class ConfigurationService {

    public static final String KEY_SCRAPER_SCHEDULE_CRON = "SCRAPER_SCHEDULE_CRON";
    public static final String KEY_BACKUP_SCHEDULE_CRON = "BACKUP_SCHEDULE_CRON";

    public static final String DEFAULT_SCRAPER_SCHEDULE_CRON = "0 0 3 * * *";
    public static final String DEFAULT_BACKUP_SCHEDULE_CRON = "0 0 4 * * *";

    private final ConfigurationRepository configurationRepository;
    private final ApplicationEventPublisher eventPublisher;

    @PostConstruct
    public void initDefaultConfigurations() {
        try {
            ensureConfigExists(
                    KEY_SCRAPER_SCHEDULE_CRON,
                    DEFAULT_SCRAPER_SCHEDULE_CRON,
                    ConfigurationValueType.CRON,
                    "Planification CRON du scan automatique des catalogues éditeurs (scrapers)"
            );
            ensureConfigExists(
                    KEY_BACKUP_SCHEDULE_CRON,
                    DEFAULT_BACKUP_SCHEDULE_CRON,
                    ConfigurationValueType.CRON,
                    "Planification CRON de la sauvegarde automatique du système (base de données et médias)"
            );
        } catch (Exception e) {
            log.warn("[ConfigurationService] Could not initialize default configurations on startup: {}", e.getMessage());
        }
    }

    private void ensureConfigExists(String key, String defaultValue, ConfigurationValueType type, String description) {
        if (configurationRepository.findByKeyIgnoreCase(key).isEmpty()) {
            ConfigurationEntity entity = new ConfigurationEntity();
            entity.setKey(key);
            entity.setValue(defaultValue);
            entity.setDefaultValue(defaultValue);
            entity.setValueType(type);
            entity.setDescription(description);
            configurationRepository.save(entity);
            log.info("[ConfigurationService] Seeded default configuration {} = {}", key, defaultValue);
        }
    }

    public List<ConfigurationEntity> getAllConfigurations() {
        return configurationRepository.findAllByOrderByIdAsc();
    }

    public Optional<ConfigurationEntity> getById(Long id) {
        return configurationRepository.findById(id);
    }

    public Optional<ConfigurationEntity> getByKey(String key) {
        if (key == null) return Optional.empty();
        return configurationRepository.findByKeyIgnoreCase(key.trim());
    }

    public String getValue(String key, String fallback) {
        try {
            return getByKey(key)
                    .map(ConfigurationEntity::getValue)
                    .filter(v -> v != null && !v.isBlank())
                    .orElse(fallback);
        } catch (Exception e) {
            log.warn("[ConfigurationService] Failed to read config '{}', using fallback '{}': {}", key, fallback, e.getMessage());
            return fallback;
        }
    }

    @Transactional
    public ConfigurationEntity updateConfiguration(Long id, String rawValue) {
        ConfigurationEntity entity = configurationRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Configuration introuvable (id=" + id + ")"));
        return applyAndSaveValue(entity, rawValue);
    }

    @Transactional
    public ConfigurationEntity updateConfigurationByKey(String key, String rawValue) {
        ConfigurationEntity entity = getByKey(key)
                .orElseThrow(() -> new IllegalArgumentException("Configuration introuvable (key=" + key + ")"));
        return applyAndSaveValue(entity, rawValue);
    }

    @Transactional
    public ConfigurationEntity resetToDefault(Long id) {
        ConfigurationEntity entity = configurationRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Configuration introuvable (id=" + id + ")"));
        return applyAndSaveValue(entity, entity.getDefaultValue());
    }

    @Transactional
    public ConfigurationEntity resetToDefaultByKey(String key) {
        ConfigurationEntity entity = getByKey(key)
                .orElseThrow(() -> new IllegalArgumentException("Configuration introuvable (key=" + key + ")"));
        return applyAndSaveValue(entity, entity.getDefaultValue());
    }

    private ConfigurationEntity applyAndSaveValue(ConfigurationEntity entity, String rawValue) {
        String validated = validateAndNormalize(rawValue, entity.getValueType());
        entity.setValue(validated);
        ConfigurationEntity saved = configurationRepository.save(entity);
        log.info("[ConfigurationService] Configuration '{}' updated to '{}' (type={})",
                saved.getKey(), saved.getValue(), saved.getValueType());

        eventPublisher.publishEvent(new ConfigurationUpdatedEvent(
                this,
                saved.getKey(),
                saved.getValue(),
                saved.getDefaultValue(),
                saved.getValueType()
        ));
        return saved;
    }

    public String validateAndNormalize(String rawValue, ConfigurationValueType valueType) {
        if (rawValue == null) {
            throw new IllegalArgumentException("La valeur ne peut pas être nulle.");
        }
        String trimmed = rawValue.trim();
        ConfigurationValueType type = valueType != null ? valueType : ConfigurationValueType.STRING;

        return switch (type) {
            case CRON -> validateAndNormalizeCron(trimmed);
            case INTEGER -> {
                try {
                    int parsed = Integer.parseInt(trimmed);
                    yield String.valueOf(parsed);
                } catch (NumberFormatException e) {
                    throw new IllegalArgumentException("La valeur doit être un nombre entier valide.");
                }
            }
            case BOOLEAN -> {
                if ("true".equalsIgnoreCase(trimmed) || "1".equals(trimmed)) {
                    yield "true";
                } else if ("false".equalsIgnoreCase(trimmed) || "0".equals(trimmed)) {
                    yield "false";
                } else {
                    throw new IllegalArgumentException("La valeur doit être un booléen ('true' ou 'false').");
                }
            }
            case STRING -> {
                if (trimmed.isEmpty()) {
                    throw new IllegalArgumentException("La valeur texte ne peut pas être vide.");
                }
                yield trimmed;
            }
        };
    }

    private String validateAndNormalizeCron(String cron) {
        if (cron.isEmpty()) {
            throw new IllegalArgumentException("L'expression CRON ne peut pas être vide.");
        }
        // Normalize multiple spaces
        String normalized = cron.replaceAll("\\s+", " ");
        String[] parts = normalized.split(" ");

        // If user entered a 5-field Unix cron (min hour dom month dow), convert to 6-field Spring cron (sec min hour dom month dow)
        if (parts.length == 5) {
            normalized = "0 " + normalized;
        }

        if (!CronExpression.isValidExpression(normalized)) {
            throw new IllegalArgumentException("Expression CRON invalide : '" + cron + "'. Format attendu : 'sec min heure jour mois jour_semaine' (ex: 0 0 3 * * *).");
        }
        return normalized;
    }
}
