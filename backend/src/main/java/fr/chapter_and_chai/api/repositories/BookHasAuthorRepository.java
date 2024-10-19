package fr.chapter_and_chai.api.repositories;

import fr.chapter_and_chai.api.entities.BookHasAuthorEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BookHasAuthorRepository extends JpaRepository<BookHasAuthorEntity, Long> {
}
