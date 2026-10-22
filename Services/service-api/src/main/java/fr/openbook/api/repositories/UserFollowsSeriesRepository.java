package fr.openbook.api.repositories;

import fr.openbook.api.entities.UserFollowsSeriesEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface UserFollowsSeriesRepository extends JpaRepository<UserFollowsSeriesEntity, Integer> {
    Optional<UserFollowsSeriesEntity> findByUserIdAndSeriesId(Long userId, Integer seriesId);

    boolean existsByUserIdAndSeriesId(Long userId, Integer seriesId);

    List<UserFollowsSeriesEntity> findAllByUserId(Long userId);

    @Transactional
    void deleteByUserIdAndSeriesId(Long userId, Integer seriesId);
}
