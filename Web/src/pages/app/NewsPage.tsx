import { WrapperHeader } from "../../components/Wrapper/Wrapper.tsx";
import { useEffect, useState } from "react";
import useSession from "../../hooks/UseSession.tsx";
import useLanguage from "../../hooks/UseLanguage.tsx";
import BookList from "../../components/BookList/BookList.tsx";
import BookSummaryDTO from "../../dto/BookSummary.dto.ts";
import { faSliders } from "@fortawesome/free-solid-svg-icons";
import Pagination from "../../components/Pagination/Pagination.tsx";
import Select from "../../components/Select/Select.tsx";

import "./NewsPage.scss";

export default function NewsPage() {
    const session = useSession();
    const { tr } = useLanguage();
    const [books, setBooks] = useState<BookSummaryDTO[]>([]);
    const [order, setOrder] = useState<"oldest" | "newest">("newest");
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [totalBooks, setTotalBooks] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        setLoading(true);
        session.customFetch(`/books/${order}?page=${currentPage}&size=${pageSize}&limit=100`, {
            method: "GET"
        }).then(async (response) => {
            if (response.ok) {
                const data = await response.json();
                if (data && Array.isArray(data.content)) {
                    setBooks(data.content);
                    setTotalBooks(data.totalElements ?? 0);
                    setTotalPages(data.totalPages ?? 1);
                } else if (Array.isArray(data)) {
                    const capped = data.slice(0, 100);
                    setBooks(capped.slice((currentPage - 1) * pageSize, currentPage * pageSize));
                    setTotalBooks(capped.length);
                    setTotalPages(Math.max(1, Math.ceil(capped.length / pageSize)));
                }
            }
        }).catch((err) => {
            console.error("HomePage fetch error:", err);
        }).finally(() => {
            setLoading(false);
        });
    }, [order, currentPage, pageSize, session]);

    const handleOrderChange = (newOrder: "oldest" | "newest") => {
        setOrder(newOrder);
        setCurrentPage(1);
        window.scrollTo({ top: 0, behavior: "smooth" });
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

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + books.length, totalBooks);

    return (
        <div className="newbooks-wrapper">
            <WrapperHeader>
                <h2>{tr("New Releases", "Nouveautés")}</h2>
                <Select
                    multiple={false}
                    className="newbooks-order-select"
                    icon={faSliders}
                    placeholder={tr("Sort by", "Trier par")}
                    value={order}
                    onChange={(val) => handleOrderChange(val as "oldest" | "newest")}
                    options={[
                        { id: "newest", label: tr("Newest first", "Les plus récentes") },
                        { id: "oldest", label: tr("Oldest first", "Les plus anciennes") }
                    ]}
                />
            </WrapperHeader>

            <div className="newbooks-body">
                {loading ? (
                    <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
                        {tr("Loading new releases...", "Chargement des nouveautés...")}
                    </div>
                ) : (
                    <>
                        <BookList books={books} />
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={handlePageChange}
                            totalItems={totalBooks}
                            startIndex={startIndex}
                            endIndex={endIndex}
                            pageSize={pageSize}
                            onPageSizeChange={handlePageSizeChange}
                            pageSizeOptions={[20, 50, 100]}
                        />
                    </>
                )}
            </div>
        </div>
    );
}
