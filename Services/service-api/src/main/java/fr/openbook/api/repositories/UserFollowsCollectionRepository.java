package fr.openbook.api.repositories;

import fr.openbook.api.entities.UserFollowsCollectionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface UserFollowsCollectionRepository extends JpaRepository<UserFollowsCollectionEntity, Integer> {
    Optional<UserFollowsCollectionEntity> findByUserIdAndCollectionId(Long userId, Integer collectionId);

    boolean existsByUserIdAndCollectionId(Long userId, Integer collectionId);

    List<UserFollowsCollectionEntity> findAllByUserId(Long userId);

    @Transactional
    void deleteByUserIdAndCollectionId(Long userId, Integer collectionId);
}
