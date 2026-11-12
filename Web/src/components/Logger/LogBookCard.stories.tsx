import type { Meta, StoryObj } from "@storybook/react";
import LogBookCard from "./LogBookCard.tsx";

const meta: Meta<typeof LogBookCard> = {
    title: "Components/Logger/LogBookCard",
    component: LogBookCard,
    tags: ["autodocs"]
};

export default meta;
type Story = StoryObj<typeof LogBookCard>;

export const Default: Story = {
    args: {
        book: {
            id: "1",
            title: "One Piece",
            volume: 108,
            price: 6.99,
            releaseDate: "2024-10-02",
            coverUrl: "",
            category: "Manga",
            author: "Eiichiro Oda"
        }
    }
};
