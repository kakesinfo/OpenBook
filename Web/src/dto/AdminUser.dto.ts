export interface AdminUserDTO {
    id: number;
    username: string;
    role: string;
    avatar?: string;
    blocked: boolean;
    mustChangePassword: boolean;
    createdAt?: string;
    updatedAt?: string;
    booksCount: number;
}
