package fr.openbook.api.entities;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.time.Instant;
import java.util.Date;

@Getter
@Setter
@Entity(name = "achievements")
@Table(name = "achievements")
public class AchievementEntity {
    @Id
    @Column(name = "id", nullable = false)
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @OnDelete(action = OnDeleteAction.CASCADE)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @Column(name = "name", nullable = false, length = 150)
    private String name;

    @Column(name = "total_steps", nullable = false)
    private Integer totalSteps = 1;

    @Column(name = "completed_steps", nullable = false)
    private Integer completedSteps = 0;

    @Column(name = "icon", nullable = false, length = 60)
    private String icon = "trophy";

    @Column(name = "ornament", nullable = false, length = 40)
    private String ornament = "laurel";

    @Column(name = "icon_color", nullable = false, length = 20)
    private String iconColor = "#f59e0b";

    @Column(name = "background_color", nullable = false, length = 20)
    private String backgroundColor = "#fef3c7";

    @Column(name = "unlocked_at", nullable = true)
    private Instant unlockedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        Instant now = new Date().toInstant();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = new Date().toInstant();
    }
}
