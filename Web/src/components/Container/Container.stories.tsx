import type { Meta, StoryObj } from "@storybook/react";
import Container from "./Container.tsx";

const meta: Meta<typeof Container> = {
    title: "Components/Container",
    component: Container,
    tags: ["autodocs"]
};

export default meta;
type Story = StoryObj<typeof Container>;

export const Default: Story = {
    args: {
        children: (
            <div style={{ padding: "1rem", border: "1px dashed var(--border-subtle)" }}>
                Contenu centré dans Container
            </div>
        )
    }
};
