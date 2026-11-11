package fr.openbook.api.repositories;

import fr.openbook.api.entities.BookHasWordEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BookHasWordRepository extends JpaRepository<BookHasWordEntity, Long> {
    List<BookHasWordEntity> findAllByWordId(Long wordId);

    @Query("SELECT bhw FROM book_has_word bhw JOIN FETCH bhw.book b LEFT JOIN FETCH b.series WHERE bhw.word.id = :wordId")
    List<BookHasWordEntity> findAllByWordIdWithBook(@Param("wordId") Long wordId);

    @Query("SELECT bhw FROM book_has_word bhw JOIN FETCH bhw.word w WHERE bhw.book.id = :bookId ORDER BY w.word ASC")
    List<BookHasWordEntity> findAllByBookIdWithWord(@Param("bookId") Long bookId);

    Optional<BookHasWordEntity> findByBookIdAndWordId(Long bookId, Long wordId);

    void deleteAllByWordId(Long wordId);
    void deleteAllByBookId(Long bookId);
}
