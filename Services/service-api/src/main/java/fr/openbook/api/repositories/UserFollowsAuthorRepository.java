package fr.openbook.api.repositories;

import fr.openbook.api.entities.UserFollowsAuthorEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface UserFollowsAuthorRepository extends JpaRepository<UserFollowsAuthorEntity, Integer> {
    Optional<UserFollowsAuthorEntity> findByUserIdAndAuthorId(Long userId, Integer authorId);

    boolean existsByUserIdAndAuthorId(Long userId, Integer authorId);

    List<UserFollowsAuthorEntity> findAllByUserId(Long userId);

    @Transactional
    void deleteByUserIdAndAuthorId(Long userId, Integer authorId);
}
