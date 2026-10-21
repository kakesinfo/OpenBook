import { WrapperHeader } from "../../components/Wrapper/Wrapper.tsx";
import { useEffect, useState } from "react";
import useSession from "../../hooks/UseSession.tsx";
import BookList from "../../components/BookList/BookList.tsx";
import BookSummaryDTO from "../../dto/BookSummary.dto.ts";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSliders } from "@fortawesome/free-solid-svg-icons";

import "./HomePage.scss";

export default function HomePage() {
    const session = useSession();
    const [books, setBooks] = useState<BookSummaryDTO[]>([]);
    const [order, setOrder] = useState<"oldest" | "newest">("newest");
    const [loading, setLoading] = useState(true);

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
    };

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
                    <BookList books={books} />
                )}
            </div>
        </div>
    );
}
