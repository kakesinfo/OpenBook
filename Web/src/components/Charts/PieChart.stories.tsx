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
            { category: "Manga", count: 65, percentage: 54.2 },
            { category: "Bande dessinée", count: 30, percentage: 25.0 },
            { category: "Comics", count: 15, percentage: 12.5 },
            { category: "Roman", count: 10, percentage: 8.3 }
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
