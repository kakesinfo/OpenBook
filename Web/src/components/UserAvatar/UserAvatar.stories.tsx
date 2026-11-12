import type { Meta, StoryObj } from "@storybook/react";
import UserAvatar from "./UserAvatar.tsx";

const meta: Meta<typeof UserAvatar> = {
    title: "Components/UserAvatar",
    component: UserAvatar,
    tags: ["autodocs"]
};

export default meta;
type Story = StoryObj<typeof UserAvatar>;

export const Initials: Story = {
    render: () => (
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <UserAvatar name="Axel" size="sm" />
            <UserAvatar name="Axel" size="md" />
            <UserAvatar name="Axel" size="lg" />
            <UserAvatar name="Axel" size="xl" />
        </div>
    )
};

export const Emoji: Story = {
    args: {
        name: "Reader",
        avatar: "📚",
        size: "lg"
    }
};
