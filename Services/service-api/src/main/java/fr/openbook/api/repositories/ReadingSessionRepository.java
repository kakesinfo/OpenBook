package fr.openbook.api.repositories;

import fr.openbook.api.entities.ReadingSessionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ReadingSessionRepository extends JpaRepository<ReadingSessionEntity, Long> {
    List<ReadingSessionEntity> findAllByUserIdAndBookIdOrderByCreatedAtAsc(Long userId, Long bookId);
    List<ReadingSessionEntity> findAllByUserIdOrderByCreatedAtAsc(Long userId);
}
