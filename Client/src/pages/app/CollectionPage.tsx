import { WrapperHeader } from "../../components/Wrapper/Wrapper.tsx";
import { useEffect, useState } from "react";
import useSession from "../../hooks/UseSession.tsx";
import BookList from "../../components/BookList/BookList.tsx";
import BookSummaryDTO from "../../dto/BookSummary.dto.ts";
import { Link } from "react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBook, faCompass } from "@fortawesome/free-solid-svg-icons";

export default function CollectionPage() {
    const session = useSession();
    const [books, setBooks] = useState<BookSummaryDTO[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        session.customFetch("/user/collection", {
            method: "GET"
        }).then(async (response) => {
            if (response.ok) {
                const data = await response.json();
                setBooks(data);
            }
        }).catch((err) => {
            console.error("Collection fetch error:", err);
        }).finally(() => {
            setLoading(false);
        });
    }, [session]);

    return (
        <div className="collection-wrapper" style={{ width: "100%", display: "flex", flexDirection: "column" }}>
            <WrapperHeader>
                <h2>Ma Bibliothèque {books.length > 0 ? `(${books.length})` : ''}</h2>
            </WrapperHeader>

            <div className="collection-body">
                {loading ? (
                    <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
                        Chargement de votre bibliothèque...
                    </div>
                ) : books.length > 0 ? (
                    <BookList books={books} />
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
                            backgroundColor: "rgba(16, 185, 129, 0.1)",
                            border: "1px solid rgba(16, 185, 129, 0.2)",
                            color: "var(--accent-primary)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "28px",
                            marginBottom: "20px"
                        }}>
                            <FontAwesomeIcon icon={faBook} />
                        </div>
                        <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>
                            Votre bibliothèque est encore vide
                        </h3>
                        <p style={{ fontSize: "0.9375rem", maxWidth: "380px", marginBottom: "24px", lineHeight: 1.6 }}>
                            Parcourez les nouveautés et ajoutez vos livres favoris à votre bibliothèque pour suivre vos lectures.
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
                            <span>Découvrir les nouveautés</span>
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
