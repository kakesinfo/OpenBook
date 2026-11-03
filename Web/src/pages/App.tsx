import { Outlet } from "react-router";
import {
    Wrapper,
    WrapperAction,
    WrapperButton,
    WrapperContent,
    WrapperNavigation,
    WrapperSubGroup,
    WrapperSubButton
} from "../components/Wrapper/Wrapper.tsx";
import {
    faNewspaper,
    faBook,
    faBookOpen,
    faTag,
    faLayerGroup,
    faHeart,
    faCalendarDays,
    faMagnifyingGlass,
    faXmark,
    faChartPie,
    faRotate,
    faWrench,
    faCodeBranch,
    faTrashCanArrowUp,
    faUserPen
} from '@fortawesome/free-solid-svg-icons';
import { useState } from "react";
import useSession from "../hooks/UseSession.tsx";
import useLanguage from "../hooks/UseLanguage.tsx";
import { useDebounce } from "../hooks/UseDebounce.tsx";
import { Dialog } from "@mui/material";
import Card from "../components/Card/Card.tsx";
import FormGroup from "../components/Form/FormGroup.tsx";
import LogBookCard from "../components/Logger/LogBookCard.tsx";
import LogSeriesCard from "../components/Logger/LogSeriesCard.tsx";
import LogAuthorCard from "../components/Logger/LogAuthorCard.tsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import BookSummaryDTO from "../dto/BookSummary.dto.ts";
import SeriesDTO from "../dto/Series.dto.ts";
import AuthorDTO from "../dto/Author.dto.ts";
import FloatingActionButton from "../components/FloatingActionButton/FloatingActionButton.tsx";

