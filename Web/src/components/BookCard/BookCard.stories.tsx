import type { Meta, StoryObj } from "@storybook/react";
import BookCard from "./BookCard.tsx";

const meta: Meta<typeof BookCard> = {
    title: "Components/BookCard",
    component: BookCard,
    tags: ["autodocs"]
};

export default meta;
type Story = StoryObj<typeof BookCard>;

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
            author: "Eiichiro Oda",
            seriesName: "One Piece",
            readingStatus: "READ"
        },
        showReleaseDate: true,
        badgeText: "Tome 108"
    },
    render: (args) => (
        <div style={{ width: 200 }}>
            <BookCard {...args} />
        </div>
    )
};
