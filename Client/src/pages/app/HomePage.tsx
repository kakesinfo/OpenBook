import { WrapperHeader } from "../../components/Wrapper/Wrapper.tsx";
import { useEffect, useState } from "react";
import useSession from "../../hooks/UseSession.tsx";
import BookList from "../../components/BookList/BookList.tsx";
import BookSummaryDTO from "../../dto/BookSummary.dto.ts";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSliders } from "@fortawesome/free-solid-svg-icons";
import Pagination from "../../components/Pagination/Pagination.tsx";

import "./HomePage.scss";

export default function HomePage() {
    const session = useSession();
    const [books, setBooks] = useState<BookSummaryDTO[]>([]);
    const [order, setOrder] = useState<"oldest" | "newest">("newest");
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(24);

    useEffect(() => {
        setLoading(true);
        session.customFetch(`/books/${order}`, {
            method: "GET"
        }).then(async (response) => {
            if (response.ok) {
                const data = await response.json();
                setBooks(data);
            }
        }).catch((err) => {
            console.error("HomePage fetch error:", err);
        }).finally(() => {
            setLoading(false);
        });
    }, [order, session]);

    const handleOrderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setOrder(e.target.value as "oldest" | "newest");
        setCurrentPage(1);
    };

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        setCurrentPage(1);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const totalBooks = books.length;
    const totalPages = Math.max(1, Math.ceil(totalBooks / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const startIndex = (safePage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalBooks);
    const paginatedBooks = books.slice(startIndex, endIndex);

    return (
        <div className="newbooks-wrapper">
            <WrapperHeader>
                <h2>Nouveautés</h2>
                <div className="newbooks-order-pill">
                    <FontAwesomeIcon icon={faSliders} />
                    <span>Trier par :</span>
                    <select value={order} onChange={handleOrderChange} aria-label="Trier par">
                        <option value="newest">Les plus récentes</option>
                        <option value="oldest">Les plus anciennes</option>
                    </select>
                </div>
            </WrapperHeader>

            <div className="newbooks-body">
                {loading ? (
                    <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
                        Chargement des nouveautés...
                    </div>
                ) : (
                    <>
                        <BookList books={paginatedBooks} />
                        <Pagination
                            currentPage={safePage}
                            totalPages={totalPages}
                            onPageChange={handlePageChange}
                            totalItems={totalBooks}
                            startIndex={startIndex}
                            endIndex={endIndex}
                            pageSize={pageSize}
                            onPageSizeChange={handlePageSizeChange}
                            pageSizeOptions={[24, 48, 96]}
                        />
                    </>
                )}
            </div>
        </div>
    );
}
