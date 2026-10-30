package fr.openbook.scraper.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScanOptions {
    private boolean fullScan;
    private int maxItems;
    private List<String> targetSources;

    public ScanOptions(boolean fullScan, int maxItems) {
        this.fullScan = fullScan;
        this.maxItems = maxItems;
        this.targetSources = List.of();
    }
}
