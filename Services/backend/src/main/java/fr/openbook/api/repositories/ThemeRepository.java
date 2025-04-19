package fr.openbook.api.repositories;

import fr.openbook.api.entities.ThemeEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ThemeRepository extends JpaRepository<ThemeEntity, Long> {
}
