package fr.openbook.api.repositories;

import fr.openbook.api.entities.BookEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;

public interface BookRepository extends JpaRepository<BookEntity, Long> {

    List<BookEntity> findAllByTitleContainingIgnoreCaseOrIsbn(String title, String isbn);

    List<BookEntity> findAllByOrderByReleaseDateDesc();
    List<BookEntity> findAllByOrderByReleaseDateAsc();

    Page<BookEntity> findAllByOrderByReleaseDateDesc(Pageable pageable);
    Page<BookEntity> findAllByOrderByReleaseDateAsc(Pageable pageable);

    List<BookEntity> findAllByReleaseDateBetweenOrderByReleaseDateAsc(Instant start, Instant end);
    List<BookEntity> findAllByReleaseDateBetweenOrderByReleaseDateDesc(Instant start, Instant end);

    List<BookEntity> findAllBySeriesId(Integer seriesId);
}
