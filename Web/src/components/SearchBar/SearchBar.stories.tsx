import type { Meta, StoryObj } from "@storybook/react";

import { useState } from "react";

import SearchBar from "./SearchBar.tsx";

const meta: Meta<typeof SearchBar> = {
    title: "Components/SearchBar",
    component: SearchBar,
    tags: ["autodocs"]
};

export default meta;
type Story = StoryObj<typeof SearchBar>;

const DefaultDemo = () => {
    const [query, setQuery] = useState("");
    return (
        <div style={{ maxWidth: 420 }}>
            <SearchBar
                value={query}
                onChange={setQuery}
                placeholder="Rechercher un album, une série, un auteur..."
            />
        </div>
    );
};

export const Default: Story = {
    render: () => <DefaultDemo />
};

const WithInitialValueDemo = () => {
    const [query, setQuery] = useState("One Piece");
    return (
        <div style={{ maxWidth: 420 }}>
            <SearchBar
                value={query}
                onChange={setQuery}
                placeholder="Rechercher..."
            />
        </div>
    );
};

export const WithInitialValue: Story = {
    render: () => <WithInitialValueDemo />
};
