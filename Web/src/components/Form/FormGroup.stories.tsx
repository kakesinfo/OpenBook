import type { Meta, StoryObj } from "@storybook/react";
import FormGroup from "./FormGroup.tsx";

const meta: Meta<typeof FormGroup> = {
    title: "Components/Form/FormGroup",
    component: FormGroup,
    tags: ["autodocs"]
};

export default meta;
type Story = StoryObj<typeof FormGroup>;

export const Default: Story = {
    args: {
        children: (
            <>
                <label>Nom de la série</label>
                <input type="text" placeholder="Ex: One Piece" />
            </>
        )
    }
};
