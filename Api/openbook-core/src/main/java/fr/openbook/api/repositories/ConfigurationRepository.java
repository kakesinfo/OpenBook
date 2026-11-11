package fr.openbook.api.repositories;

import fr.openbook.api.entities.ConfigurationEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ConfigurationRepository extends JpaRepository<ConfigurationEntity, Long> {
    Optional<ConfigurationEntity> findByKey(String key);
    Optional<ConfigurationEntity> findByKeyIgnoreCase(String key);
    List<ConfigurationEntity> findAllByOrderByIdAsc();
}
