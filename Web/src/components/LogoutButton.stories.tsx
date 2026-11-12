import type { Meta, StoryObj } from "@storybook/react";
import LogoutButton from "./LogoutButton.tsx";

const meta: Meta<typeof LogoutButton> = {
    title: "Components/LogoutButton",
    component: LogoutButton,
    tags: ["autodocs"]
};

export default meta;
type Story = StoryObj<typeof LogoutButton>;

export const Default: Story = {
    args: {
        compact: false
    }
};

export const Compact: Story = {
    args: {
        compact: true
    }
};
