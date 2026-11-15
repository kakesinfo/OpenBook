export interface AdminAuditLogDTO {
    id: number;
    category: string;
    action: string;
    actor: string;
    status: string;
    comment?: string | null;
    createdAt: string;
}

export interface AdminAuditLogPageResponse {
    logs: AdminAuditLogDTO[];
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
}
