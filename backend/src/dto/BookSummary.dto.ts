export interface BookSummaryDTO {
    id: number
    title: string

    pageCount: number
    volume: number
    weight: number
    price: number

    editor: number;

    authors: {
        id: number
        type_id: number
    }[]

    created_at: Date
    updated_at: Date
}