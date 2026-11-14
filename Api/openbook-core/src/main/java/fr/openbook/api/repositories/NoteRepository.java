package fr.openbook.api.repositories;

import fr.openbook.api.entities.NoteEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface NoteRepository extends JpaRepository<NoteEntity, Long> {
    Optional<NoteEntity> findByBookId(Long bookId);
    Optional<NoteEntity> findByBookIdAndUserId(Long bookId, Long userId);
    Optional<NoteEntity> findByIdAndUserId(Long id, Long userId);
    boolean existsByBookId(Long bookId);
    boolean existsByBookIdAndUserId(Long bookId, Long userId);
    void deleteByBookId(Long bookId);

    @Query("SELECT n FROM notes n JOIN FETCH n.book b LEFT JOIN FETCH b.series LEFT JOIN FETCH b.editor ORDER BY n.updatedAt DESC")
    List<NoteEntity> findAllWithBookOrderByUpdatedAtDesc();

    @Query("SELECT n FROM notes n JOIN FETCH n.book b LEFT JOIN FETCH b.series LEFT JOIN FETCH b.editor WHERE n.user.id = :userId ORDER BY n.updatedAt DESC")
    List<NoteEntity> findAllWithBookByUserIdOrderByUpdatedAtDesc(@Param("userId") Long userId);

    @Query("SELECT n FROM notes n JOIN FETCH n.book b LEFT JOIN FETCH b.series LEFT JOIN FETCH b.editor WHERE LOWER(b.title) LIKE LOWER(CONCAT('%', :query, '%')) OR LOWER(n.content) LIKE LOWER(CONCAT('%', :query, '%')) ORDER BY n.updatedAt DESC")
    List<NoteEntity> searchWithBook(@Param("query") String query);

    @Query("SELECT n FROM notes n JOIN FETCH n.book b LEFT JOIN FETCH b.series LEFT JOIN FETCH b.editor WHERE n.user.id = :userId AND (LOWER(b.title) LIKE LOWER(CONCAT('%', :query, '%')) OR LOWER(n.content) LIKE LOWER(CONCAT('%', :query, '%'))) ORDER BY n.updatedAt DESC")
    List<NoteEntity> searchWithBookByUserId(@Param("userId") Long userId, @Param("query") String query);
}
