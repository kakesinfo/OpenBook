import type { Meta, StoryObj } from "@storybook/react";
import ThemeSelector from "./ThemeSelector.tsx";

const meta: Meta<typeof ThemeSelector> = {
    title: "Components/ThemeSelector",
    component: ThemeSelector,
    tags: ["autodocs"]
};

export default meta;
type Story = StoryObj<typeof ThemeSelector>;

export const Default: Story = {};
