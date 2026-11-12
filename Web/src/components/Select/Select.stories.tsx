import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { faBookOpen, faSliders } from "@fortawesome/free-solid-svg-icons";
import Select, { DEFAULT_APP_CATEGORIES } from "./Select.tsx";

const meta: Meta<typeof Select> = {
    title: "Components/Select",
    component: Select,
    tags: ["autodocs"]
};

export default meta;
type Story = StoryObj<typeof Select>;

export const SingleSelect: Story = {
    render: () => {
        const [value, setValue] = useState("READING");
        return (
            <Select
                multiple={false}
                icon={faBookOpen}
                placeholder="Statut de lecture"
                value={value}
                onChange={setValue}
                options={[
                    { id: "UNREAD", label: "Non lu" },
                    { id: "READING", label: "En cours de lecture" },
                    { id: "PAUSED", label: "En pause" },
                    { id: "READ", label: "Lu" },
                    { id: "ABANDONED", label: "Abandonné" }
                ]}
            />
        );
    }
};

export const SearchableWithCustom: Story = {
    render: () => {
        const [value, setValue] = useState("");
        return (
            <Select
                multiple={false}
                searchable
                allowCustom
                allowEmpty
                placeholder="Sélectionner ou créer une série..."
                emptyLabel="-- Aucune série --"
                value={value}
                onChange={setValue}
                options={["One Piece", "Naruto", "Dragon Ball", "L'Attaque des Titans", "Berserk"]}
            />
        );
    }
};

export const MultiSelectCategories: Story = {
    render: () => {
        const [selected, setSelected] = useState<string[]>([]);
        return (
            <Select
                multiple
                translateOptions
                options={DEFAULT_APP_CATEGORIES}
                selected={selected}
                onChange={setSelected}
                allLabel="Toutes les catégories"
            />
        );
    }
};

export const SortSelect: Story = {
    render: () => {
        const [order, setOrder] = useState("newest");
        return (
            <Select
                multiple={false}
                icon={faSliders}
                placeholder="Trier par"
                value={order}
                onChange={setOrder}
                options={[
                    { id: "newest", label: "Les plus récentes" },
                    { id: "oldest", label: "Les plus anciennes" }
                ]}
            />
        );
    }
};
