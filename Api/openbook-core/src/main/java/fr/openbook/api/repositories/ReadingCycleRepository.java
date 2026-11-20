package fr.openbook.api.repositories;

import fr.openbook.api.entities.ReadingCycleEntity;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ReadingCycleRepository extends JpaRepository<ReadingCycleEntity, Integer> {
    @EntityGraph(attributePaths = {"book"})
    List<ReadingCycleEntity> findAllByUserIdAndBookIdOrderByIdAsc(Long userId, Long bookId);

    @EntityGraph(attributePaths = {"book"})
    List<ReadingCycleEntity> findAllByUserIdOrderByIdAsc(Long userId);

    Optional<ReadingCycleEntity> findFirstByUserIdAndBookIdAndEndedAtIsNullOrderByIdDesc(Long userId, Long bookId);

    Optional<ReadingCycleEntity> findFirstByUserIdAndBookIdOrderByIdDesc(Long userId, Long bookId);
}
