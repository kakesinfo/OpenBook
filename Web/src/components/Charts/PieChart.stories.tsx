import type { Meta, StoryObj } from "@storybook/react";
import PieChart from "./PieChart.tsx";

const meta: Meta<typeof PieChart> = {
    title: "Components/Charts/PieChart",
    component: PieChart,
    tags: ["autodocs"]
};

export default meta;
type Story = StoryObj<typeof PieChart>;

export const Default: Story = {
    args: {
        title: "Répartition par genre",
        totalCount: 120,
        data: [
            { name: "Manga", count: 65, percentage: 54.2, color: "#f97316" },
            { name: "Bande dessinée", count: 30, percentage: 25.0, color: "#3b82f6" },
            { name: "Comics", count: 15, percentage: 12.5, color: "#a855f7" },
            { name: "Roman", count: 10, percentage: 8.3, color: "#22c55e" }
        ]
    }
};

export const Empty: Story = {
    args: {
        title: "Répartition par genre",
        totalCount: 0,
        data: []
    }
};
