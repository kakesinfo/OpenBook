package fr.openbook.api.dtos.admin;

import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.time.Instant;

@Getter
@Setter
public class AdminUserDTO implements Serializable {
    private Long id;
    private String username;
    private String role;
    private String avatar;
    private boolean blocked;
    private boolean mustChangePassword;
    private Instant createdAt;
    private Instant updatedAt;
    private long booksCount;
}
