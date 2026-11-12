import type { Meta, StoryObj } from "@storybook/react";
import AsyncCoverImage from "./AsyncCoverImage.tsx";

const meta: Meta<typeof AsyncCoverImage> = {
    title: "Components/AsyncCoverImage",
    component: AsyncCoverImage,
    tags: ["autodocs"]
};

export default meta;
type Story = StoryObj<typeof AsyncCoverImage>;

export const PlaceholderFallback: Story = {
    args: {
        src: null,
        alt: "Couverture manquante",
        title: "Couverture manquante"
    },
    render: (args) => (
        <div style={{ width: 150, height: 225 }}>
            <AsyncCoverImage {...args} />
        </div>
    )
};
