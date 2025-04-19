package fr.openbook.api.repositories;

import fr.openbook.api.entities.BookHasAuthorEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BookHasAuthorRepository extends JpaRepository<BookHasAuthorEntity, Long> {
}
