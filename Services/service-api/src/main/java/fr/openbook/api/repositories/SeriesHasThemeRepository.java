package fr.openbook.api.repositories;

import fr.openbook.api.entities.SeriesHasThemeEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SeriesHasThemeRepository extends JpaRepository<SeriesHasThemeEntity, Long> {
}
