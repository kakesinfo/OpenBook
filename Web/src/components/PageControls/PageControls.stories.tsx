import type { Meta, StoryObj } from "@storybook/react";

import { useState } from "react";

import PageControls from "./PageControls.tsx";

import SearchBar from "../SearchBar/SearchBar.tsx";

import Select, { DEFAULT_APP_CATEGORIES } from "../Select/Select.tsx";

const meta: Meta<typeof PageControls> = {
    title: "Components/PageControls",
    component: PageControls,
    tags: ["autodocs"]
};

export default meta;
type Story = StoryObj<typeof PageControls>;

const DefaultDemo = () => {
    const [cats, setCats] = useState<string[]>([]);
    const [query, setQuery] = useState("");
    return (
        <PageControls
            left={
                <Select
                    multiple
                    translateOptions
                    options={DEFAULT_APP_CATEGORIES}
                    selected={cats}
                    onChange={setCats}
                />
            }
            center={
                <SearchBar
                    value={query}
                    onChange={setQuery}
                    placeholder="Rechercher un album..."
                />
            }
            right={
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                    42 résultats
                </span>
            }
        />
    );
};

export const Default: Story = {
    render: () => <DefaultDemo />
};

const WithBottomSlotDemo = () => {
    const [query, setQuery] = useState("");
    return (
        <PageControls
            center={
                <SearchBar
                    value={query}
                    onChange={setQuery}
                    placeholder="Rechercher un terme..."
                />
            }
            right={
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                    18 termes
                </span>
            }
            bottom={
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", fontSize: "0.85rem" }}>
                    {"ABCDEF".split("").map((l) => (
                        <span
                            key={l}
                            style={{
                                padding: "4px 10px",
                                borderRadius: "6px",
                                border: "1px solid var(--border-subtle)"
                            }}
                        >
                            {l}
                        </span>
                    ))}
                </div>
            }
        />
    );
};

export const WithBottomSlot: Story = {
    render: () => <WithBottomSlotDemo />
};
