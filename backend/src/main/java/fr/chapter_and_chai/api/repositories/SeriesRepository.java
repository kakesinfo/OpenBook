package fr.chapter_and_chai.api.repositories;

import fr.chapter_and_chai.api.entities.EditorEntity;
import fr.chapter_and_chai.api.entities.SeriesEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SeriesRepository extends JpaRepository<SeriesEntity, Long> {
}
