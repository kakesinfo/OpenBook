export default interface AchievementDTO {
    id: number;
    name: string;
    totalSteps: number;
    completedSteps: number;
    icon: string;
    ornament?: string;
    iconColor: string;
    backgroundColor: string;
    unlocked: boolean;
    unlockedAt: string | null;
    createdAt: string;
    updatedAt: string;
}
