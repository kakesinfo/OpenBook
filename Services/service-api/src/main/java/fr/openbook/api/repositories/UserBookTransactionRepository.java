package fr.openbook.api.repositories;

import fr.openbook.api.entities.UserBookTransactionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface UserBookTransactionRepository extends JpaRepository<UserBookTransactionEntity, Integer> {
    List<UserBookTransactionEntity> findAllByUserIdAndBookIdOrderByTransactionDateDescCreatedAtDesc(Long userId, Long bookId);

    List<UserBookTransactionEntity> findAllByUserIdOrderByTransactionDateDescCreatedAtDesc(Long userId);

    Optional<UserBookTransactionEntity> findByIdAndUserId(Integer id, Long userId);

    @Transactional
    void deleteAllByUserId(Long userId);
}
