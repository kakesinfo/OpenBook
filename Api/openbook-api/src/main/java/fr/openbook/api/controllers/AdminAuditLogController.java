package fr.openbook.api.controllers;

import fr.openbook.api.dtos.admin.AdminAuditLogDTO;
import fr.openbook.api.entities.AuditLogEntity;
import fr.openbook.api.services.AuditLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping({"/admin/logs", "/admin/audit-logs"})
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class AdminAuditLogController {

    private final AuditLogService auditLogService;

    private AdminAuditLogDTO toDto(AuditLogEntity entity) {
        AdminAuditLogDTO dto = new AdminAuditLogDTO();
        dto.setId(entity.getId());
        dto.setCategory(entity.getCategory());
        dto.setAction(entity.getAction());
        dto.setActor(entity.getActor());
        dto.setStatus(entity.getStatus());
        dto.setComment(entity.getComment());
        dto.setCreatedAt(entity.getCreatedAt());
        return dto;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getLogs(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size
    ) {
        Page<AuditLogEntity> result = auditLogService.getLogs(category, status, search, page, size);
        List<AdminAuditLogDTO> items = result.getContent().stream().map(this::toDto).toList();

        return ResponseEntity.ok(Map.of(
                "logs", items,
                "page", result.getNumber(),
                "size", result.getSize(),
                "totalElements", result.getTotalElements(),
                "totalPages", result.getTotalPages()
        ));
    }
}
