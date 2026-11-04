export interface BackupMetadataDTO {
    filename: string;
    sizeBytes: number;
    createdAt: string;
    imageCount: number;
    databaseSizeBytes: number;
    openbookVersion: string;
}

export interface RestoreResultDTO {
    filename: string;
    success: boolean;
    message: string;
    restoredAt: string;
    restoredImagesCount: number;
    databaseSizeBytes: number;
    durationMs: number;
}
