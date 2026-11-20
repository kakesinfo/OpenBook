import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import {
    faLayerGroup,
    faBookBookmark,
    faCheck,
    faBan,
    faCalendarDays,
    faClockRotateLeft,
    faTag
} from "@fortawesome/free-solid-svg-icons";
import HeaderFilterTabs from "./HeaderFilterTabs.tsx";

const meta: Meta<typeof HeaderFilterTabs> = {
    title: "Components/HeaderFilterTabs",
    component: HeaderFilterTabs,
    tags: ["autodocs"]
};

export default meta;
type Story = StoryObj<typeof HeaderFilterTabs>;

const CollectionTabsDemo = () => {
    const [selected, setSelected] = useState("all");
    return (
        <HeaderFilterTabs
            tabs={[
                { id: "all", label: "Tous", icon: faLayerGroup, count: 142 },
                { id: "toread", label: "Pile à lire", icon: faBookBookmark, count: 24 },
                { id: "read", label: "Lu", icon: faCheck, count: 115 },
                { id: "abandoned", label: "Abandonné", icon: faBan, count: 3 }
            ]}
            selectedId={selected}
            onChange={setSelected}
        />
    );
};

export const CollectionTabs: Story = {
    render: () => <CollectionTabsDemo />
};

const PlanningTabsDemo = () => {
    const [selected, setSelected] = useState("upcoming");
    return (
        <HeaderFilterTabs
            tabs={[
                { id: "upcoming", label: "À venir", icon: faCalendarDays, count: 12 },
                { id: "recent", label: "Parus récemment", icon: faClockRotateLeft, count: 8 }
            ]}
            selectedId={selected}
            onChange={setSelected}
        />
    );
};

export const PlanningTabs: Story = {
    render: () => <PlanningTabsDemo />
};

const SalesTabsDemo = () => {
    const [selected, setSelected] = useState("all");
    return (
        <HeaderFilterTabs
            tabs={[
                { id: "all", label: "Tous", icon: faLayerGroup, count: 19 },
                { id: "FOR_SALE", label: "À vendre", icon: faTag, count: 7 },
                { id: "SOLD", label: "Vendu", icon: faCheck, count: 12 }
            ]}
            selectedId={selected}
            onChange={setSelected}
        />
    );
};

export const SalesTabs: Story = {
    render: () => <SalesTabsDemo />
};
