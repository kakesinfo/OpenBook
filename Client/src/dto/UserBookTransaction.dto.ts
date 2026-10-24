export default interface UserBookTransactionDTO {
    id: number;
    bookId: number;
    userId: number;
    type: "BOUGHT" | "SOLD";
    date?: string | null; // YYYY-MM-DD
    price?: number | null;
    location?: string | null;
    memo?: string | null;
    createdAt?: number;
}
