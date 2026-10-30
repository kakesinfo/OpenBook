package fr.openbook.api.dtos;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@EqualsAndHashCode(callSuper = true)
@NoArgsConstructor
@AllArgsConstructor
public class CollectionPageDTO extends PageDTO<BookSummaryDTO> {
    private Map<String, Long> statusCounts;
    private long totalOwned;

    public CollectionPageDTO(
            List<BookSummaryDTO> content,
            long totalElements,
            int totalPages,
            int page,
            int size,
            Map<String, Long> statusCounts,
            long totalOwned
    ) {
        super(content, totalElements, totalPages, page, size);
        this.statusCounts = statusCounts;
        this.totalOwned = totalOwned;
    }
}
