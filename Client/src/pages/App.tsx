import { Outlet } from "react-router";
import {
    Wrapper,
    WrapperAction,
    WrapperButton,
    WrapperContent,
    WrapperNavigation
} from "../components/Wrapper/Wrapper.tsx";
import { faNewspaper, faBook, faHeart, faCalendarDays, faMagnifyingGlass, faXmark } from '@fortawesome/free-solid-svg-icons';
import { useState } from "react";
import useSession from "../hooks/UseSession.tsx";
import { useDebounce } from "../hooks/UseDebounce.tsx";
import { Dialog } from "@mui/material";
import Card from "../components/Card/Card.tsx";
import FormGroup from "../components/Form/FormGroup.tsx";
import LogBookCard from "../components/Logger/LogBookCard.tsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import BookSummaryDTO from "../dto/BookSummary.dto.ts";

export default function App() {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [books, setBooks] = useState<BookSummaryDTO[]>([]);
    const [searching, setSearching] = useState(false);

    const session = useSession();

    const handleInit = () => {
        setSearch("");
        setBooks([]);
        setSearching(false);
    };

    const handleOpen = () => {
        setOpen(true);
        handleInit();

        setTimeout(() => {
            const input = document.querySelector('input[name="bookName"]') as HTMLInputElement;
            if (input) {
                input.focus();
            }
        }, 120);
    };

    const handleClose = () => {
        setOpen(false);
        handleInit();
    };

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(event.target.value);
    };

    useDebounce(search, 300, (value) => {
        const trimmedValue = value?.trim();
        if (!trimmedValue || trimmedValue.length === 0) {
            setBooks([]);
            setSearching(false);
            return;
        }

        setSearching(true);
        session.customFetch(`/books/search/${encodeURIComponent(trimmedValue)}`, {
            method: "GET",
        }).then(async (data) => {
            if (data.ok) {
                const results = await data.json();
                setBooks(results);
            }
        }).catch(err => {
            console.error("Search error:", err);
        }).finally(() => {
            setSearching(false);
        });
    });

    return (
        <Wrapper>
            <WrapperNavigation title="Yet Another Library" onSearchClick={handleOpen}>
                <WrapperAction icon={faMagnifyingGlass} callback={handleOpen}>Recherche</WrapperAction>
                <WrapperButton to={'/app/home'} icon={faNewspaper}>Nouveautés</WrapperButton>
                <WrapperButton to={'/app/collection'} icon={faBook}>Collection</WrapperButton>
                <WrapperButton to={'/app/wishlist'} icon={faHeart}>Souhaits</WrapperButton>
                <WrapperButton to={'/app/planning'} icon={faCalendarDays}>Planning</WrapperButton>
            </WrapperNavigation>

            <WrapperContent>
                <Outlet />
            </WrapperContent>

            <Dialog
                open={open}
                onClose={handleClose}
                PaperProps={{
                    style: {
                        backgroundColor: "transparent",
                        boxShadow: "none",
                        width: "100%",
                        maxWidth: "540px",
                        margin: "16px",
                    }
                }}
            >
                <Card>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <FontAwesomeIcon icon={faMagnifyingGlass} style={{ color: "var(--accent-primary)" }} />
                            <h3 style={{ fontSize: "1.125rem", fontWeight: 700 }}>Recherche</h3>
                        </div>
                        <button
                            type="button"
                            onClick={handleClose}
                            style={{
                                background: "transparent",
                                border: "none",
                                color: "var(--text-muted)",
                                cursor: "pointer",
                                fontSize: "1.1rem",
                                padding: "4px"
                            }}
                            aria-label="Fermer"
                        >
                            <FontAwesomeIcon icon={faXmark} />
                        </button>
                    </div>

                    <FormGroup>
                        <input
                            type="text"
                            name="bookName"
                            autoComplete="off"
                            value={search}
                            onChange={handleChange}
                            placeholder="Rechercher par titre, auteur, tome..."
                        />
                    </FormGroup>

                    {searching && (
                        <p style={{ textAlign: "center", color: "var(--text-muted)", padding: "16px 0", fontSize: "0.875rem" }}>
                            Recherche en cours...
                        </p>
                    )}

                    {!searching && search.trim() && books.length === 0 && (
                        <p style={{ textAlign: "center", color: "var(--text-muted)", padding: "16px 0", fontSize: "0.875rem" }}>
                            Aucun livre trouvé pour « {search} »
                        </p>
                    )}

                    <ul style={{ maxHeight: "360px", overflowY: "auto", margin: 0 }}>
                        {books.map((book) => (
                            <LogBookCard key={book.id} book={book} onClose={handleClose} />
                        ))}
                    </ul>
                </Card>
            </Dialog>
        </Wrapper>
    );
}
