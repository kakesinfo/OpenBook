package fr.chapter_and_chai.api.repositories;

import fr.chapter_and_chai.api.entities.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<UserEntity, Long> {
    Optional<UserEntity> findByUsername(String username);
    Optional<UserEntity> findByEmail(String email);

    Boolean existsByUsernameOrEmail(String username, String email);
}
