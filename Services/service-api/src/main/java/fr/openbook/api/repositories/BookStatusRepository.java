package fr.openbook.api.repositories;

import fr.openbook.api.entities.BookStatusEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BookStatusRepository extends JpaRepository<BookStatusEntity, Long> {
    Optional<BookStatusEntity> findByUserIdAndBookId(Long userId, Long bookId);
    List<BookStatusEntity> findAllByUserIdAndStatus(Long userId, String status);
    List<BookStatusEntity> findAllByUserId(Long userId);
}
