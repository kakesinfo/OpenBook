package fr.chapter_and_chai.api.repositories;

import fr.chapter_and_chai.api.entities.AuthorEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuthorRepository extends JpaRepository<AuthorEntity, Long> {
}
