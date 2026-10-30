package fr.openbook.api.repositories;

import fr.openbook.api.entities.SeriesEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SeriesRepository extends JpaRepository<SeriesEntity, Long> {
    Optional<SeriesEntity> findByNameIgnoreCase(String name);

    List<SeriesEntity> findAllByOrderByNameAsc();

    List<SeriesEntity> findByNameContainingIgnoreCaseOrderByNameAsc(String name);

    @Query("SELECT DISTINCT s FROM series s " +
           "WHERE EXISTS (SELECT uob FROM user_owns_book uob WHERE uob.user.id = :userId AND uob.book.series.id = s.id AND UPPER(uob.status) = 'OWNED') " +
           "ORDER BY s.name ASC")
    List<SeriesEntity> findUserSeries(@Param("userId") Long userId);
}
