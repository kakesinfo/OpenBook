package fr.openbook.api.repositories;

import fr.openbook.api.entities.SeriesHasThemeEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface SeriesHasThemeRepository extends JpaRepository<SeriesHasThemeEntity, Long> {
    List<SeriesHasThemeEntity> findAllBySeriesId(Integer seriesId);

    @Transactional
    void deleteAllBySeriesId(Integer seriesId);
}
