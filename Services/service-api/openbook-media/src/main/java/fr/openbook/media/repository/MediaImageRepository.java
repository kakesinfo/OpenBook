package fr.openbook.media.repository;

import fr.openbook.media.entity.MediaImage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface MediaImageRepository extends JpaRepository<MediaImage, UUID> {
}
