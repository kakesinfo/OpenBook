package fr.openbook.api.dtos;

import fr.openbook.api.entities.ReadingCycleEntity;
import fr.openbook.api.entities.ReadingSessionEntity;
import lombok.Getter;
import lombok.Setter;

import java.util.Collections;
import java.util.List;

@Getter
@Setter
public class ReadingCycleDTO {
    private Integer id;
    private Long bookId;
    private Boolean isCommon;
    private Long startedAt;
    private Long endedAt;
    private List<ReadingSessionDTO> sessions;

    public static ReadingCycleDTO from(ReadingCycleEntity entity, List<ReadingSessionEntity> sessionEntities) {
        ReadingCycleDTO dto = new ReadingCycleDTO();
        dto.setId(entity.getId());
        dto.setBookId(entity.getBook() != null ? entity.getBook().getId() : null);
        dto.setIsCommon(Boolean.TRUE.equals(entity.getIsCommon()));
        if (entity.getStartedAt() != null) {
            dto.setStartedAt(entity.getStartedAt().toEpochMilli());
        }
        if (entity.getEndedAt() != null) {
            dto.setEndedAt(entity.getEndedAt().toEpochMilli());
        }
        if (sessionEntities != null) {
            dto.setSessions(sessionEntities.stream().map(ReadingSessionDTO::from).toList());
        } else {
            dto.setSessions(Collections.emptyList());
        }
        return dto;
    }
}
