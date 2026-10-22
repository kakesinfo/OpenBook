package fr.openbook.api.repositories;

import fr.openbook.api.entities.SeriesEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SeriesRepository extends JpaRepository<SeriesEntity, Long> {
    Optional<SeriesEntity> findByNameIgnoreCase(String name);
}
