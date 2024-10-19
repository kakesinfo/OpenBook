package fr.chapter_and_chai.api.repositories;

import fr.chapter_and_chai.api.entities.BookEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BookRepository extends JpaRepository<BookEntity, Long> {
}
