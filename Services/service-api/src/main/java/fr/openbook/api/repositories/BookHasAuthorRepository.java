package fr.openbook.api.repositories;

import fr.openbook.api.entities.BookHasAuthorEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

public interface BookHasAuthorRepository extends JpaRepository<BookHasAuthorEntity, Long> {
    @Transactional
    void deleteAllByBookId(Long bookId);
}
