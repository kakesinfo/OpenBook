package fr.openbook.api.repositories;

import fr.openbook.api.entities.BookEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface BookRepository extends JpaRepository<BookEntity, Long> {

    @Query("SELECT DISTINCT b FROM book b " +
           "LEFT JOIN b.series s " +
           "LEFT JOIN b.bookHasAuthors bha " +
           "LEFT JOIN bha.author a " +
           "WHERE LOWER(REPLACE(b.title, '’', '''')) LIKE LOWER(CONCAT('%', :queryApos, '%')) " +
           "OR (b.title IS NOT NULL AND LOWER(b.title) LIKE LOWER(CONCAT('%', :rawQuery, '%'))) " +
           "OR (s.name IS NOT NULL AND LOWER(REPLACE(s.name, '’', '''')) LIKE LOWER(CONCAT('%', :queryApos, '%'))) " +
           "OR (s.name IS NOT NULL AND LOWER(s.name) LIKE LOWER(CONCAT('%', :rawQuery, '%'))) " +
           "OR (b.isbn IS NOT NULL AND :cleanIsbn != '' AND REPLACE(REPLACE(b.isbn, '-', ''), ' ', '') LIKE CONCAT('%', :cleanIsbn, '%')) " +
           "OR (b.isbn IS NOT NULL AND :altIsbn != '' AND REPLACE(REPLACE(b.isbn, '-', ''), ' ', '') LIKE CONCAT('%', :altIsbn, '%')) " +
           "OR (b.isbn IS NOT NULL AND b.isbn LIKE CONCAT('%', :rawQuery, '%')) " +
           "OR (a.firstname IS NOT NULL AND LOWER(a.firstname) LIKE LOWER(CONCAT('%', :rawQuery, '%'))) " +
           "OR (a.lastname IS NOT NULL AND LOWER(a.lastname) LIKE LOWER(CONCAT('%', :rawQuery, '%'))) " +
           "OR (a.firstname IS NOT NULL AND a.lastname IS NOT NULL AND LOWER(CONCAT(a.firstname, ' ', a.lastname)) LIKE LOWER(CONCAT('%', :rawQuery, '%')))")
    List<BookEntity> searchBooks(
        @Param("queryApos") String queryApos,
        @Param("rawQuery") String rawQuery,
        @Param("cleanIsbn") String cleanIsbn,
        @Param("altIsbn") String altIsbn
    );

    @Query("SELECT DISTINCT b FROM book b LEFT JOIN b.bookHasAuthors bha LEFT JOIN bha.author a " +
           "WHERE LOWER(b.title) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "OR b.isbn LIKE CONCAT('%', :query, '%') " +
           "OR LOWER(a.firstname) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "OR LOWER(a.lastname) LIKE LOWER(CONCAT('%', :query, '%'))")
    List<BookEntity> searchByTitleOrIsbnOrAuthor(@Param("query") String query);

    List<BookEntity> findAllByTitleContainingIgnoreCaseOrIsbn(String title, String isbn);

    List<BookEntity> findAllByOrderByReleaseDateDesc();
    List<BookEntity> findAllByOrderByReleaseDateAsc();

    Page<BookEntity> findAllByOrderByReleaseDateDesc(Pageable pageable);
    Page<BookEntity> findAllByOrderByReleaseDateAsc(Pageable pageable);

    List<BookEntity> findAllByReleaseDateBetweenOrderByReleaseDateAsc(Instant start, Instant end);
    List<BookEntity> findAllByReleaseDateBetweenOrderByReleaseDateDesc(Instant start, Instant end);

    @Query("SELECT b FROM book b " +
           "WHERE b.releaseDate >= :start AND b.releaseDate <= :end " +
           "AND (" +
           "  EXISTS (SELECT ufs FROM user_follows_series ufs WHERE ufs.user.id = :userId AND ufs.series.id = b.series.id) " +
           "  OR (b.editor IS NOT NULL AND EXISTS (SELECT ufe FROM user_follows_editor ufe WHERE ufe.user.id = :userId AND ufe.editor.id = b.editor.id)) " +
           "  OR (b.collection IS NOT NULL AND EXISTS (SELECT ufc FROM user_follows_collection ufc WHERE ufc.user.id = :userId AND ufc.collection.id = b.collection.id)) " +
           "  OR EXISTS (SELECT bha FROM book_has_author bha, user_follows_author ufa WHERE bha.book.id = b.id AND ufa.user.id = :userId AND ufa.author.id = bha.author.id) " +
           "  OR EXISTS (SELECT uob FROM user_owns_book uob WHERE uob.user.id = :userId AND uob.book.series.id = b.series.id AND UPPER(uob.status) IN ('OWNED', 'LENT'))" +
           ") " +
           "ORDER BY b.releaseDate ASC, b.id ASC")
    List<BookEntity> findPlanningUpcomingForUser(
        @Param("userId") Long userId,
        @Param("start") Instant start,
        @Param("end") Instant end
    );

    @Query("SELECT b FROM book b " +
           "WHERE b.releaseDate >= :start AND b.releaseDate <= :end " +
           "AND (" +
           "  EXISTS (SELECT ufs FROM user_follows_series ufs WHERE ufs.user.id = :userId AND ufs.series.id = b.series.id) " +
           "  OR (b.editor IS NOT NULL AND EXISTS (SELECT ufe FROM user_follows_editor ufe WHERE ufe.user.id = :userId AND ufe.editor.id = b.editor.id)) " +
           "  OR (b.collection IS NOT NULL AND EXISTS (SELECT ufc FROM user_follows_collection ufc WHERE ufc.user.id = :userId AND ufc.collection.id = b.collection.id)) " +
           "  OR EXISTS (SELECT bha FROM book_has_author bha, user_follows_author ufa WHERE bha.book.id = b.id AND ufa.user.id = :userId AND ufa.author.id = bha.author.id) " +
           "  OR EXISTS (SELECT uob FROM user_owns_book uob WHERE uob.user.id = :userId AND uob.book.series.id = b.series.id AND UPPER(uob.status) IN ('OWNED', 'LENT'))" +
           ") " +
           "ORDER BY b.releaseDate DESC, b.id DESC")
    List<BookEntity> findPlanningRecentForUser(
        @Param("userId") Long userId,
        @Param("start") Instant start,
        @Param("end") Instant end
    );

    List<BookEntity> findAllBySeriesId(Integer seriesId);

    List<BookEntity> findAllBySeriesIdOrderByVolumeAscIdAsc(Integer seriesId);
}
