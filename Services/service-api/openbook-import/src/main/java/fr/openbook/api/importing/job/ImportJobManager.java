package fr.openbook.api.importing.job;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class ImportJobManager {

    private final Map<String, ImportJob> jobs = new ConcurrentHashMap<>();

    public ImportJob createJob(Long userId) {
        ImportJob job = new ImportJob();
        job.setId(UUID.randomUUID().toString());
        job.setUserId(userId != null && userId > 0 ? userId : 1L);
        job.setStatus("pending");
        job.setCurrentStep("Initialisation...");
        job.setErrors(new ArrayList<>());
        job.setStartedAt(Instant.now());

        jobs.put(job.getId(), job);
        return job;
    }

    public ImportJob getJob(String id) {
        return jobs.get(id);
    }
}
