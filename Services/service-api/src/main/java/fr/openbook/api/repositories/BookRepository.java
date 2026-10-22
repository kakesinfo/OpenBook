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

    List<BookEntity> findAllBySeriesId(Integer seriesId);
}
