package fr.openbook.api.repositories;

import fr.openbook.api.entities.UserFollowsEditorEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface UserFollowsEditorRepository extends JpaRepository<UserFollowsEditorEntity, Integer> {
    Optional<UserFollowsEditorEntity> findByUserIdAndEditorId(Long userId, Long editorId);

    boolean existsByUserIdAndEditorId(Long userId, Long editorId);

    List<UserFollowsEditorEntity> findAllByUserId(Long userId);

    @Transactional
    void deleteByUserIdAndEditorId(Long userId, Long editorId);
}
