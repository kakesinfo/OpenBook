package fr.openbook.api.services;

import fr.openbook.api.entities.ConfigurationValueType;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

@Getter
public class ConfigurationUpdatedEvent extends ApplicationEvent {

    private final String key;
    private final String value;
    private final String defaultValue;
    private final ConfigurationValueType valueType;

    public ConfigurationUpdatedEvent(Object source, String key, String value, String defaultValue, ConfigurationValueType valueType) {
        super(source);
        this.key = key;
        this.value = value;
        this.defaultValue = defaultValue;
        this.valueType = valueType;
    }
}
