package fr.openbook.api.dtos.admin;

import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.time.Instant;

@Getter
@Setter
public class AdminConfigurationDTO implements Serializable {
    private Long id;
    private String key;
    private String value;
    private String defaultValue;
    private String valueType;
    private String description;
    private boolean isDefault;
    private Instant createdAt;
    private Instant updatedAt;
}
