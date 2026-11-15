package fr.openbook.api.repositories;

import fr.openbook.api.entities.AchievementEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AchievementRepository extends JpaRepository<AchievementEntity, Long> {
    List<AchievementEntity> findAllByUserIdOrderByCreatedAtDesc(Long userId);

    Optional<AchievementEntity> findByIdAndUserId(Long id, Long userId);
}
