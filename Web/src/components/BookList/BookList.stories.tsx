import type { Meta, StoryObj } from "@storybook/react";
import BookList from "./BookList.tsx";

const meta: Meta<typeof BookList> = {
    title: "Components/BookList",
    component: BookList,
    tags: ["autodocs"]
};

export default meta;
type Story = StoryObj<typeof BookList>;

export const Default: Story = {
    args: {
        books: [
            {
                id: "1",
                title: "One Piece",
                volume: 108,
                price: 6.99,
                releaseDate: "2024-10-02",
                coverUrl: "",
                category: "Manga",
                readingStatus: "READ"
            },
            {
                id: "2",
                title: "Berserk",
                volume: 42,
                price: 7.9,
                releaseDate: "2024-11-15",
                coverUrl: "",
                category: "Manga",
                readingStatus: "READING"
            },
            {
                id: "3",
                title: "Astérix",
                volume: 40,
                price: 10.5,
                releaseDate: "2023-10-26",
                coverUrl: "",
                category: "Bande dessinée",
                readingStatus: "PAUSED"
            }
        ]
    }
};
