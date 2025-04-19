package fr.openbook.api.repositories;

import fr.openbook.api.entities.AuthorTypeEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuthorTypeRepository extends JpaRepository<AuthorTypeEntity, Long> {
}
