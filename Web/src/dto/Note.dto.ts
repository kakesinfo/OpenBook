import BookSummaryDTO from "./BookSummary.dto.ts";

export default interface NoteDTO {
    id: number;
    bookId: string | number;
    book?: BookSummaryDTO;
    content: string;
    username?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface CreateNoteRequest {
    bookId: number;
    content: string;
}

export interface UpdateNoteRequest {
    content: string;
}
