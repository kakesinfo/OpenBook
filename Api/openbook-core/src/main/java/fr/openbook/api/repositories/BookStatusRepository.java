package fr.openbook.api.repositories;

import fr.openbook.api.entities.BookStatusEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface BookStatusRepository extends JpaRepository<BookStatusEntity, Long> {
    Optional<BookStatusEntity> findByUserIdAndBookId(Long userId, Long bookId);

    List<BookStatusEntity> findAllByUserIdAndStatus(Long userId, String status);

    List<BookStatusEntity> findAllByUserId(Long userId);

    @Query("""
        SELECT bse FROM book_status bse
        JOIN FETCH bse.book b
        WHERE bse.user.id = :userId
    """)
    List<BookStatusEntity> findAllByUserIdWithBook(@Param("userId") Long userId);
}
