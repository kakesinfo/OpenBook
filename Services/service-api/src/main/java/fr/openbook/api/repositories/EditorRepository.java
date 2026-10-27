package fr.openbook.api.repositories;

import fr.openbook.api.entities.EditorEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EditorRepository extends JpaRepository<EditorEntity, Long> {
    Optional<EditorEntity> findByNameIgnoreCase(String name);
    List<EditorEntity> findAllByOrderByNameAsc();
}
