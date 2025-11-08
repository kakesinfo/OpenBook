package fr.openbook.api.repositories;

import fr.openbook.api.entities.BookHasAuthorEntity;
import fr.openbook.api.entities.UserOwnsBookEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserOwnsBooksRepository extends JpaRepository<UserOwnsBookEntity, Long> {
    Optional<UserOwnsBookEntity> findByUserIdAndBookId(Long userId, Long bookId);

    List<UserOwnsBookEntity> findAllByUserIdAndStatus(Long userId, String status);
}
