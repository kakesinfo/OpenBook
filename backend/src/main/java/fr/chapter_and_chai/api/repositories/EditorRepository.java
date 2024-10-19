package fr.chapter_and_chai.api.repositories;

import fr.chapter_and_chai.api.entities.EditorEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EditorRepository extends JpaRepository<EditorEntity, Long> {
}
