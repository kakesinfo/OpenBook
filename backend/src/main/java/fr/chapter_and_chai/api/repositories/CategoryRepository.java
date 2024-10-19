package fr.chapter_and_chai.api.repositories;

import fr.chapter_and_chai.api.entities.CategoryEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CategoryRepository extends JpaRepository<CategoryEntity, Long> {
}
