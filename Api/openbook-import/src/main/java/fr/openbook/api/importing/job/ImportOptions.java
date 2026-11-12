package fr.openbook.api.importing.job;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ImportOptions {
    @Builder.Default
    private boolean importBooks = true;
    @Builder.Default
    private boolean importStatuses = true;
    @Builder.Default
    private boolean importReadingSessions = true;
    @Builder.Default
    private boolean importPurchases = true;
    @Builder.Default
    private boolean importNotes = true;
}
