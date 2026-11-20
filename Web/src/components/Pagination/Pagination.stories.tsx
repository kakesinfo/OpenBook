import type { Meta, StoryObj } from "@storybook/react";

import { useState } from "react";

import Pagination from "./Pagination.tsx";

const meta: Meta<typeof Pagination> = {
    title: "Components/Pagination",
    component: Pagination,
    tags: ["autodocs"]
};

export default meta;
type Story = StoryObj<typeof Pagination>;

const DefaultDemo = () => {
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    return (
        <Pagination
            currentPage={page}
            totalPages={12}
            onPageChange={setPage}
            totalItems={235}
            startIndex={(page - 1) * pageSize}
            endIndex={Math.min(page * pageSize, 235)}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            itemLabel="albums"
        />
    );
};

export const Default: Story = {
    render: () => <DefaultDemo />
};
