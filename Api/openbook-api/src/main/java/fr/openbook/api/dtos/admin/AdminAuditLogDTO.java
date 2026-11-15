package fr.openbook.api.dtos.admin;

import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.time.Instant;

@Getter
@Setter
public class AdminAuditLogDTO implements Serializable {
    private Long id;
    private String category;
    private String action;
    private String actor;
    private String status;
    private String comment;
    private Instant createdAt;
}
