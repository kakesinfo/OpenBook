export default interface UserBookTransactionDTO {
    id: number;
    bookId: number;
    userId: number;
    type: "BOUGHT" | "GIFT" | "SOLD";
    date?: string | null; // YYYY-MM-DD, YYYY-MM, or YYYY
    datePrecision?: "YEAR" | "MONTH" | "DAY" | null;
    price?: number | null;
    location?: string | null;
    memo?: string | null;
    createdAt?: number;
}
