package fr.openbook.api.repositories;

import fr.openbook.api.entities.SeriesEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SeriesRepository extends JpaRepository<SeriesEntity, Long> {
}
