package fr.openbook.api.repositories;

import fr.openbook.api.entities.UserSellsBookEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface UserSellsBookRepository extends JpaRepository<UserSellsBookEntity, Long> {
    Optional<UserSellsBookEntity> findByUserIdAndBookId(Long userId, Long bookId);

    List<UserSellsBookEntity> findAllByUserId(Long userId);

    List<UserSellsBookEntity> findAllByUserIdAndStatus(Long userId, String status);

    @Transactional
    void deleteAllByUserId(Long userId);
}
