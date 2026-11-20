package fr.openbook.api.dtos;

import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
public class AchievementDTO {
    private Long id;
    private String name;
    private Integer totalSteps;
    private Integer completedSteps;
    private String icon;
    private String ornament;
    private String iconColor;
    private String backgroundColor;
    private boolean unlocked;
    private Instant unlockedAt;
    private Instant createdAt;
    private Instant updatedAt;
}
