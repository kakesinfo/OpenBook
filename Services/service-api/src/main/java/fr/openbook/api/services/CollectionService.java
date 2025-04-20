package fr.openbook.api.services;

import fr.openbook.api.dtos.CollectionDTO;
import fr.openbook.api.dtos.SeriesDTO;
import fr.openbook.api.entities.CollectionEntity;
import fr.openbook.api.entities.SeriesEntity;
import org.springframework.stereotype.Service;

@Service
public class CollectionService {
    public static CollectionDTO entityToDTO(CollectionEntity entity) {
        CollectionDTO dto = new CollectionDTO();
        dto.setName(entity.getName());
        return dto;
    }
}