package fr.openbook.api.services;

import fr.openbook.api.dtos.SeriesDTO;
import fr.openbook.api.entities.SeriesEntity;
import org.springframework.stereotype.Service;

@Service
public class SeriesService {
    public static SeriesDTO entityToDTO(SeriesEntity entity) {
        if (entity == null) {
            return null;
        }
        SeriesDTO dto = new SeriesDTO();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        dto.setDescription(entity.getDescription());
        if (entity.getCategory() != null) {
            dto.setCategory(entity.getCategory().getName());
            dto.setCategoryId(entity.getCategory().getId() != null ? entity.getCategory().getId().intValue() : null);
        }
        if (entity.getStatus() != null) {
            dto.setStatus(entity.getStatus().name());
        }
        dto.setTotalVolumes(entity.getTotalVolumes() != null ? entity.getTotalVolumes() : 0);
        dto.setCoverUrl(entity.getCoverUrl());
        if (entity.getCreatedByUser() != null) {
            dto.setCreatedByUserId(entity.getCreatedByUser().getId());
            dto.setCreatedByUsername(entity.getCreatedByUser().getUsername());
        }
        return dto;
    }
}
