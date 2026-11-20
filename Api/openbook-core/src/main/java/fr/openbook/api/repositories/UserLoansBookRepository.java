package fr.openbook.api.repositories;

import fr.openbook.api.entities.UserLoansBookEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface UserLoansBookRepository extends JpaRepository<UserLoansBookEntity, Long> {
    Optional<UserLoansBookEntity> findByUserIdAndBookId(Long userId, Long bookId);

    List<UserLoansBookEntity> findAllByUserId(Long userId);

    List<UserLoansBookEntity> findAllByUserIdAndType(Long userId, String type);

    @Transactional
    void deleteAllByUserId(Long userId);
}
