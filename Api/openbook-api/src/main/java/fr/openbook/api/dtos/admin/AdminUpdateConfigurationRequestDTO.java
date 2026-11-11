package fr.openbook.api.dtos.admin;

import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

@Getter
@Setter
public class AdminUpdateConfigurationRequestDTO implements Serializable {
    private String value;
}
