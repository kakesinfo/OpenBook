package fr.openbook.api.repositories;

import fr.openbook.api.entities.UserOwnsBookEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface UserOwnsBooksRepository extends JpaRepository<UserOwnsBookEntity, Long> {
    Optional<UserOwnsBookEntity> findByUserIdAndBookId(Long userId, Long bookId);

    List<UserOwnsBookEntity> findAllByUserId(Long userId);
    long countByUserId(Long userId);

    List<UserOwnsBookEntity> findAllByUserIdAndStatus(Long userId, String status);

    @Query("""
        SELECT uob FROM user_owns_book uob
        JOIN FETCH uob.book b
        LEFT JOIN FETCH b.series s
        LEFT JOIN FETCH s.category c
        WHERE uob.user.id = :userId AND UPPER(uob.status) = UPPER(:status)
        ORDER BY b.title ASC
    """)
    List<UserOwnsBookEntity> findAllByUserIdAndStatusWithDetails(@Param("userId") Long userId, @Param("status") String status);

    @Transactional
    void deleteAllByUserId(Long userId);

    @Transactional
    void deleteAllByBookId(Long bookId);
}
