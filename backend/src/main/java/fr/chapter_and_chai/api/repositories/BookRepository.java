package fr.chapter_and_chai.api.repositories;

import fr.chapter_and_chai.api.entities.BookEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface BookRepository extends JpaRepository<BookEntity, Long> {

    @Query(
        value = """
            SELECT *
            FROM book
            WHERE title LIKE %?1%
            OR series_id IN (SELECT id FROM series WHERE title LIKE %?1%)
        """,
        nativeQuery = true
    )
    List<BookEntity> findAllByNameOrSeriesName(String name);
}
