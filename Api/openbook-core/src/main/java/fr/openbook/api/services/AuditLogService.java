package fr.openbook.api.services;

import fr.openbook.api.entities.AuditLogEntity;
import fr.openbook.api.repositories.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditLogService {

    public static final String ACTOR_CRON = "CRON";
    public static final String ACTOR_SYSTEM = "SYSTEM";

    public static final String STATUS_STARTED = "STARTED";
    public static final String STATUS_SUCCESS = "SUCCESS";
    public static final String STATUS_FAILURE = "FAILURE";

    private final AuditLogRepository auditLogRepository;

    public String getCurrentActor() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated()) {
            String name = auth.getName();
            if (name != null && !name.isBlank() && !"anonymousUser".equalsIgnoreCase(name)) {
                return name;
            }
        }
        return ACTOR_SYSTEM;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void log(String category, String action, String actor, String status, String comment) {
        try {
            AuditLogEntity entity = new AuditLogEntity();
            entity.setCategory(category != null ? category.trim().toUpperCase() : "SYSTEM");
            entity.setAction(action != null ? action.trim() : "Action");
            entity.setActor(actor != null && !actor.isBlank() ? actor.trim() : ACTOR_SYSTEM);
            entity.setStatus(status != null && !status.isBlank() ? status.trim().toUpperCase() : STATUS_SUCCESS);
            entity.setComment(comment != null && !comment.isBlank() ? comment.trim() : null);
            auditLogRepository.save(entity);
        } catch (Exception e) {
            log.warn("[AuditLog] Failed to persist audit log (category={}, action={}): {}", category, action, e.getMessage());
        }
    }

    public void logAdmin(String category, String action, String status, String comment) {
        log(category, action, getCurrentActor(), status, comment);
    }

    public void logCron(String category, String action, String status, String comment) {
        log(category, action, ACTOR_CRON, status, comment);
    }

    public Page<AuditLogEntity> getLogs(String category, String status, String search, int page, int size) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 100);
        Pageable pageable = PageRequest.of(
                safePage,
                safeSize,
                Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"))
        );

        Specification<AuditLogEntity> spec = Specification.where(null);

        if (category != null && !category.isBlank() && !"ALL".equalsIgnoreCase(category)) {
            String cat = category.trim().toLowerCase();
            spec = spec.and((root, query, cb) -> cb.equal(cb.lower(root.get("category")), cat));
        }

        if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
            String st = status.trim().toLowerCase();
            spec = spec.and((root, query, cb) -> cb.equal(cb.lower(root.get("status")), st));
        }

        if (search != null && !search.isBlank()) {
            String pattern = "%" + search.trim().toLowerCase() + "%";
            spec = spec.and((root, query, cb) -> cb.or(
                    cb.like(cb.lower(root.get("action")), pattern),
                    cb.like(cb.lower(root.get("actor")), pattern),
                    cb.like(cb.lower(cb.coalesce(root.get("comment"), "")), pattern)
            ));
        }

        return auditLogRepository.findAll(spec, pageable);
    }
}
