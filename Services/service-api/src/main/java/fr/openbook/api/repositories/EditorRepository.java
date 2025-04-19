package fr.openbook.api.repositories;

import fr.openbook.api.entities.EditorEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EditorRepository extends JpaRepository<EditorEntity, Long> {
}
