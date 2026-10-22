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
