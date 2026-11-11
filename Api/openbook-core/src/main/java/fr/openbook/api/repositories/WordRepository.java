package fr.openbook.api.repositories;

import fr.openbook.api.entities.WordEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WordRepository extends JpaRepository<WordEntity, Long> {
    Optional<WordEntity> findByWordIgnoreCase(String word);
    boolean existsByWordIgnoreCase(String word);
    boolean existsByWordIgnoreCaseAndIdNot(String word, Long id);

    List<WordEntity> findAllByOrderByWordAsc();

    @Query("SELECT DISTINCT w FROM word w LEFT JOIN FETCH w.bookHasWords bhw LEFT JOIN FETCH bhw.book b LEFT JOIN FETCH b.series ORDER BY w.word ASC")
    List<WordEntity> findAllWithBooksOrderByWordAsc();

    @Query("SELECT DISTINCT w FROM word w LEFT JOIN FETCH w.bookHasWords bhw LEFT JOIN FETCH bhw.book b LEFT JOIN FETCH b.series WHERE LOWER(w.word) LIKE LOWER(CONCAT('%', :query, '%')) OR LOWER(w.definition) LIKE LOWER(CONCAT('%', :query, '%')) ORDER BY w.word ASC")
    List<WordEntity> searchWithBooks(@Param("query") String query);

    @Query("SELECT DISTINCT w FROM word w JOIN w.bookHasWords bhw WHERE bhw.book.id = :bookId ORDER BY w.word ASC")
    List<WordEntity> findAllByBookId(@Param("bookId") Long bookId);
}
