import type { Meta, StoryObj } from "@storybook/react";
import Card from "./Card.tsx";

const meta: Meta<typeof Card> = {
    title: "Components/Card",
    component: Card,
    tags: ["autodocs"]
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
    args: {
        children: (
            <div>
                <h3 style={{ marginTop: 0 }}>Titre de la carte</h3>
                <p style={{ marginBottom: 0 }}>Contenu de démonstration dans le composant Card.</p>
            </div>
        )
    }
};
