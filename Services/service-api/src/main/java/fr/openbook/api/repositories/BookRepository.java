package fr.openbook.api.repositories;

import fr.openbook.api.entities.BookEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;

public interface BookRepository extends JpaRepository<BookEntity, Long> {

    List<BookEntity> findAllByTitleContainingIgnoreCaseOrIsbn(String title, String isbn);

    List<BookEntity> findAllByOrderByReleaseDateDesc();
    List<BookEntity> findAllByOrderByReleaseDateAsc();

    List<BookEntity> findAllByReleaseDateBetweenOrderByReleaseDateAsc(Instant start, Instant end);
    List<BookEntity> findAllByReleaseDateBetweenOrderByReleaseDateDesc(Instant start, Instant end);

    List<BookEntity> findAllBySeriesId(Integer seriesId);
}
