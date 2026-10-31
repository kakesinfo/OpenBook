package fr.openbook.api.dtos;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CalendarFeedDTO {
    private String token;
    private String icsUrl;
    private String webcalUrl;
    private String googleCalendarUrl;
}
