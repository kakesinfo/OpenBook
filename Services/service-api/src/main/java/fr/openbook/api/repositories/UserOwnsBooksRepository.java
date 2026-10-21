package fr.openbook.api.repositories;

import fr.openbook.api.entities.UserOwnsBookEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface UserOwnsBooksRepository extends JpaRepository<UserOwnsBookEntity, Long> {
    Optional<UserOwnsBookEntity> findByUserIdAndBookId(Long userId, Long bookId);

    List<UserOwnsBookEntity> findAllByUserIdAndStatus(Long userId, String status);

    @Transactional
    void deleteAllByUserId(Long userId);
}