export default function App() {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [series, setSeries] = useState<SeriesDTO[]>([]);
    const [authors, setAuthors] = useState<AuthorDTO[]>([]);
    const [books, setBooks] = useState<BookSummaryDTO[]>([]);
    const [searching, setSearching] = useState(false);

    const session = useSession();
    const { t, tr } = useLanguage();

    const handleInit = () => {
        setSearch("");
        setSeries([]);
        setAuthors([]);
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
            setSeries([]);
            setAuthors([]);
            setBooks([]);
            setSearching(false);
            return;
        }

        setSearching(true);
        const encoded = encodeURIComponent(trimmedValue);

        Promise.all([
            session.customFetch(`/series?query=${encoded}`, { method: "GET" })
                .then(async (res) => (res.ok ? await res.json() : []))
                .catch(() => []),
            session.customFetch(`/authors?query=${encoded}`, { method: "GET" })
                .then(async (res) => (res.ok ? await res.json() : []))
                .catch(() => []),
            session.customFetch(`/books/search?query=${encoded}`, { method: "GET" })
                .then(async (res) => (res.ok ? await res.json() : []))
                .catch(() => [])
        ]).then(([seriesData, authorsData, booksData]) => {
            setSeries(Array.isArray(seriesData) ? seriesData : []);
            setAuthors(Array.isArray(authorsData) ? authorsData : []);
            setBooks(Array.isArray(booksData) ? booksData : []);
        }).catch((err) => {
            console.error("Search error:", err);
        }).finally(() => {
            setSearching(false);
        });
    });

    const totalResults = series.length + authors.length + books.length;

    return (
        <Wrapper>
            <WrapperNavigation title="Yet Another Library" onSearchClick={!session.isAdmin ? handleOpen : undefined}>
                {!session.isAdmin ? (
                    <>
                        <WrapperAction icon={faMagnifyingGlass} callback={handleOpen}>{t("nav.search")}</WrapperAction>
                        <WrapperButton to={'/app/home'} icon={faNewspaper}>{t("nav.news")}</WrapperButton>
                        <WrapperButton to={'/app/collection'} icon={faBook} activeRoutes={['/app/series', '/app/collection/series', '/app/sales', '/app/ventes']}>{t("nav.library")}</WrapperButton>
                        <WrapperSubGroup>
                            <WrapperSubButton to={'/app/collection'} icon={faBookOpen}>{t("nav.myBooks")}</WrapperSubButton>
                            <WrapperSubButton to={'/app/series'} icon={faLayerGroup}>{t("nav.mySeries")}</WrapperSubButton>
                            <WrapperSubButton to={'/app/sales'} icon={faTag}>{t("nav.mySales")}</WrapperSubButton>
                        </WrapperSubGroup>
                        <WrapperButton to={'/app/wishlist'} icon={faHeart}>{t("nav.wishlist")}</WrapperButton>
                        <WrapperButton to={'/app/planning'} icon={faCalendarDays}>{t("nav.planning")}</WrapperButton>
                        <WrapperButton to={'/app/statistics'} icon={faChartPie}>{t("nav.statistics")}</WrapperButton>
                    </>
                ) : (
                    <>
                        <WrapperButton to={'/app/admin/indexation'} icon={faRotate}>{t("nav.indexation")}</WrapperButton>
                        <WrapperButton to={'/app/admin/maintenance'} icon={faWrench}>{t("nav.maintenance")}</WrapperButton>
                        <WrapperButton to={'/app/admin/conflicts'} icon={faCodeBranch}>{t("nav.conflicts")}</WrapperButton>
                        <WrapperButton to={'/app/admin/deleted-books'} icon={faTrashCanArrowUp}>{t("nav.deletedBooks")}</WrapperButton>
                    </>
                )}
            </WrapperNavigation>

            <WrapperContent>
                <Outlet />
            </WrapperContent>

            {!session.isAdmin && <FloatingActionButton />}

            <Dialog
                open={open}
                onClose={handleClose}
                PaperProps={{
                    style: {
                        backgroundColor: "transparent",
                        boxShadow: "none",
                        color: "var(--text-primary)",
                        width: "100%",
                        maxWidth: "560px",
                        margin: "16px",
                    }
                }}
            >
                <Card>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <FontAwesomeIcon icon={faMagnifyingGlass} style={{ color: "var(--accent-primary)" }} />
                            <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{t("nav.search")}</h3>
                        </div>
                        <button
                            type="button"
                            onClick={handleClose}
                            style={{
                                background: "transparent",
                                border: "none",
                                color: "var(--text-muted)",
                                cursor: "pointer",
                                fontSize: "16px",
                                padding: "4px"
                            }}
                            aria-label={tr("Close", "Fermer")}
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
                            placeholder={tr("Search for a series, author, book...", "Rechercher une série, un auteur, un album...")}
                        />
                    </FormGroup>

                    {searching && (
                        <p style={{ textAlign: "center", color: "var(--text-muted)", padding: "16px 0", fontSize: "0.875rem" }}>
                            {tr("Searching...", "Recherche en cours...")}
                        </p>
                    )}

                    {!searching && search.trim() && totalResults === 0 && (
                        <p style={{ textAlign: "center", color: "var(--text-muted)", padding: "16px 0", fontSize: "0.875rem" }}>
                            {tr(`No results found for "${search}"`, `Aucun résultat trouvé pour « ${search} »`)}
                        </p>
                    )}

                    <div style={{ maxHeight: "460px", overflowY: "auto", margin: 0, paddingRight: "4px" }}>
                        {/* Séries (affichées en priorité devant les albums) */}
                        {series.length > 0 && (
                            <div className="search-dialog-section">
                                <div className="search-dialog-section__title">
                                    <FontAwesomeIcon icon={faLayerGroup} style={{ color: "#3b82f6" }} />
                                    <span>{tr("Series", "Séries")} ({series.length})</span>
                                </div>
                                <ul className="search-dialog-section__list">
                                    {series.map((s) => (
                                        <LogSeriesCard key={`series-${s.id}`} series={s} onClose={handleClose} />
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Auteurs (affichés en priorité devant les albums) */}
                        {authors.length > 0 && (
                            <div className="search-dialog-section">
                                <div className="search-dialog-section__title">
                                    <FontAwesomeIcon icon={faUserPen} style={{ color: "#a855f7" }} />
                                    <span>{tr("Authors", "Auteurs")} ({authors.length})</span>
                                </div>
                                <ul className="search-dialog-section__list">
                                    {authors.map((a) => (
                                        <LogAuthorCard key={`author-${a.id}`} author={a} onClose={handleClose} />
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Albums */}
                        {books.length > 0 && (
                            <div className="search-dialog-section">
                                <div className="search-dialog-section__title">
                                    <FontAwesomeIcon icon={faBook} style={{ color: "var(--accent-primary)" }} />
                                    <span>{tr("Books", "Albums")} ({books.length})</span>
                                </div>
                                <ul className="search-dialog-section__list">
                                    {books.map((book) => (
                                        <LogBookCard key={`book-${book.id}`} book={book} onClose={handleClose} />
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </Card>
            </Dialog>
        </Wrapper>
    );
}
