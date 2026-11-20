package fr.openbook.api.repositories;

import fr.openbook.api.entities.ReadingSessionEntity;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ReadingSessionRepository extends JpaRepository<ReadingSessionEntity, Long> {
    @EntityGraph(attributePaths = {"book", "readingCycle"})
    List<ReadingSessionEntity> findAllByUserIdAndBookIdOrderByCreatedAtAsc(Long userId, Long bookId);

    @EntityGraph(attributePaths = {"book", "readingCycle"})
    List<ReadingSessionEntity> findAllByUserIdOrderByCreatedAtAsc(Long userId);

    @EntityGraph(attributePaths = {"book", "readingCycle"})
    List<ReadingSessionEntity> findAllByReadingCycleIdOrderByCreatedAtAscIdAsc(Integer readingCycleId);

    long countByReadingCycleId(Integer readingCycleId);
}
