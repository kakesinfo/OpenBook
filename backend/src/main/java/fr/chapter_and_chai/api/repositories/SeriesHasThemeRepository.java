package fr.chapter_and_chai.api.repositories;

import fr.chapter_and_chai.api.entities.SeriesHasThemeEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SeriesHasThemeRepository extends JpaRepository<SeriesHasThemeEntity, Long> {
}
