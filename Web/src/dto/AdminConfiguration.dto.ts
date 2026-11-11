export type ConfigurationValueType = "CRON" | "STRING" | "INTEGER" | "BOOLEAN" | string;

export interface AdminConfigurationDTO {
    id: number;
    key: string;
    value: string;
    defaultValue: string;
    valueType: ConfigurationValueType;
    description?: string | null;
    default?: boolean;
    isDefault?: boolean;
    createdAt?: string;
    updatedAt?: string;
}
