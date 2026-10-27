import { WrapperHeader } from "../../components/Wrapper/Wrapper.tsx";
import { useEffect, useState } from "react";
import useSession from "../../hooks/UseSession.tsx";
import BookList from "../../components/BookList/BookList.tsx";
import BookSummaryDTO from "../../dto/BookSummary.dto.ts";
import { Link } from "react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHeart, faCompass } from "@fortawesome/free-solid-svg-icons";

export default function WishlistPage() {
    const session = useSession();
    const [books, setBooks] = useState<BookSummaryDTO[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        session.customFetch("/user/wishlist", {
            method: "GET"
        }).then(async (response) => {
            if (response.ok) {
                const data = await response.json();
                setBooks(data);
            }
        }).catch((err) => {
            console.error("Wishlist fetch error:", err);
        }).finally(() => {
            setLoading(false);
        });
    }, [session]);

    return (
        <div className="wishlist-wrapper" style={{ width: "100%", display: "flex", flexDirection: "column" }}>
            <WrapperHeader>
                <h2>Liste de souhaits {books.length > 0 ? `(${books.length})` : ''}</h2>
            </WrapperHeader>

            <div className="wishlist-body">
                {loading ? (
                    <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
                        Chargement de votre liste de souhaits...
                    </div>
                ) : books.length > 0 ? (
                    <BookList
                        books={books}
                        onBookStatusChange={(bookId, newStatus) => {
                            if (newStatus !== "WISHLISTED") {
                                setBooks((prev) => prev.filter((b) => b.id !== bookId));
                            }
                        }}
                    />
                ) : (
                    <div style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "80px 20px",
                        textAlign: "center",
                        color: "var(--text-muted)"
                    }}>
                        <div style={{
                            width: "72px",
                            height: "72px",
                            borderRadius: "50%",
                            backgroundColor: "rgba(244, 63, 94, 0.1)",
                            border: "1px solid rgba(244, 63, 94, 0.2)",
                            color: "#f43f5e",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "28px",
                            marginBottom: "20px"
                        }}>
                            <FontAwesomeIcon icon={faHeart} />
                        </div>
                        <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>
                            Aucun livre dans vos souhaits
                        </h3>
                        <p style={{ fontSize: "0.9375rem", maxWidth: "380px", marginBottom: "24px", lineHeight: 1.6 }}>
                            Retrouvez ici tous les ouvrages que vous aimeriez acquérir ou lire plus tard.
                        </p>
                        <Link
                            to="/app/home"
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "8px",
                                height: "42px",
                                padding: "0 22px",
                                borderRadius: "var(--radius-full)",
                                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                                color: "#fff",
                                fontWeight: 600,
                                fontSize: "0.875rem",
                                boxShadow: "0 4px 14px 0 rgba(16, 185, 129, 0.35)"
                            }}
                        >
                            <FontAwesomeIcon icon={faCompass} />
                            <span>Explorer le catalogue</span>
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
