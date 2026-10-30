package fr.openbook.api.repositories;

import fr.openbook.api.entities.CollectionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CollectionRepository extends JpaRepository<CollectionEntity, Long> {
    Optional<CollectionEntity> findByNameIgnoreCase(String name);
    List<CollectionEntity> findAllByOrderByNameAsc();
}
