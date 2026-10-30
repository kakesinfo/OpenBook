package fr.openbook.api.repositories;

import fr.openbook.api.entities.BookHasAuthorEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.List;

public interface BookHasAuthorRepository extends JpaRepository<BookHasAuthorEntity, Long> {
    @Transactional
    void deleteAllByBookId(Long bookId);

    @Query("""
        SELECT bha FROM book_has_author bha
        JOIN FETCH bha.author a
        WHERE bha.book.id IN :bookIds
    """)
    List<BookHasAuthorEntity> findAllByBookIdInWithAuthor(@Param("bookIds") Collection<Long> bookIds);
}
