package fr.openbook.api.repositories;

import fr.openbook.api.entities.CollectionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CollectionRepository extends JpaRepository<CollectionEntity, Long> {
}
