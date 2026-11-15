package fr.openbook.api.services;

import fr.openbook.scraper.service.ScraperEngineService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
@Slf4j
@RequiredArgsConstructor
public class ScraperService {

    private final ScraperEngineService engineService;

    public Map<String, Object> getStatus() {
        return engineService.getStatus();
    }

    public Map<String, Object> getSources() {
        return Map.of("sources", engineService.getSources());
    }

    public Map<String, Object> toggleSource(String source, boolean enabled) {
        return engineService.toggleSource(source, enabled);
    }

    public Map<String, Object> triggerScrape(List<String> sources, boolean full) {
        return engineService.triggerScrape(sources, full);
    }

    public Map<String, Object> stopScan() {
        return engineService.stopScan();
    }
}
