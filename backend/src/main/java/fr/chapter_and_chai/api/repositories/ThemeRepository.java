package fr.chapter_and_chai.api.repositories;

import fr.chapter_and_chai.api.entities.ThemeEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ThemeRepository extends JpaRepository<ThemeEntity, Long> {
}
