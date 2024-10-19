package fr.chapter_and_chai.api.repositories;

import fr.chapter_and_chai.api.entities.AuthorTypeEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuthorTypeRepository extends JpaRepository<AuthorTypeEntity, Long> {
}
