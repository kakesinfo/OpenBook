package fr.openbook.api.dtos;

import fr.openbook.api.entities.ReadingSessionEntity;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ReadingSessionDTO {
    private Integer id;
    private Long bookId;
    private Integer currentPage;
    private Integer minutesRead;
    private Integer secondsRead;
    private Integer sessionType;
    private Boolean isCommon;
    private Long createdAt;

    public static ReadingSessionDTO from(ReadingSessionEntity entity) {
        ReadingSessionDTO dto = new ReadingSessionDTO();
        dto.setId(entity.getId());
        dto.setBookId(entity.getBook() != null ? entity.getBook().getId() : null);
        dto.setCurrentPage(entity.getCurrentPage());
        dto.setMinutesRead(entity.getMinutesRead());
        dto.setSecondsRead(entity.getSecondsRead());
        dto.setSessionType(entity.getSessionType());
        dto.setIsCommon(Boolean.TRUE.equals(entity.getIsCommon()));
        if (entity.getCreatedAt() != null) {
            dto.setCreatedAt(entity.getCreatedAt().toEpochMilli());
        }
        return dto;
    }
}
