package fr.openbook.api.services;

import fr.openbook.api.dtos.CollectionDTO;
import fr.openbook.api.entities.CollectionEntity;
import org.springframework.stereotype.Service;

@Service
public class CollectionService {
    public static CollectionDTO entityToDTO(CollectionEntity entity) {
        if (entity == null) return null;
        CollectionDTO dto = new CollectionDTO();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        return dto;
    }
}
