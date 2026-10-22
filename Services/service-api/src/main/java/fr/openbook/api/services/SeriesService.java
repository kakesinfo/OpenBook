package fr.openbook.api.services;

import fr.openbook.api.dtos.SeriesDTO;
import fr.openbook.api.entities.SeriesEntity;
import org.springframework.stereotype.Service;

@Service
public class SeriesService {
    public static SeriesDTO entityToDTO(SeriesEntity entity) {
        SeriesDTO dto = new SeriesDTO();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        dto.setCategory(entity.getCategory().getName());
        dto.setStatus(entity.getStatus().name());
        dto.setTotalVolumes(entity.getTotalVolumes());
        return dto;
    }
}
