export interface BackupMetadataDTO {
    filename: string;
    sizeBytes: number;
    createdAt: string;
    imageCount: number;
    databaseSizeBytes: number;
    openbookVersion: string;
}
