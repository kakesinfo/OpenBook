package fr.openbook.api.dtos;

import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
public class UpdateAchievementDTO {
    private String name;
    private Integer totalSteps;
    private Integer completedSteps;
    private String icon;
    private String ornament;
    private String iconColor;
    private String backgroundColor;
    private Instant unlockedAt;
}
