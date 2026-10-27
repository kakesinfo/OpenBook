package fr.openbook.api.repositories;

import fr.openbook.api.entities.AuthorTypeEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AuthorTypeRepository extends JpaRepository<AuthorTypeEntity, Long> {
    Optional<AuthorTypeEntity> findByNameIgnoreCase(String name);
}
