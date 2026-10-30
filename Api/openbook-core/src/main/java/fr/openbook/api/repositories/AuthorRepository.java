package fr.openbook.api.repositories;

import fr.openbook.api.entities.AuthorEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AuthorRepository extends JpaRepository<AuthorEntity, Long> {
    Optional<AuthorEntity> findByFirstnameIgnoreCaseAndLastnameIgnoreCase(String firstname, String lastname);
    List<AuthorEntity> findAllByOrderByLastnameAscFirstnameAsc();
}
