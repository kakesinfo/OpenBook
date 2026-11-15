import { useParams, Link, useNavigate } from "react-router";
import { ReactNode, useEffect, useRef, useState } from "react";
import BookDTO from "../../dto/Book.dto";
import SeriesDTO from "../../dto/Series.dto.ts";
import UserBookTransactionDTO from "../../dto/UserBookTransaction.dto.ts";
import { useSnackbar } from "notistack";
import useSession, { SessionContextType } from "../../hooks/UseSession.tsx";
import useLanguage from "../../hooks/UseLanguage.tsx";
import { trStatic } from "../../i18n";
import { getSeriesStatusLabel } from "../../dto/Series.dto.ts";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faArrowLeft,
    faBars,
    faBook,
    faHeart,
    faPlus,
    faCheck,
    faCalendarDays,
    faBarcode,
    faRulerCombined,
    faWeightHanging,
    faFileLines,
    faTag,
    faPenNib,
    faPalette,
    faBookBookmark,
    faTags,
    faChevronLeft,
    faChevronRight,
    faChevronDown,
    faBookOpen,
    faBuilding,
    faLayerGroup,
    faBell,
    faBellSlash,
    faXmark,
    faStar,
    faGem,
    faPen,
    faTrash,
    faTrashCan,
    faCoins,
    faCartShopping,
    faStore,
    faNoteSticky,
    faCamera,
    faImage,
    faUpload,
    faLink,
    faPencil,
    faScaleBalanced,
    faBox,
    faGift,
    IconDefinition
} from "@fortawesome/free-solid-svg-icons";
import { Dialog } from "@mui/material";

import "./BookPage.scss";
import Select from "../../components/Select/Select.tsx";
import { WrapperHeader } from "../../components/Wrapper/Wrapper.tsx";
import { detectEditionBadge } from "../../utils/editionBadge.ts";

type FollowType = "series" | "author" | "editor" | "collection";

interface FollowTarget {
    type: FollowType;
    id: number | string;
    name: string;
    roleOrSubtitle?: string;
}

interface MetadataNamedOption {
    id: number;
    name: string;
}

const DEFAULT_BOOK_TYPES = [
    "Bande dessinée",
    "Broché",
    "Cartonné",
    "Comics",
    "E-book",
    "Intégrale",
    "Manga",
    "Poche",
    "Roman",
    "Roman Graphique",
    "Souple"
];

function formatDimensions(length?: number, height?: number, thickness?: number): string | null {
    if (!length && !height && !thickness) return null;

    const toCmString = (val?: number) => {
        if (!val || val <= 0) return null;
        if (val > 30) {
            const cm = val / 10;
            return Number.isInteger(cm) ? `${cm}` : cm.toFixed(1).replace(".", ",");
        }
        return `${val}`;
    };

    const parts = [toCmString(length), toCmString(height), toCmString(thickness)].filter(Boolean);
    if (parts.length === 0) return null;
    return `${parts.join(" × ")} cm`;
}

function SearchableSelect({
    value,
    onChange,
    options,
    placeholder,
    emptyLabel,
    openDirection = "down"
}: {
    value: string;
    onChange: (val: string) => void;
    options: string[];
    placeholder?: string;
    emptyLabel?: string;
    openDirection?: "down" | "up";
}) {
    const { tr } = useLanguage();
    const resolvedEmptyLabel = emptyLabel ?? tr("-- None --", "-- Aucun --");
    const [isOpen, setIsOpen] = useState(false);
    const [isFiltering, setIsFiltering] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setIsFiltering(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const normalizedQuery = isFiltering ? value.trim().toLowerCase() : "";
    const filteredOptions = normalizedQuery
        ? options.filter((opt) => opt.toLowerCase().includes(normalizedQuery))
        : options;

    const isNoneQuery =
        normalizedQuery !== "" &&
        ("aucun".includes(normalizedQuery) ||
            "aucune".includes(normalizedQuery) ||
            "none".includes(normalizedQuery) ||
            resolvedEmptyLabel.toLowerCase().includes(normalizedQuery));

    const showEmptyOption = !isFiltering || normalizedQuery === "" || isNoneQuery;

    const exactMatchExists = options.some(
        (opt) => opt.toLowerCase() === value.trim().toLowerCase()
    ) || ["aucun", "aucune", "none"].includes(value.trim().toLowerCase());

    const handleSelectOption = (opt: string) => {
        onChange(opt);
        setIsOpen(false);
        setIsFiltering(false);
    };

    return (
        <div className="searchable-select" ref={containerRef}>
            <div className={`searchable-select__control ${isOpen ? "searchable-select__control--open" : ""}`}>
                <input
                    type="text"
                    value={value}
                    placeholder={placeholder}
                    onFocus={() => {
                        setIsOpen(true);
                        setIsFiltering(false);
                    }}
                    onClick={() => {
                        if (!isOpen) {
                            setIsOpen(true);
                            setIsFiltering(false);
                        }
                    }}
                    onChange={(e) => {
                        onChange(e.target.value);
                        setIsFiltering(true);
                        setIsOpen(true);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Escape") {
                            setIsOpen(false);
                            setIsFiltering(false);
                        } else if (e.key === "Enter" && isOpen) {
                            e.preventDefault();
                            if (filteredOptions.length === 1) {
                                handleSelectOption(filteredOptions[0]);
                            } else {
                                setIsOpen(false);
                                setIsFiltering(false);
                            }
                        }
                    }}
                />
                <div className="searchable-select__actions">
                    {value && (
                        <button
                            type="button"
                            className="searchable-select__clear-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                onChange("");
                                setIsFiltering(false);
                                setIsOpen(true);
                            }}
                            title={tr("Clear", "Effacer")}
                            aria-label={tr("Clear", "Effacer")}
                        >
                            <FontAwesomeIcon icon={faXmark} />
                        </button>
                    )}
                    <button
                        type="button"
                        className={`searchable-select__toggle-btn ${isOpen ? "searchable-select__toggle-btn--open" : ""}`}
                        onClick={() => {
                            const next = !isOpen;
                            setIsOpen(next);
                            if (next) setIsFiltering(false);
                        }}
                        tabIndex={-1}
                        aria-label={tr("Open list", "Ouvrir la liste")}
                    >
                        <FontAwesomeIcon icon={faChevronDown} />
                    </button>
                </div>
            </div>

            {isOpen && (
                <div className={`searchable-select__menu ${openDirection === "up" ? "searchable-select__menu--up" : ""}`}>
                    {showEmptyOption && (
                        <button
                            type="button"
                            className={`searchable-select__option searchable-select__option--clear ${value.trim() === "" ? "searchable-select__option--selected" : ""}`}
                            onClick={() => handleSelectOption("")}
                        >
                            <span>{resolvedEmptyLabel}</span>
                            {value.trim() === "" && <FontAwesomeIcon icon={faCheck} className="searchable-select__check" />}
                        </button>
                    )}

                    {value.trim() !== "" && !exactMatchExists && (
                        <button
                            type="button"
                            className="searchable-select__option searchable-select__option--create"
                            onClick={() => handleSelectOption(value.trim())}
                        >
                            <FontAwesomeIcon icon={faPlus} />
                            <span>{tr(`Use "${value.trim()}"`, `Utiliser « ${value.trim()} »`)}</span>
                        </button>
                    )}

                    {filteredOptions.length > 0 ? (
                        filteredOptions.map((opt) => {
                            const isSelected = opt.toLowerCase() === value.trim().toLowerCase();
                            return (
                                <button
                                    type="button"
                                    key={opt}
                                    className={`searchable-select__option ${isSelected ? "searchable-select__option--selected" : ""}`}
                                    onClick={() => handleSelectOption(opt)}
                                >
                                    <span>{opt}</span>
                                    {isSelected && <FontAwesomeIcon icon={faCheck} className="searchable-select__check" />}
                                </button>
                            );
                        })
                    ) : (
                        value.trim() === "" && (
                            <div className="searchable-select__empty">{tr("No options available", "Aucune option disponible")}</div>
                        )
                    )}
                </div>
            )}
        </div>
    );
}

function SeriesSearchableSelect({
    selectedId,
    onSelectId,
    seriesList,
    onCreateNew
}: {
    selectedId: number | null;
    onSelectId: (id: number | null) => void;
    seriesList: SeriesDTO[];
    onCreateNew?: (initialName: string) => void;
}) {
    const { tr, translateCategory } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    const [isFiltering, setIsFiltering] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const containerRef = useRef<HTMLDivElement | null>(null);

    const selectedSeries = seriesList.find((s) => Number(s.id) === Number(selectedId)) || null;
    const selectedDisplay = selectedSeries
        ? `${selectedSeries.name} (${translateCategory(selectedSeries.category || "Comics")})`
        : "";

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setIsFiltering(false);
                setSearchQuery("");
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const normalizedQuery = isFiltering ? searchQuery.trim().toLowerCase() : "";
    const filteredSeries = normalizedQuery
        ? seriesList.filter((s) => {
              const label = `${s.name} (${s.category || "Comics"})`.toLowerCase();
              return s.name.toLowerCase().includes(normalizedQuery) || label.includes(normalizedQuery);
          })
        : seriesList;

    const isNoneQuery =
        normalizedQuery !== "" &&
        ("aucun".includes(normalizedQuery) || "aucune".includes(normalizedQuery));

    const showEmptyOption = !isFiltering || normalizedQuery === "" || isNoneQuery;

    const exactMatchExists =
        seriesList.some((s) => s.name.toLowerCase() === normalizedQuery) || isNoneQuery;

    const handleSelect = (id: number | null) => {
        onSelectId(id);
        setIsOpen(false);
        setIsFiltering(false);
        setSearchQuery("");
    };

    return (
        <div className="searchable-select" ref={containerRef}>
            <div className={`searchable-select__control ${isOpen ? "searchable-select__control--open" : ""}`}>
                <input
                    type="text"
                    value={isFiltering ? searchQuery : selectedDisplay}
                    placeholder={tr("Search or select a series...", "Rechercher ou sélectionner une série...")}
                    onFocus={(e) => {
                        setIsOpen(true);
                        setIsFiltering(false);
                        setSearchQuery("");
                        e.currentTarget.select();
                    }}
                    onClick={() => {
                        if (!isOpen) {
                            setIsOpen(true);
                            setIsFiltering(false);
                            setSearchQuery("");
                        }
                    }}
                    onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setIsFiltering(true);
                        setIsOpen(true);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Escape") {
                            setIsOpen(false);
                            setIsFiltering(false);
                            setSearchQuery("");
                        } else if (e.key === "Enter" && isOpen) {
                            e.preventDefault();
                            if (filteredSeries.length === 1) {
                                handleSelect(Number(filteredSeries[0].id));
                            }
                        }
                    }}
                />
                <div className="searchable-select__actions">
                    {(selectedId != null || (isFiltering && searchQuery)) && (
                        <button
                            type="button"
                            className="searchable-select__clear-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelectId(null);
                                setSearchQuery("");
                                setIsFiltering(false);
                                setIsOpen(true);
                            }}
                            title={tr("Clear", "Effacer")}
                            aria-label={tr("Clear", "Effacer")}
                        >
                            <FontAwesomeIcon icon={faXmark} />
                        </button>
                    )}
                    <button
                        type="button"
                        className={`searchable-select__toggle-btn ${isOpen ? "searchable-select__toggle-btn--open" : ""}`}
                        onClick={() => {
                            const next = !isOpen;
                            setIsOpen(next);
                            if (next) {
                                setIsFiltering(false);
                                setSearchQuery("");
                            }
                        }}
                        tabIndex={-1}
                        aria-label={tr("Open series list", "Ouvrir la liste des séries")}
                    >
                        <FontAwesomeIcon icon={faChevronDown} />
                    </button>
                </div>
            </div>

            {isOpen && (
                <div className="searchable-select__menu">
                    {showEmptyOption && (
                        <button
                            type="button"
                            className={`searchable-select__option searchable-select__option--clear ${selectedId == null ? "searchable-select__option--selected" : ""}`}
                            onClick={() => handleSelect(null)}
                        >
                            <span>{tr("-- No series --", "-- Aucune série --")}</span>
                            {selectedId == null && <FontAwesomeIcon icon={faCheck} className="searchable-select__check" />}
                        </button>
                    )}

                    {isFiltering && searchQuery.trim() !== "" && !exactMatchExists && onCreateNew && (
                        <button
                            type="button"
                            className="searchable-select__option searchable-select__option--create"
                            onClick={() => {
                                const name = searchQuery.trim();
                                setIsOpen(false);
                                setIsFiltering(false);
                                setSearchQuery("");
                                onCreateNew(name);
                            }}
                        >
                            <FontAwesomeIcon icon={faPlus} />
                            <span>{tr(`Create new series "${searchQuery.trim()}"`, `Créer la nouvelle série « ${searchQuery.trim()} »`)}</span>
                        </button>
                    )}

                    {filteredSeries.length > 0 ? (
                        filteredSeries.map((s) => {
                            const isSelected = Number(s.id) === Number(selectedId);
                            return (
                                <button
                                    type="button"
                                    key={s.id}
                                    className={`searchable-select__option ${isSelected ? "searchable-select__option--selected" : ""}`}
                                    onClick={() => handleSelect(Number(s.id))}
                                >
                                    <span>
                                        {s.name} <small style={{ color: "var(--text-secondary)" }}>({translateCategory(s.category || "Comics")})</small>
                                    </span>
                                    {isSelected && <FontAwesomeIcon icon={faCheck} className="searchable-select__check" />}
                                </button>
                            );
                        })
                    ) : (
                        <div className="searchable-select__empty">{tr("No series found", "Aucune série trouvée")}</div>
                    )}
                </div>
            )}
        </div>
    );
}

function getFollowTypeIcon(type: FollowType) {
    switch (type) {
        case "series": return faBook;
        case "author": return faPenNib;
        case "editor": return faBuilding;
        case "collection": return faLayerGroup;
    }
}

function getFollowTypeLabel(type: FollowType) {
    switch (type) {
        case "series": return trStatic("Series", "Série");
        case "author": return trStatic("Author", "Auteur");
        case "editor": return trStatic("Publisher", "Maison d'édition");
        case "collection": return trStatic("Collection", "Collection");
    }
}

function ChangeBookStatusButton({
    status,
    setStatus,
    newStatus,
    children,
    bookId,
    session,
    icon,
    onRequestSale
}: {
    status: string | null;
    setStatus: (s: string | null) => void;
    newStatus: string;
    children: ReactNode;
    bookId?: string;
    session?: SessionContextType;
    icon?: IconDefinition;
    onRequestSale?: () => void;
}) {
    const [processing, setProcessing] = useState(false);
    const isCurrent = status === newStatus;

    const handleClick = async () => {
        if (!newStatus || !bookId || !session || processing) return;
        if (newStatus === "FOR_SALE" && !isCurrent && onRequestSale) {
            onRequestSale();
            return;
        }
        setProcessing(true);
        try {
            if (isCurrent) {
                if (newStatus === "FOR_SALE") {
                    // Retirer de la vente -> retourne dans nos albums (OWNED)
                    const url = `/user/sales/${encodeURIComponent(bookId)}`;
                    const response = await session.customFetch(url, { method: "DELETE" });
                    if (response.ok) setStatus("OWNED");
                } else {
                    // Retirer le livre
                    const url = `/user/removeBook/${encodeURIComponent(bookId)}`;
                    const response = await session.customFetch(url, { method: "DELETE" });
                    if (response.ok) setStatus(null);
                }
            } else {
                // Ajouter / changer le statut
                const url = `/user/addBook/${encodeURIComponent(bookId)}/${encodeURIComponent(newStatus)}`;
                const response = await session.customFetch(url, { method: "POST" });
                if (response.ok) setStatus(newStatus);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <button
            type="button"
            className={`book-action-btn ${isCurrent ? 'book-action-btn--active' : ''}`}
            onClick={handleClick}
            disabled={processing}
        >
            <FontAwesomeIcon icon={isCurrent ? faCheck : (icon || faPlus)} />
            <span>{children}</span>
        </button>
    );
}

export default function BookPage() {
    const { id } = useParams<{ id?: string }>();
    const navigate = useNavigate();
    const session = useSession();
    const { tr, locale, translateCategory } = useLanguage();

    const [book, setBook] = useState<BookDTO | null>(null);
    const editionBadge = detectEditionBadge(book);
    const [bookStatus, setBookStatus] = useState<string | null>(null);
    const [readingStatus, setReadingStatus] = useState<string>("UNREAD");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Purchase & Sales Transactions History
    const [transactions, setTransactions] = useState<UserBookTransactionDTO[]>([]);
    const [loadingTransactions, setLoadingTransactions] = useState(false);

    // Details column hamburger dropdown
    const [detailsMenuOpen, setDetailsMenuOpen] = useState(false);
    const detailsMenuRef = useRef<HTMLDivElement | null>(null);

    // Transaction modals
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
    const [saleModalOpen, setSaleModalOpen] = useState(false);
    const [listingModalOpen, setListingModalOpen] = useState(false);
    const [submittingTx, setSubmittingTx] = useState(false);
    const [submittingListing, setSubmittingListing] = useState(false);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (detailsMenuRef.current && !detailsMenuRef.current.contains(event.target as Node)) {
                setDetailsMenuOpen(false);
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setDetailsMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, []);

    // Buy / Gift modal form
    const [buyType, setBuyType] = useState<"BOUGHT" | "GIFT">("BOUGHT");
    const [buyDate, setBuyDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
    const [giftDatePrecision, setGiftDatePrecision] = useState<"NONE" | "YEAR" | "MONTH" | "DAY">("NONE");
    const [giftYear, setGiftYear] = useState<string>(() => String(new Date().getFullYear()));
    const [giftMonth, setGiftMonth] = useState<string>(() => String(new Date().getMonth() + 1).padStart(2, "0"));
    const [buyPrice, setBuyPrice] = useState<string>("");
    const [buyLocation, setBuyLocation] = useState<string>("");
    const [buyMemo, setBuyMemo] = useState<string>("");

    // Sale modal form
    const [sellDate, setSellDate] = useState<string>("");
    const [sellPrice, setSellPrice] = useState<string>("");
    const [sellLocation, setSellLocation] = useState<string>("");
    const [sellMemo, setSellMemo] = useState<string>("");
    const [listingPrice, setListingPrice] = useState<string>("");
    const [listingUrl, setListingUrl] = useState<string>("");

    const fetchTransactions = (bookId: string) => {
        setLoadingTransactions(true);
        session.customFetch(`/user/books/${encodeURIComponent(bookId)}/transactions`, { method: "GET" })
            .then(async (res) => {
                if (res.ok) {
                    const data: UserBookTransactionDTO[] = await res.json();
                    setTransactions(data);
                } else {
                    setTransactions([]);
                }
            })
            .catch(() => setTransactions([]))
            .finally(() => setLoadingTransactions(false));
    };

    const handleOpenPurchaseModal = (initialType: "BOUGHT" | "GIFT" = "BOUGHT") => {
        const now = new Date();
        setBuyType(initialType);
        setBuyDate(now.toISOString().split("T")[0]);
        setGiftDatePrecision("NONE");
        setGiftYear(String(now.getFullYear()));
        setGiftMonth(String(now.getMonth() + 1).padStart(2, "0"));
        setBuyPrice(initialType === "GIFT" ? "" : (book?.price ? String(book.price) : ""));
        setBuyLocation("");
        setBuyMemo("");
        setPurchaseModalOpen(true);
    };

    const formatTransactionDate = (tx: UserBookTransactionDTO): string => {
        if (!tx.date) {
            return tr("Date not specified", "Date non renseignée");
        }
        if (tx.datePrecision === "YEAR" || /^\d{4}$/.test(tx.date)) {
            return tx.date.slice(0, 4);
        }
        if (tx.datePrecision === "MONTH" || /^\d{4}-\d{2}$/.test(tx.date)) {
            const [y, m] = tx.date.split("-");
            const d = new Date(Number(y), Number(m) - 1, 1);
            if (!Number.isNaN(d.getTime())) {
                return d.toLocaleDateString(locale, { month: "short", year: "numeric" });
            }
            return tx.date;
        }
        const d = new Date(tx.date + "T00:00:00");
        if (!Number.isNaN(d.getTime())) {
            return d.toLocaleDateString(locale, {
                day: "numeric",
                month: "short",
                year: "numeric"
            });
        }
        return tx.date;
    };

    const handleSavePurchase = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id || submittingTx) return;

        const isGift = buyType === "GIFT";
        let resolvedDate: string | null = buyDate;
        let resolvedPrecision: "NONE" | "YEAR" | "MONTH" | "DAY" = "DAY";

        if (isGift) {
            resolvedPrecision = giftDatePrecision;
            if (giftDatePrecision === "NONE") {
                resolvedDate = null;
            } else if (giftDatePrecision === "YEAR") {
                const parsedYear = parseInt(giftYear, 10);
                if (!Number.isFinite(parsedYear) || parsedYear < 1 || parsedYear > 9999) {
                    enqueueSnackbar(tr("Please enter a valid year", "Veuillez saisir une année valide"), { variant: "error" });
                    return;
                }
                resolvedDate = String(parsedYear).padStart(4, "0");
            } else if (giftDatePrecision === "MONTH") {
                const parsedYear = parseInt(giftYear, 10);
                if (!Number.isFinite(parsedYear) || parsedYear < 1 || parsedYear > 9999 || !giftMonth) {
                    enqueueSnackbar(tr("Please enter a valid month and year", "Veuillez saisir un mois et une année valides"), { variant: "error" });
                    return;
                }
                resolvedDate = `${String(parsedYear).padStart(4, "0")}-${giftMonth}`;
            } else {
                resolvedDate = buyDate || null;
            }
        }

        setSubmittingTx(true);
        try {
            const parsedPrice = !isGift && buyPrice ? parseFloat(buyPrice) : null;
            const res = await session.customFetch(`/user/books/${encodeURIComponent(id)}/transactions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: buyType,
                    date: resolvedDate,
                    datePrecision: resolvedPrecision,
                    price: parsedPrice,
                    location: buyLocation.trim() || null,
                    memo: buyMemo.trim() || null
                })
            });

            if (res.ok) {
                enqueueSnackbar(isGift ? tr("Gift saved successfully!", "Cadeau enregistré avec succès !") : tr("Purchase saved successfully!", "Achat enregistré avec succès !"), { variant: "success" });
                setPurchaseModalOpen(false);
                fetchTransactions(id);
                if (bookStatus !== "OWNED" && bookStatus !== "FOR_SALE" && bookStatus !== "SOLD") {
                    setBookStatus("OWNED");
                }
            } else {
                enqueueSnackbar(isGift ? tr("Error saving gift", "Erreur lors de l'enregistrement du cadeau") : tr("Error saving purchase", "Erreur lors de l'enregistrement de l'achat"), { variant: "error" });
            }
        } catch (err: any) {
            enqueueSnackbar(`Erreur: ${err.message}`, { variant: "error" });
        } finally {
            setSubmittingTx(false);
        }
    };

    const handleOpenSaleModal = () => {
        setSellDate("");
        setSellPrice(book?.price ? String(book.price) : "");
        setSellLocation("");
        setSellMemo("");
        setSaleModalOpen(true);
    };

    const handleOpenListingModal = () => {
        setListingPrice(book?.price ? String(book.price) : "");
        setListingUrl("");
        setListingModalOpen(true);
    };

    const handleSaveListing = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id || submittingListing) return;

        setSubmittingListing(true);
        try {
            const parsedPrice = listingPrice.trim() ? parseFloat(listingPrice) : null;
            const res = await session.customFetch(`/user/addBook/${encodeURIComponent(id)}/FOR_SALE`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    price: parsedPrice,
                    listingUrl: listingUrl.trim() || null
                })
            });

            if (res.ok) {
                enqueueSnackbar(tr("Book listed for sale successfully!", "Livre mis en vente avec succès !"), { variant: "success" });
                setListingModalOpen(false);
                setBookStatus("FOR_SALE");
            } else {
                let errMsg = tr("Error listing book for sale", "Erreur lors de la mise en vente");
                try {
                    const errData = await res.json();
                    errMsg = errData.message || errData.error || errMsg;
                } catch {
                    const text = await res.text().catch(() => "");
                    if (text) errMsg = text;
                }
                enqueueSnackbar(errMsg, { variant: "error" });
            }
        } catch (err: any) {
            enqueueSnackbar(`Erreur: ${err.message}`, { variant: "error" });
        } finally {
            setSubmittingListing(false);
        }
    };

    const handleSaveSale = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id || submittingTx) return;

        setSubmittingTx(true);
        try {
            const parsedPrice = sellPrice ? parseFloat(sellPrice) : null;
            const res = await session.customFetch(`/user/books/${encodeURIComponent(id)}/transactions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "SOLD",
                    date: sellDate.trim() || null,
                    price: parsedPrice,
                    location: sellLocation.trim() || null,
                    memo: sellMemo.trim() || null
                })
            });

            if (res.ok) {
                enqueueSnackbar(tr("Sale saved successfully!", "Vente enregistrée avec succès !"), { variant: "success" });
                setSaleModalOpen(false);
                setBookStatus("SOLD");
                fetchTransactions(id);
            } else {
                let errMsg = tr("Error saving sale", "Erreur lors de l'enregistrement de la vente");
                try {
                    const errData = await res.json();
                    errMsg = errData.message || errData.error || errMsg;
                } catch {
                    const text = await res.text().catch(() => "");
                    if (text) errMsg = text;
                }
                enqueueSnackbar(errMsg, { variant: "error" });
            }
        } catch (err: any) {
            enqueueSnackbar(`Erreur: ${err.message}`, { variant: "error" });
        } finally {
            setSubmittingTx(false);
        }
    };

    const handleDeleteTransaction = async (txId: number) => {
        const confirm = window.confirm(tr("Delete this history entry?", "Supprimer cette ligne d'historique ?"));
        if (!confirm || !id) return;

        try {
            const res = await session.customFetch(`/user/transactions/${txId}`, { method: "DELETE" });
            if (res.ok) {
                enqueueSnackbar(tr("Entry deleted", "Ligne supprimée"), { variant: "info" });
                fetchTransactions(id);
            } else {
                enqueueSnackbar(tr("Error deleting entry", "Erreur lors de la suppression"), { variant: "error" });
            }
        } catch (err: any) {
            enqueueSnackbar(`Erreur: ${err.message}`, { variant: "error" });
        }
    };

    // Follow system states
    const [followStates, setFollowStates] = useState<Record<string, boolean>>({});
    const [followModalTarget, setFollowModalTarget] = useState<FollowTarget | null>(null);
    const [followProcessing, setFollowProcessing] = useState(false);
    const { enqueueSnackbar } = useSnackbar();

    // Cover update modal states
    const [coverModalOpen, setCoverModalOpen] = useState(false);
    const [coverMode, setCoverMode] = useState<"file" | "url">("file");
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
    const [coverRemoteUrl, setCoverRemoteUrl] = useState<string>("");
    const [uploadingCover, setUploadingCover] = useState(false);
    const [isDraggingCover, setIsDraggingCover] = useState(false);
    const coverInputRef = useRef<HTMLInputElement | null>(null);

    // Book Info Edit Modal states
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [savingBookInfo, setSavingBookInfo] = useState(false);
    const [editTitle, setEditTitle] = useState("");
    const [editReleaseDate, setEditReleaseDate] = useState<string>("");
    const [editIsbn, setEditIsbn] = useState<string>("");
    const [editPrice, setEditPrice] = useState<string>("");
    const [editPageCount, setEditPageCount] = useState<string>("");
    const [editWeight, setEditWeight] = useState<string>("");
    const [editLength, setEditLength] = useState<string>("");
    const [editHeight, setEditHeight] = useState<string>("");
    const [editThickness, setEditThickness] = useState<string>("");
    const [editType, setEditType] = useState<string>("");
    const [editEditorName, setEditEditorName] = useState<string>("");
    const [editCollectionName, setEditCollectionName] = useState<string>("");

    // Autocomplete metadata options
    const [editorOptions, setEditorOptions] = useState<MetadataNamedOption[]>([]);
    const [collectionOptions, setCollectionOptions] = useState<MetadataNamedOption[]>([]);
    const [typeOptions, setTypeOptions] = useState<string[]>(DEFAULT_BOOK_TYPES);

    // Series Association Dialog state
    const [seriesModalOpen, setSeriesModalOpen] = useState(false);
    const [seriesListOptions, setSeriesListOptions] = useState<SeriesDTO[]>([]);
    const [selectedSeriesId, setSelectedSeriesId] = useState<number | null>(null);
    const [selectedVolume, setSelectedVolume] = useState<number>(1);
    const [seriesModalMode, setSeriesModalMode] = useState<"select" | "create">("select");
    const [newSeriesName, setNewSeriesName] = useState("");
    const [newSeriesCategory, setNewSeriesCategory] = useState<number>(3);
    const [newSeriesStatus, setNewSeriesStatus] = useState("ON_GOING");
    const [savingSeries, setSavingSeries] = useState(false);

    useEffect(() => {
        return () => {
            if (coverPreviewUrl && coverPreviewUrl.startsWith("blob:")) {
                URL.revokeObjectURL(coverPreviewUrl);
            }
        };
    }, [coverPreviewUrl]);

    const handleOpenEditModal = async () => {
        if (!book) return;
        setEditTitle(book.title || "");
        setEditReleaseDate(book.releaseDate ? book.releaseDate.substring(0, 10) : "");
        setEditIsbn(book.isbn || "");
        setEditPrice(book.price != null && book.price > 0 ? String(book.price) : "");
        setEditPageCount(book.pageCount != null && book.pageCount > 0 ? String(book.pageCount) : "");
        setEditWeight(book.weight != null && book.weight > 0 ? String(book.weight) : "");
        setEditLength(book.length != null && book.length > 0 ? String(book.length) : "");
        setEditHeight(book.height != null && book.height > 0 ? String(book.height) : "");
        setEditThickness(book.thickness != null && book.thickness > 0 ? String(book.thickness) : "");
        setEditType(book.type || "");
        setEditEditorName(book.editor?.name || "");
        setEditCollectionName(book.collection?.name || "");
        setEditModalOpen(true);

        try {
            const res = await session.customFetch("/books/metadata-options", { method: "GET" });
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data.editors)) setEditorOptions(data.editors);
                if (Array.isArray(data.collections)) setCollectionOptions(data.collections);
                if (Array.isArray(data.types) && data.types.length > 0) setTypeOptions(data.types);
            }
        } catch (err) {
            console.error("Error loading metadata options:", err);
        }
    };

    const handleSaveBookInfo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id || savingBookInfo) return;

        if (!editTitle.trim()) {
            enqueueSnackbar(tr("Book title is required", "Le titre de l'album est obligatoire"), { variant: "warning" });
            return;
        }

        setSavingBookInfo(true);
        try {
            const payload = {
                title: editTitle.trim(),
                isbn: editIsbn.trim(),
                releaseDate: editReleaseDate || "",
                price: editPrice.trim() !== "" ? Math.round(parseFloat(editPrice)) : 0,
                pageCount: editPageCount.trim() !== "" ? parseInt(editPageCount, 10) : 0,
                weight: editWeight.trim() !== "" ? parseInt(editWeight, 10) : 0,
                length: editLength.trim() !== "" ? parseInt(editLength, 10) : 0,
                height: editHeight.trim() !== "" ? parseInt(editHeight, 10) : 0,
                thickness: editThickness.trim() !== "" ? parseInt(editThickness, 10) : 0,
                type: editType.trim(),
                editorName: editEditorName.trim(),
                collectionName: editCollectionName.trim()
            };

            const res = await session.customFetch(`/books/${encodeURIComponent(id)}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const updated: BookDTO = await res.json();
                setBook(updated);
                setEditModalOpen(false);
                enqueueSnackbar(tr("Book information updated successfully!", "Informations de l'album mises à jour avec succès !"), { variant: "success" });
            } else {
                let errMsg = tr("Unable to update book information", "Impossible de mettre à jour les informations de l'album");
                try {
                    const errData = await res.json();
                    errMsg = errData.message || errData.error || errMsg;
                } catch {
                    const text = await res.text().catch(() => "");
                    if (text) errMsg = text;
                }
                enqueueSnackbar(`Erreur : ${errMsg}`, { variant: "error" });
            }
        } catch (err: any) {
            enqueueSnackbar(`Erreur réseau : ${err.message}`, { variant: "error" });
        } finally {
            setSavingBookInfo(false);
        }
    };

    const handleOpenCoverModal = () => {
        setCoverMode("file");
        setCoverFile(null);
        if (coverPreviewUrl && coverPreviewUrl.startsWith("blob:")) {
            URL.revokeObjectURL(coverPreviewUrl);
        }
        setCoverPreviewUrl(null);
        setCoverRemoteUrl("");
        setIsDraggingCover(false);
        setCoverModalOpen(true);
    };

    const handleCloseCoverModal = () => {
        if (uploadingCover) return;
        if (coverPreviewUrl && coverPreviewUrl.startsWith("blob:")) {
            URL.revokeObjectURL(coverPreviewUrl);
        }
        setCoverPreviewUrl(null);
        setCoverFile(null);
        setCoverRemoteUrl("");
        setCoverModalOpen(false);
    };

    const handleSelectCoverFile = (file: File | null) => {
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            enqueueSnackbar(tr("Please select a valid image file (JPG, PNG, WebP...)", "Veuillez sélectionner un fichier image valide (JPG, PNG, WebP...)"), { variant: "warning" });
            return;
        }
        if (coverPreviewUrl && coverPreviewUrl.startsWith("blob:")) {
            URL.revokeObjectURL(coverPreviewUrl);
        }
        setCoverFile(file);
        setCoverPreviewUrl(URL.createObjectURL(file));
    };

    const handleSaveCover = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id || uploadingCover) return;

        if (coverMode === "file" && !coverFile) {
            enqueueSnackbar(tr("Please select an image from your device", "Veuillez sélectionner une image depuis votre appareil"), { variant: "warning" });
            return;
        }
        if (coverMode === "url" && !coverRemoteUrl.trim()) {
            enqueueSnackbar(tr("Please enter an image URL", "Veuillez saisir l'URL d'une image"), { variant: "warning" });
            return;
        }

        setUploadingCover(true);
        try {
            let response: Response;
            if (coverMode === "file" && coverFile) {
                const formData = new FormData();
                formData.append("file", coverFile);
                response = await session.customFetch(`/books/${encodeURIComponent(id)}/cover`, {
                    method: "POST",
                    body: formData
                });
            } else {
                response = await session.customFetch(`/books/${encodeURIComponent(id)}/cover`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ url: coverRemoteUrl.trim() })
                });
            }

            if (response.ok) {
                const updatedBook: BookDTO = await response.json();
                setBook(updatedBook);
                enqueueSnackbar(tr("Cover updated and optimized!", "Couverture mise à jour et optimisée !"), { variant: "success" });
                setCoverModalOpen(false);
                if (coverPreviewUrl && coverPreviewUrl.startsWith("blob:")) {
                    URL.revokeObjectURL(coverPreviewUrl);
                }
                setCoverPreviewUrl(null);
                setCoverFile(null);
                setCoverRemoteUrl("");
            } else {
                let errMsg = tr("Unable to update cover", "Impossible de mettre à jour la couverture");
                try {
                    const errData = await response.json();
                    errMsg = errData.message || errData.error || errMsg;
                } catch {
                    const text = await response.text().catch(() => "");
                    if (text) errMsg = text;
                }
                enqueueSnackbar(`Erreur : ${errMsg}`, { variant: "error" });
            }
        } catch (err: any) {
            enqueueSnackbar(`Erreur réseau : ${err.message}`, { variant: "error" });
        } finally {
            setUploadingCover(false);
        }
    };

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
        if (!id) return;

        setLoading(true);
        setError(null);
        setBook(null);
        setBookStatus(null);
        setReadingStatus("UNREAD");
        fetchTransactions(id);

        const fetchUrl = `/books/${encodeURIComponent(id)}?withCollection=1&withEditor=1&withAuthors=1&withStatus=1&withSeries=1`;
        session.customFetch(fetchUrl, {
            method: "GET",
        }).then(async (response) => {
            if (response.ok) {
                const data: BookDTO = await response.json();
                setBook(data);
                setBookStatus(data.status);
                setReadingStatus(data.readingStatus || "UNREAD");

                // Fetch batch follow status
                const params = new URLSearchParams();
                if (data.series?.id) params.set("seriesId", String(data.series.id));
                if (data.editor?.id) params.set("editorId", String(data.editor.id));
                if (data.collection?.id) params.set("collectionId", String(data.collection.id));
                if (data.authors && data.authors.length > 0) {
                    const aIds = data.authors.map((a) => a.id).filter(Boolean);
                    if (aIds.length > 0) params.set("authorIds", aIds.join(","));
                }

                session.customFetch(`/user/follows/batch?${params.toString()}`, { method: "GET" })
                    .then(async (followRes) => {
                        if (followRes.ok) {
                            const batch = await followRes.json();
                            const newStates: Record<string, boolean> = {};
                            if (data.series?.id && batch.series !== undefined) {
                                newStates[`series_${data.series.id}`] = Boolean(batch.series);
                            }
                            if (data.editor?.id && batch.editor !== undefined) {
                                newStates[`editor_${data.editor.id}`] = Boolean(batch.editor);
                            }
                            if (data.collection?.id && batch.collection !== undefined) {
                                newStates[`collection_${data.collection.id}`] = Boolean(batch.collection);
                            }
                            if (batch.authors) {
                                Object.entries(batch.authors).forEach(([aId, followed]) => {
                                    newStates[`author_${aId}`] = Boolean(followed);
                                });
                            }
                            setFollowStates(newStates);
                        }
                    })
                    .catch((err) => {
                        console.error("Batch follow status error:", err);
                    });
            } else {
                const errorText = await response.text();
                setError(`Erreur ${response.status}: ${errorText}`);
            }
        }).catch((err) => {
            setError(`Erreur de connexion: ${err.message}`);
        }).finally(() => {
            setLoading(false);
        });
    }, [id, session]);

    const handleOpenSeriesModal = async () => {
        setSelectedSeriesId(book?.series?.id ? Number(book.series.id) : null);
        setSelectedVolume(book?.series && book?.volume != null ? book.volume : 1);
        setSeriesModalMode("select");
        setNewSeriesName("");
        setNewSeriesCategory(3);
        setNewSeriesStatus("ON_GOING");
        setSeriesModalOpen(true);

        try {
            const res = await session.customFetch("/series", { method: "GET" });
            if (res.ok) {
                const list: SeriesDTO[] = await res.json();
                setSeriesListOptions(list);
            }
        } catch (err) {
            console.error("Error fetching series list:", err);
        }
    };

    const handleSaveSeriesAssociation = async () => {
        if (!id || savingSeries) return;
        setSavingSeries(true);

        try {
            if (seriesModalMode === "create") {
                if (!newSeriesName.trim()) {
                    enqueueSnackbar(tr("Please enter the series name", "Veuillez renseigner le nom de la série"), { variant: "warning" });
                    setSavingSeries(false);
                    return;
                }

                // 1. Create series
                const createRes = await session.customFetch("/series", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: newSeriesName.trim(),
                        categoryId: newSeriesCategory,
                        status: newSeriesStatus,
                        bookIds: [Number(id)]
                    })
                });

                if (!createRes.ok) {
                    const errText = await createRes.text();
                    enqueueSnackbar(`Erreur: ${errText}`, { variant: "error" });
                    setSavingSeries(false);
                    return;
                }

                const createdSeries: SeriesDTO = await createRes.json();

                // 2. Set volume in the new series
                if (selectedVolume != null) {
                    await session.customFetch(`/books/${encodeURIComponent(id)}/series`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ seriesId: createdSeries.id, volume: selectedVolume })
                    });
                }

                enqueueSnackbar(tr(`New series "${createdSeries.name}" created and linked`, `Nouvelle série « ${createdSeries.name} » créée et associée`), { variant: "success" });
            } else {
                // Link to existing series (or unlink if selectedSeriesId is null)
                const updateRes = await session.customFetch(`/books/${encodeURIComponent(id)}/series`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        seriesId: selectedSeriesId,
                        volume: selectedSeriesId ? selectedVolume : null
                    })
                });

                if (!updateRes.ok) {
                    enqueueSnackbar(tr("Error linking to series", "Erreur lors de l'association à la série"), { variant: "error" });
                    setSavingSeries(false);
                    return;
                }

                enqueueSnackbar(selectedSeriesId ? tr("Series and volume linked successfully", "Série et tomaison associées avec succès") : tr("Series unlinked", "Série dissociée"), { variant: "success" });
            }

            // Reload book
            const fetchUrl = `/books/${encodeURIComponent(id)}?withCollection=1&withEditor=1&withAuthors=1&withStatus=1&withSeries=1`;
            const refreshRes = await session.customFetch(fetchUrl, { method: "GET" });
            if (refreshRes.ok) {
                const refreshedBook: BookDTO = await refreshRes.json();
                setBook(refreshedBook);
            }
            setSeriesModalOpen(false);
        } catch (err: any) {
            enqueueSnackbar(`Erreur: ${err.message}`, { variant: "error" });
        } finally {
            setSavingSeries(false);
        }
    };

    const [deletingBook, setDeletingBook] = useState(false);

    const handleDeleteBook = async () => {
        if (!book || !id) return;
        const confirm = window.confirm(
            tr(
                `Are you sure you want to permanently delete the book "${book.title}"? This action cannot be undone.`,
                `Êtes-vous sûr de vouloir supprimer définitivement l'album « ${book.title} » ? Cette action est irréversible.`
            )
        );
        if (!confirm) return;

        setDeletingBook(true);
        try {
            const res = await session.customFetch(`/books/${encodeURIComponent(id)}`, {
                method: "DELETE"
            });
            if (res.ok) {
                enqueueSnackbar(tr(`Book "${book.title}" deleted successfully`, `Album « ${book.title} » supprimé avec succès`), { variant: "success" });
                navigate("/app/collection");
            } else {
                enqueueSnackbar(tr("Error deleting book", "Erreur lors de la suppression de l'album"), { variant: "error" });
            }
        } catch (err) {
            console.error("Error deleting book:", err);
            enqueueSnackbar(tr("Network error while deleting book", "Erreur réseau lors de la suppression de l'album"), { variant: "error" });
        } finally {
            setDeletingBook(false);
        }
    };

    const handleRemoveFromSeries = async () => {
        if (!id || savingSeries) return;
        const confirm = window.confirm(tr("Remove this book from its series?", "Retirer cet album de sa série ?"));
        if (!confirm) return;

        setSavingSeries(true);
        try {
            const updateRes = await session.customFetch(`/books/${encodeURIComponent(id)}/series`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ seriesId: null, volume: null })
            });

            if (updateRes.ok) {
                enqueueSnackbar(tr("Book removed from series", "Album retiré de la série"), { variant: "info" });
                const fetchUrl = `/books/${encodeURIComponent(id)}?withCollection=1&withEditor=1&withAuthors=1&withStatus=1&withSeries=1`;
                const refreshRes = await session.customFetch(fetchUrl, { method: "GET" });
                if (refreshRes.ok) {
                    const refreshedBook: BookDTO = await refreshRes.json();
                    setBook(refreshedBook);
                }
                setSeriesModalOpen(false);
            }
        } catch (err: any) {
            enqueueSnackbar(`Erreur: ${err.message}`, { variant: "error" });
        } finally {
            setSavingSeries(false);
        }
    };

    const openFollowModal = (type: FollowType, targetId?: number | string | null, name?: string, roleOrSubtitle?: string) => {
        if (!targetId || !name) return;
        setFollowModalTarget({ type, id: targetId, name, roleOrSubtitle });
    };

    const handleToggleFollow = async () => {
        if (!followModalTarget || !followModalTarget.id || followProcessing) return;
        const { type, id: targetId } = followModalTarget;
        const key = `${type}_${targetId}`;
        const currentlyFollowing = Boolean(followStates[key]);
        const newState = !currentlyFollowing;

        setFollowProcessing(true);
        // Optimistic update
        setFollowStates(prev => ({ ...prev, [key]: newState }));

        try {
            const res = await session.customFetch(`/user/follows/${type}/${targetId}/toggle`, {
                method: "POST"
            });
            if (res.ok) {
                const data = await res.json();
                setFollowStates(prev => ({ ...prev, [key]: Boolean(data.following) }));
            } else {
                // Revert
                setFollowStates(prev => ({ ...prev, [key]: currentlyFollowing }));
            }
        } catch (err) {
            console.error("Toggle follow error:", err);
            setFollowStates(prev => ({ ...prev, [key]: currentlyFollowing }));
        } finally {
            setFollowProcessing(false);
        }
    };

    // Author categorization & deduplication helper
    const totalBought = transactions
        .filter((t) => t.type === "BOUGHT" && t.price != null)
        .reduce((sum, t) => sum + Number(t.price || 0), 0);
    const totalSold = transactions
        .filter((t) => t.type === "SOLD" && t.price != null)
        .reduce((sum, t) => sum + Number(t.price || 0), 0);
    const hasBought = transactions.some((t) => t.type === "BOUGHT");
    const hasGift = transactions.some((t) => t.type === "GIFT");
    const giftCount = transactions.filter((t) => t.type === "GIFT").length;
    const hasSold = transactions.some((t) => t.type === "SOLD");

    const allAuthors = book?.authors || [];
    const dessinateurs = allAuthors.filter(
        (a) => a.type && (a.type.toLowerCase() === "illustrator" || a.type.toLowerCase().includes("dessin") || a.type.toLowerCase().includes("pencil") || a.type.toLowerCase().includes("artist"))
    );
    const coloristes = allAuthors.filter(
        (a) => a.type && (a.type.toLowerCase() === "colorist" || a.type.toLowerCase().includes("color") || a.type.toLowerCase().includes("couleur"))
    );
    const scenaristes = allAuthors.filter(
        (a) => !dessinateurs.includes(a) && !coloristes.includes(a)
    );

    const totalVolumes = book?.series?.totalVolumes && book.series.totalVolumes > 0
        ? book.series.totalVolumes
        : null;

    const hasPrevious = Boolean(book?.previousBookId);
    const canHavePrevious = Boolean(book?.series && book?.volume != null && book.volume > 1);
    const showPrevious = hasPrevious || canHavePrevious;

    const hasNext = Boolean(book?.nextBookId);
    const canHaveNext = Boolean(
        book?.series && book?.volume != null && totalVolumes != null && book.volume < totalVolumes
    );
    const showNext = hasNext || canHaveNext;

    const handleReadingStatusChange = async (newStatus: string) => {
        if (!id || !session) return;
        try {
            if (!newStatus) {
                const response = await session.customFetch(`/user/readingStatus/${encodeURIComponent(id)}`, {
                    method: "DELETE"
                });
                if (response.ok) {
                    setReadingStatus("UNREAD");
                    fetchTransactions(id);
                }
            } else {
                const response = await session.customFetch(`/user/readingStatus/${encodeURIComponent(id)}/${encodeURIComponent(newStatus)}`, {
                    method: "POST"
                });
                if (response.ok) {
                    setReadingStatus(newStatus);
                }
            }
        } catch (err) {
            console.error("Reading status update error:", err);
        }
    };

    const currentCoverPreview = coverMode === "file"
        ? coverPreviewUrl
        : (coverRemoteUrl.trim().startsWith("http") ? coverRemoteUrl.trim() : null);

    return (
        <div className="book-page">
            <WrapperHeader>
                <div className="book-page__header-nav">
                    <button
                        type="button"
                        className="book-page__back-link"
                        onClick={() => navigate(-1)}
                    >
                        <FontAwesomeIcon icon={faArrowLeft} />
                        <span>{tr("Back", "Retour")}</span>
                    </button>
                </div>
            </WrapperHeader>

            <div className="book-page__content">
                {loading && (
                    <div className="book-page__state">
                        <p>{tr("Loading book details...", "Chargement des détails de l'ouvrage...")}</p>
                    </div>
                )}

                {error && (
                    <div className="book-page__state book-page__state--error">
                        <p>{error}</p>
                    </div>
                )}

                {book && (
                    <div className="book-page__grid">
                        {/* Left column: Cover & Tome Navigation */}
                        <div className="book-page__cover-col">
                            <div className="book-page__cover-wrapper">
                                {book.coverUrl ? (
                                    <img
                                        src={book.coverUrl}
                                        alt={tr(`Cover of ${book.title}`, `Couverture de ${book.title}`)}
                                        className="book-page__cover"
                                        decoding="async"
                                    />
                                ) : (
                                    <div className="book-page__cover-fallback">
                                        <FontAwesomeIcon icon={faBook} />
                                        <span>{book.title}</span>
                                    </div>
                                )}
                                <button
                                    type="button"
                                    className="book-page__cover-edit-btn"
                                    onClick={handleOpenCoverModal}
                                    title={tr("Change this book's cover image", "Changer l'image de couverture de cet album")}
                                >
                                    <FontAwesomeIcon icon={faCamera} />
                                    <span>{tr("Change cover", "Changer l'image")}</span>
                                </button>
                            </div>

                            {/* Navigation précédent / suivant le tome dans la série */}
                            {(showPrevious || showNext) && (
                                <div className="book-page__volume-nav">
                                    {showPrevious && (
                                        hasPrevious ? (
                                            <Link
                                                to={`/app/book/${book.previousBookId}`}
                                                className="book-page__volume-nav-btn book-page__volume-nav-btn--prev"
                                                title={book.previousBook?.title ? tr(`Previous volume: ${book.previousBook.title}`, `Tome précédent : ${book.previousBook.title}`) : tr("Previous volume", "Tome précédent")}
                                            >
                                                <FontAwesomeIcon icon={faChevronLeft} />
                                                <span>{tr("Previous", "Précédent")}</span>
                                            </Link>
                                        ) : (
                                            <button
                                                type="button"
                                                disabled
                                                className="book-page__volume-nav-btn book-page__volume-nav-btn--disabled book-page__volume-nav-btn--prev"
                                                title={tr("Previous volume not available in library", "Tome précédent non disponible dans la bibliothèque")}
                                            >
                                                <FontAwesomeIcon icon={faChevronLeft} />
                                                <span>{tr("Previous", "Précédent")}</span>
                                            </button>
                                        )
                                    )}
                                    {showNext && (
                                        hasNext ? (
                                            <Link
                                                to={`/app/book/${book.nextBookId}`}
                                                className="book-page__volume-nav-btn book-page__volume-nav-btn--next"
                                                title={book.nextBook?.title ? tr(`Next volume: ${book.nextBook.title}`, `Tome suivant : ${book.nextBook.title}`) : tr("Next volume", "Tome suivant")}
                                            >
                                                <span>{tr("Next", "Suivant")}</span>
                                                <FontAwesomeIcon icon={faChevronRight} />
                                            </Link>
                                        ) : (
                                            <button
                                                type="button"
                                                disabled
                                                className="book-page__volume-nav-btn book-page__volume-nav-btn--disabled book-page__volume-nav-btn--next"
                                                title={tr("Next volume not available in library", "Tome suivant non disponible dans la bibliothèque")}
                                            >
                                                <span>{tr("Next", "Suivant")}</span>
                                                <FontAwesomeIcon icon={faChevronRight} />
                                            </button>
                                        )
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Right column: Info & Actions */}
                        <div className="book-page__details-col">
                            {/* Hamburger Menu (top-right corner) */}
                            <div className="book-page__menu" ref={detailsMenuRef}>
                                <button
                                    type="button"
                                    className={`book-page__menu-btn ${detailsMenuOpen ? "book-page__menu-btn--open" : ""}`}
                                    onClick={() => setDetailsMenuOpen((prev) => !prev)}
                                    title={tr("Actions", "Actions")}
                                    aria-label={tr("Actions menu", "Menu d'actions")}
                                    aria-expanded={detailsMenuOpen}
                                >
                                    <FontAwesomeIcon icon={faBars} />
                                </button>

                                {detailsMenuOpen && (
                                    <div className="book-page__dropdown">
                                        <button
                                            type="button"
                                            className="book-page__dropdown-item"
                                            onClick={() => {
                                                setDetailsMenuOpen(false);
                                                handleOpenEditModal();
                                            }}
                                        >
                                            <FontAwesomeIcon icon={faPen} />
                                            <span>{tr("Edit", "Modifier")}</span>
                                        </button>
                                        <button
                                            type="button"
                                            className="book-page__dropdown-item"
                                            onClick={() => {
                                                setDetailsMenuOpen(false);
                                                setHistoryModalOpen(true);
                                            }}
                                        >
                                            <FontAwesomeIcon icon={faCoins} />
                                            <span>{tr("Purchase history", "Historique d'achat")}{transactions.length > 0 ? ` (${transactions.length})` : ""}</span>
                                        </button>
                                        <div className="book-page__dropdown-divider" />
                                        <button
                                            type="button"
                                            className="book-page__dropdown-item book-page__dropdown-item--danger"
                                            disabled={deletingBook}
                                            onClick={() => {
                                                setDetailsMenuOpen(false);
                                                handleDeleteBook();
                                            }}
                                        >
                                            <FontAwesomeIcon icon={faTrash} />
                                            <span>{deletingBook ? tr("Deleting...", "Suppression...") : tr("Delete", "Supprimer")}</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Badges */}
                            {(book.series?.status || (book.series && book.volume != null) || book.series?.category || editionBadge) && (
                                <div className="book-page__tags">
                                    {book.series?.status && (
                                        <span className="book-page__tag book-page__tag--status">
                                            {getSeriesStatusLabel(book.series.status)}
                                        </span>
                                    )}
                                    {book.series && book.volume != null && (
                                        <span className="book-page__tag book-page__tag--volume">
                                            {book.series?.totalVolumes && book.series.totalVolumes > 1
                                                ? tr(`Volume ${book.volume} of ${Math.max(book.volume, book.series.totalVolumes)}`, `Tome ${book.volume} sur ${Math.max(book.volume, book.series.totalVolumes)}`)
                                                : tr(`Volume ${book.volume}`, `Tome ${book.volume}`)}
                                        </span>
                                    )}
                                    {book.series?.category && (
                                        <span className="book-page__tag book-page__tag--category">
                                            {translateCategory(book.series.category)}
                                        </span>
                                    )}
                                    {editionBadge && (
                                        <span className={`book-page__tag book-page__tag--${editionBadge.type}`}>
                                            <FontAwesomeIcon icon={editionBadge.type === "limited" ? faGem : faStar} />
                                            <span>{editionBadge.label}</span>
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Titles */}
                            <div className="book-page__headings">
                                {/* Série */}
                                {book.series?.name ? (
                                    <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "4px" }}>
                                        <h2 className="book-page__series-title" style={{ margin: 0 }}>
                                            {book.series?.id ? (
                                                <Link
                                                    to={`/app/series/${book.series.id}`}
                                                    className="book-page__entity-title-btn"
                                                    title={tr(`View series ${book.series.name}`, `Voir la série ${book.series.name}`)}
                                                >
                                                    <span>{book.series.name}</span>
                                                    {followStates[`series_${book.series.id}`] && (
                                                        <FontAwesomeIcon icon={faBell} className="book-page__followed-icon" />
                                                    )}
                                                </Link>
                                            ) : (
                                                <span className="book-page__entity-title-btn">{book.series.name}</span>
                                            )}
                                        </h2>
                                    </div>
                                ) : (
                                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px", flexWrap: "wrap" }}>
                                        <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{tr("No linked series", "Aucune série associée")}</span>
                                    </div>
                                )}

                                <div className="book-page__title-row">
                                    <h1 className="book-page__title">{book.title}</h1>
                                </div>

                                {/* Auteurs cliquables pour voir la page auteur */}
                                {book.authors && book.authors.length > 0 && (
                                    <div className="book-page__authors-row">
                                        <span>{tr("By", "Par")}</span>
                                        {book.authors.map((author, idx) => {
                                            const fullName = `${author.firstname || ""} ${author.lastname || ""}`.trim();
                                            const isFollowed = author.id ? Boolean(followStates[`author_${author.id}`]) : false;
                                            return (
                                                <span key={`${author.id || idx}-${author.type || idx}`} className="book-page__author-item">
                                                    {author.id ? (
                                                        <Link
                                                            to={`/app/author/${author.id}`}
                                                            className="book-page__entity-inline-btn"
                                                            title={tr(`View ${fullName}'s page`, `Voir la page de ${fullName}`)}
                                                        >
                                                            <span>{fullName}</span>
                                                            {isFollowed && (
                                                                <FontAwesomeIcon icon={faBell} className="book-page__followed-icon" />
                                                            )}
                                                        </Link>
                                                    ) : (
                                                        <span className="book-page__entity-inline-btn">
                                                            <span>{fullName}</span>
                                                        </span>
                                                    )}
                                                    {idx < (book.authors?.length || 0) - 1 && (
                                                        <span className="book-page__author-sep">,</span>
                                                    )}
                                                </span>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Description */}
                            {book.description && (
                                <div className="book-page__description">
                                    <p>{book.description}</p>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="book-page__actions">
                                {bookStatus !== "OWNED" && bookStatus !== "FOR_SALE" && bookStatus !== "SOLD" && (
                                    <ChangeBookStatusButton
                                        status={bookStatus}
                                        setStatus={setBookStatus}
                                        newStatus="WISHLISTED"
                                        bookId={id}
                                        session={session}
                                        icon={faHeart}
                                    >
                                        {bookStatus === "WISHLISTED" ? tr("In wishlist", "Dans les souhaits") : tr("Wishlist", "Liste de souhaits")}
                                    </ChangeBookStatusButton>
                                )}

                                {bookStatus !== "WISHLISTED" && (
                                    <ChangeBookStatusButton
                                        status={bookStatus}
                                        setStatus={setBookStatus}
                                        newStatus="OWNED"
                                        bookId={id}
                                        session={session}
                                        icon={faBook}
                                    >
                                        {bookStatus === "OWNED" ? tr("In library", "Dans la bibliothèque") : tr("Add to library", "Ajouter à la bibliothèque")}
                                    </ChangeBookStatusButton>
                                )}

                                {bookStatus !== "WISHLISTED" && (
                                    <ChangeBookStatusButton
                                        status={bookStatus}
                                        setStatus={setBookStatus}
                                        newStatus="FOR_SALE"
                                        bookId={id}
                                        session={session}
                                        icon={faTag}
                                        onRequestSale={handleOpenListingModal}
                                    >
                                        {bookStatus === "FOR_SALE" ? tr("For sale", "En vente") : (bookStatus === "SOLD" ? tr("Sold (relist)", "Vendu (remettre en vente)") : tr("List for sale", "Mettre à vendre"))}
                                    </ChangeBookStatusButton>
                                )}

                                {(bookStatus === "FOR_SALE" || bookStatus === "SOLD") && (
                                    <button
                                        type="button"
                                        className={`book-action-btn ${bookStatus === 'SOLD' ? 'book-action-btn--active' : ''}`}
                                        onClick={handleOpenSaleModal}
                                    >
                                        <FontAwesomeIcon icon={bookStatus === 'SOLD' ? faCheck : faCoins} />
                                        <span>{bookStatus === 'SOLD' ? tr('Sold', 'Vendu') : tr('Mark as sold', 'Marquer comme vendu')}</span>
                                    </button>
                                )}

                                <Select
                                    multiple={false}
                                    className="book-reading-status-select"
                                    icon={faBookOpen}
                                    placeholder={tr("Reading status", "Statut de lecture")}
                                    value={readingStatus ? readingStatus.toUpperCase() : "UNREAD"}
                                    onChange={(val) => {
                                        if (val) handleReadingStatusChange(val);
                                    }}
                                    options={[
                                        { id: "UNREAD", label: tr("Unread", "Non lu") },
                                        { id: "READING", label: tr("Currently reading", "En cours de lecture") },
                                        { id: "PAUSED", label: tr("Paused", "En pause") },
                                        { id: "READ", label: tr("Read", "Lu") },
                                        { id: "ABANDONED", label: tr("Abandoned", "Abandonné") }
                                    ]}
                                />
                            </div>

                            {/* Technical Details Card */}
                            <div className="book-page__specs-card">
                                <div className="book-page__specs-header">
                                    <h3 className="book-page__specs-title">{tr("Details", "Détails")}</h3>
                                </div>
                                <div className="book-page__specs-list">
                                    {/* Date de sortie */}
                                    {book.releaseDate && (
                                        <div className="book-page__spec-row">
                                            <span className="book-page__spec-label">
                                                <FontAwesomeIcon icon={faCalendarDays} className="book-page__spec-icon" /> {tr("Release date", "Date de sortie")}
                                            </span>
                                            <span className="book-page__spec-value">
                                                {new Date(book.releaseDate).toLocaleDateString(locale, {
                                                    day: 'numeric',
                                                    month: 'long',
                                                    year: 'numeric'
                                                })}
                                            </span>
                                        </div>
                                    )}

                                    {/* Maison d'édition (Éditeur) cliquable */}
                                    {book.editor?.name && (
                                        <div className="book-page__spec-row">
                                            <span className="book-page__spec-label">
                                                <FontAwesomeIcon icon={faBuilding} className="book-page__spec-icon" /> {tr("Publisher", "Éditeur")}
                                            </span>
                                            <div className="book-page__spec-value">
                                                <button
                                                    type="button"
                                                    className="book-page__spec-author-link"
                                                    onClick={() => openFollowModal("editor", book.editor?.id, book.editor!.name)}
                                                    title={tr(`Manage follow for publisher ${book.editor.name}`, `Gérer le suivi de l'éditeur ${book.editor.name}`)}
                                                >
                                                    <span>{book.editor.name}</span>
                                                    {book.editor?.id && followStates[`editor_${book.editor.id}`] && (
                                                        <FontAwesomeIcon icon={faBell} className="book-page__followed-icon" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Collection cliquable */}
                                    {book.collection?.name && (
                                        <div className="book-page__spec-row">
                                            <span className="book-page__spec-label">
                                                <FontAwesomeIcon icon={faLayerGroup} className="book-page__spec-icon" /> Collection
                                            </span>
                                            <div className="book-page__spec-value">
                                                <button
                                                    type="button"
                                                    className="book-page__spec-author-link"
                                                    onClick={() => openFollowModal("collection", book.collection?.id, book.collection!.name)}
                                                    title={tr(`Manage follow for collection ${book.collection.name}`, `Gérer le suivi de la collection ${book.collection.name}`)}
                                                >
                                                    <span>{book.collection.name}</span>
                                                    {book.collection?.id && followStates[`collection_${book.collection.id}`] && (
                                                        <FontAwesomeIcon icon={faBell} className="book-page__followed-icon" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Scénariste(s) cliquable(s) */}
                                    {scenaristes.length > 0 && (
                                        <div className="book-page__spec-row">
                                            <span className="book-page__spec-label">
                                                <FontAwesomeIcon icon={faPenNib} className="book-page__spec-icon" /> {scenaristes.length > 1 ? tr("Writers", "Scénaristes") : tr("Writer", "Scénariste")}
                                            </span>
                                            <div className="book-page__spec-value book-page__spec-authors">
                                                {scenaristes.map((a, i) => {
                                                    const name = `${a.firstname || ""} ${a.lastname || ""}`.trim();
                                                    const isFollowed = a.id ? Boolean(followStates[`author_${a.id}`]) : false;
                                                    return (
                                                        <span key={a.id || i} className="book-page__spec-author-item">
                                                            {a.id ? (
                                                                <Link
                                                                    to={`/app/author/${a.id}`}
                                                                    className="book-page__spec-author-link"
                                                                    title={`Voir la page de ${name}`}
                                                                >
                                                                    <span>{name}</span>
                                                                    {isFollowed && (
                                                                        <FontAwesomeIcon icon={faBell} className="book-page__followed-icon" />
                                                                    )}
                                                                </Link>
                                                            ) : (
                                                                <span className="book-page__spec-author-link">
                                                                    <span>{name}</span>
                                                                </span>
                                                            )}
                                                            {i < scenaristes.length - 1 && <span className="book-page__spec-separator">,</span>}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Dessinateur(s) cliquable(s) */}
                                    {dessinateurs.length > 0 && (
                                        <div className="book-page__spec-row">
                                            <span className="book-page__spec-label">
                                                <FontAwesomeIcon icon={faPencil} className="book-page__spec-icon" /> {dessinateurs.length > 1 ? tr("Illustrators", "Dessinateurs") : tr("Illustrator", "Dessinateur")}
                                            </span>
                                            <div className="book-page__spec-value book-page__spec-authors">
                                                {dessinateurs.map((a, i) => {
                                                    const name = `${a.firstname || ""} ${a.lastname || ""}`.trim();
                                                    const isFollowed = a.id ? Boolean(followStates[`author_${a.id}`]) : false;
                                                    return (
                                                        <span key={a.id || i} className="book-page__spec-author-item">
                                                            {a.id ? (
                                                                <Link
                                                                    to={`/app/author/${a.id}`}
                                                                    className="book-page__spec-author-link"
                                                                    title={`Voir la page de ${name}`}
                                                                >
                                                                    <span>{name}</span>
                                                                    {isFollowed && (
                                                                        <FontAwesomeIcon icon={faBell} className="book-page__followed-icon" />
                                                                    )}
                                                                </Link>
                                                            ) : (
                                                                <span className="book-page__spec-author-link">
                                                                    <span>{name}</span>
                                                                </span>
                                                            )}
                                                            {i < dessinateurs.length - 1 && <span className="book-page__spec-separator">,</span>}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Coloriste(s) cliquable(s) */}
                                    {coloristes.length > 0 && (
                                        <div className="book-page__spec-row">
                                            <span className="book-page__spec-label">
                                                <FontAwesomeIcon icon={faPalette} className="book-page__spec-icon" /> {coloristes.length > 1 ? tr("Colorists", "Coloristes") : tr("Colorist", "Coloriste")}
                                            </span>
                                            <div className="book-page__spec-value book-page__spec-authors">
                                                {coloristes.map((a, i) => {
                                                    const name = `${a.firstname || ""} ${a.lastname || ""}`.trim();
                                                    const isFollowed = a.id ? Boolean(followStates[`author_${a.id}`]) : false;
                                                    return (
                                                        <span key={a.id || i} className="book-page__spec-author-item">
                                                            {a.id ? (
                                                                <Link
                                                                    to={`/app/author/${a.id}`}
                                                                    className="book-page__spec-author-link"
                                                                    title={`Voir la page de ${name}`}
                                                                >
                                                                    <span>{name}</span>
                                                                    {isFollowed && (
                                                                        <FontAwesomeIcon icon={faBell} className="book-page__followed-icon" />
                                                                    )}
                                                                </Link>
                                                            ) : (
                                                                <span className="book-page__spec-author-link">
                                                                    <span>{name}</span>
                                                                </span>
                                                            )}
                                                            {i < coloristes.length - 1 && <span className="book-page__spec-separator">,</span>}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* ISBN / EAN */}
                                    {book.isbn && (
                                        <div className="book-page__spec-row">
                                            <span className="book-page__spec-label">
                                                <FontAwesomeIcon icon={faBarcode} className="book-page__spec-icon" /> ISBN
                                            </span>
                                            <span className="book-page__spec-value">{book.isbn}</span>
                                        </div>
                                    )}

                                    {/* Dimensions */}
                                    {formatDimensions(book.length, book.height, book.thickness) && (
                                        <div className="book-page__spec-row">
                                            <span className="book-page__spec-label">
                                                <FontAwesomeIcon icon={faRulerCombined} className="book-page__spec-icon" /> Dimensions
                                            </span>
                                            <span className="book-page__spec-value">
                                                {formatDimensions(book.length, book.height, book.thickness)}
                                            </span>
                                        </div>
                                    )}

                                    {/* Poids */}
                                    {book.weight ? (
                                        <div className="book-page__spec-row">
                                            <span className="book-page__spec-label">
                                                <FontAwesomeIcon icon={faScaleBalanced} className="book-page__spec-icon" /> {tr("Weight", "Poids")}
                                            </span>
                                            <span className="book-page__spec-value">{book.weight} g</span>
                                        </div>
                                    ) : null}

                                    {/* Pages */}
                                    {book.pageCount ? (
                                        <div className="book-page__spec-row">
                                            <span className="book-page__spec-label">
                                                <FontAwesomeIcon icon={faFileLines} className="book-page__spec-icon" /> Pages
                                            </span>
                                            <span className="book-page__spec-value">{book.pageCount}</span>
                                        </div>
                                    ) : null}

                                    {/* Type (cartonné, relié, souple, etc.) */}
                                    {book.type && (
                                        <div className="book-page__spec-row">
                                            <span className="book-page__spec-label">
                                                <FontAwesomeIcon icon={faBox} className="book-page__spec-icon" /> Type
                                            </span>
                                            <span className="book-page__spec-value">{book.type}</span>
                                        </div>
                                    )}

                                    {/* Thèmes (justice, gotham, enquête, aventure, scifi, etc.) */}
                                    {book.themes && book.themes.length > 0 && (
                                        <div className="book-page__spec-row">
                                            <span className="book-page__spec-label">
                                                <FontAwesomeIcon icon={faTags} className="book-page__spec-icon" /> {tr("Themes", "Thèmes")}
                                            </span>
                                            <span className="book-page__spec-value">
                                                {book.themes.join(", ")}
                                            </span>
                                        </div>
                                    )}

                                    {/* Prix */}
                                    {book.price ? (
                                        <div className="book-page__spec-row">
                                            <span className="book-page__spec-label">
                                                <FontAwesomeIcon icon={faTag} className="book-page__spec-icon" /> {tr("Price", "Prix")}
                                            </span>
                                            <span className="book-page__spec-value">{book.price} €</span>
                                        </div>
                                    ) : null}
                                </div>
                            </div>

                            {/* Variants / Alternative Covers Section */}
                        </div>
                    </div>
                )}
            </div>

            {/* Book Information Edit Modal */}
            <Dialog
                open={editModalOpen}
                onClose={() => !savingBookInfo && setEditModalOpen(false)}
                PaperProps={{
                    style: {
                        backgroundColor: "var(--bg-surface, #1e1e24)",
                        border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))",
                        borderRadius: "16px",
                        maxWidth: "600px",
                        width: "100%",
                        padding: "18px 20px",
                        color: "var(--text-primary)",
                        overflow: "visible"
                    }
                }}
            >
                <div className="book-edit-dialog">
                    <div className="book-edit-dialog__header">
                        <div className="book-edit-dialog__header-title">
                            <FontAwesomeIcon icon={faPen} />
                            <h3>{tr("Edit book information", "Modifier les informations du livre")}</h3>
                        </div>
                        <button
                            type="button"
                            className="book-edit-dialog__close-btn"
                            onClick={() => setEditModalOpen(false)}
                            disabled={savingBookInfo}
                            aria-label="Fermer"
                        >
                            <FontAwesomeIcon icon={faXmark} />
                        </button>
                    </div>

                    {/* Section Série & Tomaison */}
                    <div className="book-edit-dialog__series-bar">
                        <div className="book-edit-dialog__series-info">
                            <span className="book-edit-dialog__series-label">
                                <FontAwesomeIcon icon={faLayerGroup} /> {tr("Series & Volume", "Série & Tomaison")}
                            </span>
                            {book?.series?.name ? (
                                <strong className="book-edit-dialog__series-name">
                                    {book.series.name}{book.volume != null ? ` — ${tr(`Volume ${book.volume}`, `Tome ${book.volume}`)}` : ""}
                                </strong>
                            ) : (
                                <span className="book-edit-dialog__series-empty">{tr("No linked series (no volume)", "Aucune série associée (pas de tomaison)")}</span>
                            )}
                        </div>
                        <button
                            type="button"
                            className="book-edit-dialog__series-btn"
                            onClick={handleOpenSeriesModal}
                        >
                            <FontAwesomeIcon icon={book?.series?.name ? faPen : faPlus} />
                            <span>{book?.series?.name ? tr("Edit series / volume", "Modifier la série / tome") : tr("Link to a series", "Associer à une série")}</span>
                        </button>
                    </div>

                    <form className="book-edit-dialog__form" onSubmit={handleSaveBookInfo}>
                        {/* Titre de l'album */}
                        <div className="tx-dialog__field">
                            <label>
                                <FontAwesomeIcon icon={faBook} />
                                <span>{tr("Book title *", "Titre de l'album *")}</span>
                            </label>
                            <input
                                type="text"
                                required
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                placeholder={tr("Book title", "Titre de l'ouvrage")}
                            />
                        </div>

                        {/* Date de sortie & ISBN / EAN sur la même ligne */}
                        <div className="book-edit-dialog__row book-edit-dialog__row--2col">
                            <div className="tx-dialog__field">
                                <label>
                                    <FontAwesomeIcon icon={faCalendarDays} />
                                    <span>{tr("Release date", "Date de sortie")}</span>
                                </label>
                                <input
                                    type="date"
                                    value={editReleaseDate}
                                    onChange={(e) => setEditReleaseDate(e.target.value)}
                                />
                            </div>

                            <div className="tx-dialog__field">
                                <label>
                                    <FontAwesomeIcon icon={faBarcode} />
                                    <span>ISBN / EAN</span>
                                </label>
                                <input
                                    type="text"
                                    value={editIsbn}
                                    onChange={(e) => setEditIsbn(e.target.value)}
                                    placeholder="ex: 9791026816775"
                                />
                            </div>
                        </div>

                        {/* Éditeur & Collection sur la même ligne */}
                        <div className="book-edit-dialog__row book-edit-dialog__row--2col">
                            <div className="tx-dialog__field">
                                <label>
                                    <FontAwesomeIcon icon={faBuilding} />
                                    <span>{tr("Publisher", "Éditeur")}</span>
                                </label>
                                <SearchableSelect
                                    value={editEditorName}
                                    onChange={setEditEditorName}
                                    options={editorOptions.map((ed) => ed.name)}
                                    placeholder={tr("Search or enter a publisher...", "Rechercher ou saisir un éditeur...")}
                                />
                            </div>

                            <div className="tx-dialog__field">
                                <label>
                                    <FontAwesomeIcon icon={faLayerGroup} />
                                    <span>{tr("Collection", "Collection")}</span>
                                </label>
                                <SearchableSelect
                                    value={editCollectionName}
                                    onChange={setEditCollectionName}
                                    options={collectionOptions.map((col) => col.name)}
                                    placeholder={tr("Search or enter a collection...", "Rechercher ou saisir une collection...")}
                                    emptyLabel={tr("-- None (no collection) --", "-- Aucun (sans collection) --")}
                                />
                            </div>
                        </div>

                        {/* Pages & Poids sur la même ligne */}
                        <div className="book-edit-dialog__row book-edit-dialog__row--2col">
                            <div className="tx-dialog__field">
                                <label>
                                    <FontAwesomeIcon icon={faFileLines} />
                                    <span>Pages</span>
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={editPageCount}
                                    onChange={(e) => setEditPageCount(e.target.value)}
                                    placeholder="ex: 160"
                                />
                            </div>

                            <div className="tx-dialog__field">
                                <label>
                                    <FontAwesomeIcon icon={faWeightHanging} />
                                    <span>{tr("Weight (g)", "Poids (g)")}</span>
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={editWeight}
                                    onChange={(e) => setEditWeight(e.target.value)}
                                    placeholder="ex: 650"
                                />
                            </div>
                        </div>

                        {/* Largeur / Hauteur / Épaisseur sur la même ligne */}
                        <div className="book-edit-dialog__row book-edit-dialog__row--3col">
                            <div className="tx-dialog__field">
                                <label>
                                    <FontAwesomeIcon icon={faRulerCombined} />
                                    <span>{tr("Width (mm)", "Largeur (mm)")}</span>
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={editLength}
                                    onChange={(e) => setEditLength(e.target.value)}
                                    placeholder="ex: 185"
                                />
                            </div>

                            <div className="tx-dialog__field">
                                <label>
                                    <FontAwesomeIcon icon={faRulerCombined} />
                                    <span>{tr("Height (mm)", "Hauteur (mm)")}</span>
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={editHeight}
                                    onChange={(e) => setEditHeight(e.target.value)}
                                    placeholder="ex: 282"
                                />
                            </div>

                            <div className="tx-dialog__field">
                                <label>
                                    <FontAwesomeIcon icon={faRulerCombined} />
                                    <span>{tr("Thickness (mm)", "Épaisseur (mm)")}</span>
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={editThickness}
                                    onChange={(e) => setEditThickness(e.target.value)}
                                    placeholder="ex: 16"
                                />
                            </div>
                        </div>

                        {/* Prix & Format / Type sur la même ligne */}
                        <div className="book-edit-dialog__row book-edit-dialog__row--2col">
                            <div className="tx-dialog__field">
                                <label>
                                    <FontAwesomeIcon icon={faTag} />
                                    <span>{tr("Price (€)", "Prix (€)")}</span>
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={editPrice}
                                    onChange={(e) => setEditPrice(e.target.value)}
                                    placeholder="ex: 20"
                                />
                            </div>

                            <div className="tx-dialog__field">
                                <label>
                                    <FontAwesomeIcon icon={faBookBookmark} />
                                    <span>{tr("Format / Type", "Format / Type")}</span>
                                </label>
                                <SearchableSelect
                                    value={editType}
                                    onChange={setEditType}
                                    options={typeOptions}
                                    placeholder={tr("Search or choose a format...", "Rechercher ou choisir un format...")}
                                    openDirection="up"
                                />
                            </div>
                        </div>

                        <div className="tx-dialog__actions">
                            <button
                                type="button"
                                className="tx-dialog__btn-cancel"
                                onClick={() => setEditModalOpen(false)}
                                disabled={savingBookInfo}
                            >
                                {tr("Cancel", "Annuler")}
                            </button>
                            <button
                                type="submit"
                                disabled={savingBookInfo}
                                className="tx-dialog__btn-submit tx-dialog__btn-submit--bought"
                            >
                                <FontAwesomeIcon icon={faCheck} />
                                <span>{savingBookInfo ? tr("Saving...", "Enregistrement...") : tr("Save changes", "Enregistrer les modifications")}</span>
                            </button>
                        </div>
                    </form>
                </div>
            </Dialog>

            {/* Cover Update Modal */}
            <Dialog
                open={coverModalOpen}
                onClose={handleCloseCoverModal}
                PaperProps={{
                    style: {
                        backgroundColor: "var(--bg-surface, #1e1e24)",
                        border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))",
                        borderRadius: "16px",
                        maxWidth: "500px",
                        width: "100%",
                        padding: "24px",
                        color: "var(--text-primary)",
                        overflow: "visible"
                    }
                }}
            >
                <div className="cover-dialog">
                    <div className="cover-dialog__header">
                        <div className="cover-dialog__header-title">
                            <FontAwesomeIcon icon={faImage} />
                            <h3>{tr("Change cover", "Changer la couverture")}</h3>
                        </div>
                        <button
                            type="button"
                            className="cover-dialog__close-btn"
                            onClick={handleCloseCoverModal}
                            disabled={uploadingCover}
                            aria-label="Fermer"
                        >
                            <FontAwesomeIcon icon={faXmark} />
                        </button>
                    </div>

                    {book && (
                        <p className="cover-dialog__subtitle">
                            {tr("Choose a new image for", "Choisissez une nouvelle image pour")} <strong>« {book.title} »</strong>. {tr("It will be automatically resized and converted to WebP by", "Elle sera automatiquement redimensionnée et convertie en WebP par")} <code>service-media</code>.
                        </p>
                    )}

                    <div className="cover-dialog__tabs">
                        <button
                            type="button"
                            className={`cover-dialog__tab ${coverMode === "file" ? "cover-dialog__tab--active" : ""}`}
                            onClick={() => setCoverMode("file")}
                            disabled={uploadingCover}
                        >
                            <FontAwesomeIcon icon={faUpload} />
                            <span>{tr("Local file", "Fichier local")}</span>
                        </button>
                        <button
                            type="button"
                            className={`cover-dialog__tab ${coverMode === "url" ? "cover-dialog__tab--active" : ""}`}
                            onClick={() => setCoverMode("url")}
                            disabled={uploadingCover}
                        >
                            <FontAwesomeIcon icon={faLink} />
                            <span>{tr("From URL", "Depuis une URL")}</span>
                        </button>
                    </div>

                    <form className="cover-dialog__form" onSubmit={handleSaveCover}>
                        {coverMode === "file" ? (
                            <div
                                className={`cover-dialog__dropzone ${isDraggingCover ? "cover-dialog__dropzone--dragging" : ""}`}
                                onClick={() => coverInputRef.current?.click()}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    setIsDraggingCover(true);
                                }}
                                onDragLeave={() => setIsDraggingCover(false)}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setIsDraggingCover(false);
                                    const file = e.dataTransfer.files?.[0] || null;
                                    handleSelectCoverFile(file);
                                }}
                            >
                                <input
                                    ref={coverInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                                    style={{ display: "none" }}
                                    onChange={(e) => handleSelectCoverFile(e.target.files?.[0] || null)}
                                />
                                <FontAwesomeIcon icon={faUpload} className="cover-dialog__dropzone-icon" />
                                <span className="cover-dialog__dropzone-title">
                                    {coverFile ? coverFile.name : tr("Click or drag and drop an image here", "Cliquez ou glissez-déposez une image ici")}
                                </span>
                                <span className="cover-dialog__dropzone-hint">
                                    {tr("JPG, PNG, WebP (automatically optimized to WebP)", "JPG, PNG, WebP (optimisé automatiquement en WebP)")}
                                </span>
                            </div>
                        ) : (
                            <div className="tx-dialog__field">
                                <label>
                                    <FontAwesomeIcon icon={faLink} />
                                    <span>{tr("Image URL *", "URL de l'image *")}</span>
                                </label>
                                <input
                                    type="url"
                                    placeholder={tr("https://example.com/cover.jpg", "https://exemple.com/couverture.jpg")}
                                    value={coverRemoteUrl}
                                    onChange={(e) => setCoverRemoteUrl(e.target.value)}
                                    required
                                />
                            </div>
                        )}

                        <div className="cover-dialog__preview-section">
                            <div className="cover-dialog__preview-col">
                                <span className="cover-dialog__preview-label">{tr("Current", "Actuelle")}</span>
                                <div className="cover-dialog__preview-box">
                                    {book?.coverUrl ? (
                                        <img src={book.coverUrl} alt={tr("Current cover", "Couverture actuelle")} />
                                    ) : (
                                        <div className="cover-dialog__preview-empty">
                                            <FontAwesomeIcon icon={faBook} />
                                            <span>{tr("None", "Aucune")}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="cover-dialog__preview-col">
                                <span className="cover-dialog__preview-label">{tr("New", "Nouvelle")}</span>
                                <div className="cover-dialog__preview-box cover-dialog__preview-box--new">
                                    {currentCoverPreview ? (
                                        <img src={currentCoverPreview} alt={tr("New cover preview", "Aperçu nouvelle couverture")} />
                                    ) : (
                                        <div className="cover-dialog__preview-empty">
                                            <FontAwesomeIcon icon={faImage} />
                                            <span>{tr("Preview", "Aperçu")}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="tx-dialog__actions">
                            <button
                                type="button"
                                className="tx-dialog__btn-cancel"
                                onClick={handleCloseCoverModal}
                                disabled={uploadingCover}
                            >
                                {tr("Cancel", "Annuler")}
                            </button>
                            <button
                                type="submit"
                                disabled={uploadingCover || (coverMode === "file" ? !coverFile : !coverRemoteUrl.trim())}
                                className="tx-dialog__btn-submit tx-dialog__btn-submit--bought"
                            >
                                <FontAwesomeIcon icon={faCheck} />
                                <span>{uploadingCover ? tr("Uploading to service-media...", "Envoi vers service-media...") : tr("Save cover", "Enregistrer la couverture")}</span>
                            </button>
                        </div>
                    </form>
                </div>
            </Dialog>

            {/* Series Association Modal */}
            <Dialog
                open={seriesModalOpen}
                onClose={() => setSeriesModalOpen(false)}
                PaperProps={{
                    style: {
                        backgroundColor: "var(--bg-surface, #1e1e24)",
                        border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))",
                        borderRadius: "16px",
                        maxWidth: "500px",
                        width: "100%",
                        padding: "24px",
                        color: "var(--text-primary)",
                        overflow: "visible"
                    }
                }}
            >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <FontAwesomeIcon icon={faLayerGroup} style={{ color: "var(--accent-primary)" }} />
                        <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>
                            {book?.series ? tr("Manage this book's series", "Gérer la série de cet album") : tr("Link to a series", "Associer à une série")}
                        </h3>
                    </div>
                    <button
                        type="button"
                        onClick={() => setSeriesModalOpen(false)}
                        style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: "1.1rem" }}
                    >
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>

                {/* Tabs: Choose existing vs Create new */}
                <div style={{ display: "flex", gap: "8px", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", padding: "4px", borderRadius: "8px", marginBottom: "16px" }}>
                    <button
                        type="button"
                        onClick={() => setSeriesModalMode("select")}
                        style={{
                            flex: 1,
                            padding: "6px 12px",
                            background: seriesModalMode === "select" ? "var(--accent-primary)" : "transparent",
                            color: seriesModalMode === "select" ? "#fff" : "var(--text-primary)",
                            border: "none",
                            borderRadius: "6px",
                            fontWeight: 600,
                            fontSize: "0.85rem",
                            cursor: "pointer"
                        }}
                    >
                        {tr("Existing series", "Série existante")}
                    </button>
                    <button
                        type="button"
                        onClick={() => setSeriesModalMode("create")}
                        style={{
                            flex: 1,
                            padding: "6px 12px",
                            background: seriesModalMode === "create" ? "var(--accent-primary)" : "transparent",
                            color: seriesModalMode === "create" ? "#fff" : "var(--text-primary)",
                            border: "none",
                            borderRadius: "6px",
                            fontWeight: 600,
                            fontSize: "0.85rem",
                            cursor: "pointer"
                        }}
                    >
                        {tr("+ New series", "+ Nouvelle série")}
                    </button>
                </div>

                {seriesModalMode === "select" ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                        <div className="tx-dialog__field">
                            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                                {tr("Select a series", "Sélectionner une série")}
                            </label>
                            <SeriesSearchableSelect
                                selectedId={selectedSeriesId}
                                onSelectId={setSelectedSeriesId}
                                seriesList={seriesListOptions}
                                onCreateNew={(initialName) => {
                                    setNewSeriesName(initialName);
                                    setSeriesModalMode("create");
                                }}
                            />
                        </div>

                        {selectedSeriesId ? (
                            <div>
                                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                                    {tr("Position in series (Volume #)", "Position dans la série (Tome n°)")}
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    value={selectedVolume}
                                    onChange={(e) => setSelectedVolume(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                    style={{
                                        width: "100%",
                                        height: "40px",
                                        boxSizing: "border-box",
                                        padding: "0 14px",
                                        background: "var(--input-bg, #ffffff)",
                                        border: "1px solid var(--border-subtle)",
                                        borderRadius: "8px",
                                        color: "var(--text-primary)",
                                        outline: "none"
                                    }}
                                />
                            </div>
                        ) : (
                            <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--text-secondary)", fontStyle: "italic" }}>
                                {tr("Without a linked series, this book will not have a volume number.", "Sans série associée, cet album n'aura pas de tomaison.")}
                            </p>
                        )}
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                        <div>
                            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                                {tr("New series name *", "Nom de la nouvelle série *")}
                            </label>
                            <input
                                type="text"
                                placeholder={tr("e.g. Batman Rebirth, Blackwater...", "ex: Batman Rebirth, Blackwater...")}
                                value={newSeriesName}
                                onChange={(e) => setNewSeriesName(e.target.value)}
                                style={{
                                    width: "100%",
                                    padding: "10px 14px",
                                        background: "var(--input-bg, #ffffff)",
                                    border: "1px solid var(--border-subtle)",
                                    borderRadius: "8px",
                                    color: "var(--text-primary)",
                                    outline: "none"
                                }}
                            />
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                            <div>
                                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                                    {tr("Category", "Catégorie")}
                                </label>
                                <Select
                                    multiple={false}
                                    translateOptions
                                    className="book-dialog-select"
                                    placeholder={tr("Category", "Catégorie")}
                                    value={String(newSeriesCategory)}
                                    onChange={(val) => {
                                        if (val) setNewSeriesCategory(Number(val));
                                    }}
                                    options={[
                                        { id: "3", label: "Comics" },
                                        { id: "2", label: "Bande dessinée" },
                                        { id: "4", label: "Manga" },
                                        { id: "5", label: "Roman Graphique" },
                                        { id: "1", label: "Roman" },
                                        { id: "6", label: "Beau-livre" },
                                        { id: "7", label: "E-book" }
                                    ]}
                                />
                            </div>

                            <div>
                                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                                    {tr("Position in series (Volume #)", "Position dans la série (Tome n°)")}
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    value={selectedVolume}
                                    onChange={(e) => setSelectedVolume(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                    style={{
                                        width: "100%",
                                        height: "40px",
                                        boxSizing: "border-box",
                                        padding: "0 14px",
                                        background: "var(--input-bg, #ffffff)",
                                        border: "1px solid var(--border-subtle)",
                                        borderRadius: "8px",
                                        color: "var(--text-primary)",
                                        outline: "none"
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "24px" }}>
                    {book?.series ? (
                        <button
                            type="button"
                            onClick={handleRemoveFromSeries}
                            style={{
                                padding: "8px 14px",
                                background: "rgba(239, 68, 68, 0.15)",
                                border: "1px solid rgba(239, 68, 68, 0.3)",
                                color: "#dc2626",
                                borderRadius: "8px",
                                cursor: "pointer",
                                fontWeight: 600,
                                fontSize: "0.8rem",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px"
                            }}
                        >
                            <FontAwesomeIcon icon={faTrash} />
                            <span>{tr("Remove from series", "Retirer de la série")}</span>
                        </button>
                    ) : <div />}

                    <div style={{ display: "flex", gap: "10px" }}>
                        <button
                            type="button"
                            onClick={() => setSeriesModalOpen(false)}
                            style={{
                                padding: "8px 16px",
                                background: "var(--bg-card)",
                                border: "1px solid var(--border-subtle)",
                                color: "var(--text-secondary)",
                                borderRadius: "8px",
                                cursor: "pointer",
                                fontWeight: 600
                            }}
                        >
                            {tr("Cancel", "Annuler")}
                        </button>
                        <button
                            type="button"
                            disabled={savingSeries}
                            onClick={handleSaveSeriesAssociation}
                            style={{
                                padding: "8px 18px",
                                background: "var(--accent-primary)",
                                border: "none",
                                color: "#fff",
                                borderRadius: "8px",
                                cursor: "pointer",
                                fontWeight: 600
                            }}
                        >
                            {savingSeries ? tr("Saving...", "Enregistrement...") : tr("Confirm", "Valider")}
                        </button>
                    </div>
                </div>
            </Dialog>

            {/* Follow / Unfollow Dialog Modal */}
            <Dialog
                open={Boolean(followModalTarget)}
                onClose={() => setFollowModalTarget(null)}
                PaperProps={{
                    style: {
                        backgroundColor: "var(--bg-surface, #1e1e24)",
                        border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))",
                        borderRadius: "16px",
                        boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6)",
                        width: "100%",
                        maxWidth: "440px",
                        margin: "16px",
                        padding: "24px"
                    }
                }}
            >
                {followModalTarget && (() => {
                    const key = `${followModalTarget.type}_${followModalTarget.id}`;
                    const isFollowed = Boolean(followStates[key]);
                    return (
                        <div className="follow-dialog">
                            <div className="follow-dialog__header">
                                <div className={`follow-dialog__icon-wrapper follow-dialog__icon-wrapper--${followModalTarget.type}`}>
                                    <FontAwesomeIcon icon={getFollowTypeIcon(followModalTarget.type)} />
                                </div>
                                <div className="follow-dialog__header-text">
                                    <span className="follow-dialog__type-badge">
                                        {getFollowTypeLabel(followModalTarget.type)}
                                    </span>
                                    <h3 className="follow-dialog__title">{followModalTarget.name}</h3>
                                    {followModalTarget.roleOrSubtitle && (
                                        <p className="follow-dialog__subtitle">{followModalTarget.roleOrSubtitle}</p>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    className="follow-dialog__close-btn"
                                    onClick={() => setFollowModalTarget(null)}
                                    aria-label="Fermer"
                                >
                                    <FontAwesomeIcon icon={faXmark} />
                                </button>
                            </div>

                            <div className="follow-dialog__body">
                                <p className="follow-dialog__desc">
                                    {isFollowed
                                        ? tr("You are following releases for this item. You will receive updates and related new books.", "Vous êtes abonné aux parutions de cet élément. Vous recevrez les actualités et nouveaux albums associés.")
                                        : tr("Follow this item to be notified of future releases and easily find it in your follows.", "Abonnez-vous à cet élément pour être alerté des futures sorties et facilement le retrouver dans vos suivis.")}
                                </p>

                                <div className="follow-dialog__actions">
                                    <button
                                        type="button"
                                        className={`follow-dialog__btn ${isFollowed ? "follow-dialog__btn--unfollow" : "follow-dialog__btn--follow"}`}
                                        onClick={handleToggleFollow}
                                        disabled={followProcessing}
                                    >
                                        <FontAwesomeIcon icon={isFollowed ? faBellSlash : faBell} />
                                        <span>{isFollowed ? tr("Unfollow", "Ne plus suivre") : tr("Follow", "Suivre")}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </Dialog>

            {/* Purchase & Sales History Dialog */}
            <Dialog
                open={historyModalOpen}
                onClose={() => setHistoryModalOpen(false)}
                PaperProps={{
                    style: {
                        backgroundColor: "var(--bg-surface, #1e1e24)",
                        border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))",
                        borderRadius: "16px",
                        maxWidth: "620px",
                        width: "100%",
                        padding: "20px 22px",
                        color: "var(--text-primary)"
                    }
                }}
            >
                <div className="book-page__transactions-dialog">
                    <div className="book-page__transactions-header">
                        <div className="book-page__transactions-header-title">
                            <FontAwesomeIcon icon={faCoins} />
                            <h3>{tr("Purchase history", "Historique d'achat")} {transactions.length > 0 ? `(${transactions.length})` : ""}</h3>
                        </div>
                        <div className="book-page__transactions-header-actions">
                            <button
                                type="button"
                                className="book-page__tx-btn book-page__tx-btn--buy"
                                onClick={() => handleOpenPurchaseModal("BOUGHT")}
                                title={tr("Add a purchase for this book", "Ajouter un achat pour cet album")}
                            >
                                <FontAwesomeIcon icon={faCartShopping} />
                                <span>{tr("Add purchase", "Ajouter un achat")}</span>
                            </button>
                            <button
                                type="button"
                                className="book-page__tx-btn book-page__tx-btn--gift"
                                onClick={() => handleOpenPurchaseModal("GIFT")}
                                title={tr("Mark this book as received as a gift", "Indiquer que cet album a été reçu en cadeau")}
                            >
                                <FontAwesomeIcon icon={faGift} />
                                <span>{tr("Received as gift", "Reçu en cadeau")}</span>
                            </button>
                            <button
                                type="button"
                                className="tx-dialog__header-close"
                                onClick={() => setHistoryModalOpen(false)}
                                aria-label="Fermer"
                            >
                                <FontAwesomeIcon icon={faXmark} />
                            </button>
                        </div>
                    </div>

                    {transactions.length > 0 && (
                        <div className="book-page__transactions-summary">
                            {hasBought && (
                                <div className="book-page__summary-pill book-page__summary-pill--bought">
                                    <span>{tr("Total bought:", "Total acheté :")}</span>
                                    <strong>{totalBought.toFixed(2).replace('.', ',')} €</strong>
                                </div>
                            )}
                            {hasGift && (
                                <div className="book-page__summary-pill book-page__summary-pill--gift">
                                    <span>{tr("Gifts received:", "Cadeaux reçus :")}</span>
                                    <strong>{giftCount}</strong>
                                </div>
                            )}
                            {hasSold && (
                                <div className="book-page__summary-pill book-page__summary-pill--sold">
                                    <span>{tr("Total sold:", "Total vendu :")}</span>
                                    <strong>{totalSold.toFixed(2).replace('.', ',')} €</strong>
                                </div>
                            )}
                            {(hasBought || hasGift) && hasSold && (
                                <div className="book-page__summary-pill">
                                    <span>{tr("Balance:", "Solde :")}</span>
                                    <strong style={{ color: totalSold >= totalBought ? "var(--accent-primary)" : "#f87171" }}>
                                        {(totalSold - totalBought >= 0 ? "+" : "") + (totalSold - totalBought).toFixed(2).replace('.', ',')} €
                                    </strong>
                                </div>
                            )}
                        </div>
                    )}

                    {loadingTransactions ? (
                        <div className="book-page__transactions-empty">
                            <p>{tr("Loading history...", "Chargement de l'historique...")}</p>
                        </div>
                    ) : transactions.length === 0 ? (
                        <div className="book-page__transactions-empty">
                            <p>{tr("No purchase or sale history recorded for this book.", "Aucun historique d'achat ou de vente renseigné pour cet album.")}</p>
                            <div style={{ marginTop: "10px", display: "flex", justifyContent: "center", gap: "8px", flexWrap: "wrap" }}>
                                <button
                                    type="button"
                                    className="book-page__tx-btn book-page__tx-btn--buy"
                                    onClick={() => handleOpenPurchaseModal("BOUGHT")}
                                >
                                    <FontAwesomeIcon icon={faCartShopping} />
                                    <span>{tr("Add first purchase", "Ajouter un premier achat")}</span>
                                </button>
                                <button
                                    type="button"
                                    className="book-page__tx-btn book-page__tx-btn--gift"
                                    onClick={() => handleOpenPurchaseModal("GIFT")}
                                >
                                    <FontAwesomeIcon icon={faGift} />
                                    <span>{tr("Received as gift", "Reçu en cadeau")}</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="book-page__transactions-list">
                            {transactions.map((tx) => {
                                const isBuy = tx.type === "BOUGHT";
                                const isGift = tx.type === "GIFT";
                                const badgeClass = isBuy
                                    ? "book-page__tx-badge--bought"
                                    : isGift
                                        ? "book-page__tx-badge--gift"
                                        : "book-page__tx-badge--sold";
                                const badgeIcon = isBuy ? faCartShopping : isGift ? faGift : faCoins;
                                const badgeLabel = isBuy ? tr("Bought", "Acheté") : isGift ? tr("Gift", "Cadeau") : tr("Sold", "Vendu");
                                return (
                                    <div key={tx.id} className="book-page__tx-item">
                                        <div className="book-page__tx-left">
                                            <span className={`book-page__tx-badge ${badgeClass}`}>
                                                <FontAwesomeIcon icon={badgeIcon} />
                                                <span>{badgeLabel}</span>
                                            </span>

                                            <div className="book-page__tx-details">
                                                <div className="book-page__tx-date-location">
                                                    <span>
                                                        {formatTransactionDate(tx)}
                                                    </span>

                                                    {tx.location && (
                                                        <span className="book-page__tx-location" title={isBuy ? tr("Purchase location", "Lieu d'achat") : isGift ? tr("Gifted by / Occasion", "Offert par / Occasion") : tr("Platform / Buyer", "Canal / Acheteur")}>
                                                            <FontAwesomeIcon icon={isGift ? faGift : faStore} />
                                                            <span>{tx.location}</span>
                                                        </span>
                                                    )}
                                                </div>

                                                {tx.memo && (
                                                    <span className="book-page__tx-memo" title="Mémo">
                                                        <FontAwesomeIcon icon={faNoteSticky} />
                                                        <span>« {tx.memo} »</span>
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="book-page__tx-right">
                                            {!isGift && (
                                                <span className={`book-page__tx-price ${isBuy ? 'book-page__tx-price--bought' : 'book-page__tx-price--sold'}`}>
                                                    {tx.price != null ? `${Number(tx.price).toFixed(2).replace('.', ',')} €` : "- €"}
                                                </span>
                                            )}

                                            <button
                                                type="button"
                                                className="book-page__tx-delete"
                                                onClick={() => handleDeleteTransaction(tx.id)}
                                                title={tr("Delete this entry", "Supprimer cette ligne")}
                                            >
                                                <FontAwesomeIcon icon={faTrashCan} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </Dialog>

            {/* Purchase / Gift Modal */}
            <Dialog
                open={purchaseModalOpen}
                onClose={() => setPurchaseModalOpen(false)}
                PaperProps={{
                    style: {
                        backgroundColor: "var(--bg-surface, #1e1e24)",
                        border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))",
                        borderRadius: "16px",
                        maxWidth: "460px",
                        width: "100%",
                        padding: "24px",
                        color: "var(--text-primary)",
                        overflow: "visible"
                    }
                }}
            >
                <div className="tx-dialog">
                    <div className="tx-dialog__header">
                        <div className="tx-dialog__header-title">
                            <FontAwesomeIcon
                                icon={buyType === "GIFT" ? faGift : faCartShopping}
                                style={{ color: buyType === "GIFT" ? "#ec4899" : "var(--accent-primary)" }}
                            />
                            <h3>{buyType === "GIFT" ? tr("Received as gift", "Reçu en cadeau") : tr("Add purchase", "Ajouter un achat")}</h3>
                        </div>
                        <button
                            type="button"
                            className="tx-dialog__header-close"
                            onClick={() => setPurchaseModalOpen(false)}
                            aria-label="Fermer"
                        >
                            <FontAwesomeIcon icon={faXmark} />
                        </button>
                    </div>

                    <div className="cover-dialog__tabs">
                        <button
                            type="button"
                            className={`cover-dialog__tab ${buyType === "BOUGHT" ? "cover-dialog__tab--active" : ""}`}
                            onClick={() => {
                                setBuyType("BOUGHT");
                                if (!buyPrice && book?.price) {
                                    setBuyPrice(String(book.price));
                                }
                            }}
                            disabled={submittingTx}
                        >
                            <FontAwesomeIcon icon={faCartShopping} />
                            <span>{tr("Purchase", "Achat")}</span>
                        </button>
                        <button
                            type="button"
                            className={`cover-dialog__tab ${buyType === "GIFT" ? "cover-dialog__tab--active" : ""}`}
                            onClick={() => setBuyType("GIFT")}
                            disabled={submittingTx}
                        >
                            <FontAwesomeIcon icon={faGift} />
                            <span>{tr("Gift received", "Cadeau reçu")}</span>
                        </button>
                    </div>

                    {book && (
                        <p style={{ margin: "0 0 4px", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                            {buyType === "GIFT" ? (
                                <>{tr("Enter gift details for", "Renseignez les détails du cadeau pour")}<br /><strong>« {book.title} »</strong> :</>
                            ) : (
                                <>{tr("Enter purchase details for", "Renseignez les détails d'achat pour")} <strong>« {book.title} »</strong> :</>
                            )}
                        </p>
                    )}

                    <form className="tx-dialog__form" onSubmit={handleSavePurchase}>
                        {buyType === "BOUGHT" ? (
                            <div className="tx-dialog__grid">
                                <div className="tx-dialog__field">
                                    <label>
                                        <FontAwesomeIcon icon={faCalendarDays} />
                                        <span>{tr("Purchase date *", "Date d'achat *")}</span>
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={buyDate}
                                        onChange={(e) => setBuyDate(e.target.value)}
                                    />
                                </div>

                                <div className="tx-dialog__field">
                                    <label>
                                        <FontAwesomeIcon icon={faTag} />
                                        <span>{tr("Purchase price (€)", "Prix d'achat (€)")}</span>
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder={tr("e.g. 15.00", "ex: 15.00")}
                                        value={buyPrice}
                                        onChange={(e) => setBuyPrice(e.target.value)}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="tx-dialog__field">
                                <label>
                                    <FontAwesomeIcon icon={faCalendarDays} />
                                    <span>{tr("Date received (optional)", "Date de réception (optionnelle)")}</span>
                                </label>
                                <div className="tx-dialog__precision-group" role="group" aria-label={tr("Date precision", "Précision de la date")}>
                                    <button
                                        type="button"
                                        className={`tx-dialog__precision-btn ${giftDatePrecision === "NONE" ? "tx-dialog__precision-btn--active" : ""}`}
                                        onClick={() => setGiftDatePrecision("NONE")}
                                        disabled={submittingTx}
                                    >
                                        {tr("None", "Aucune")}
                                    </button>
                                    <button
                                        type="button"
                                        className={`tx-dialog__precision-btn ${giftDatePrecision === "YEAR" ? "tx-dialog__precision-btn--active" : ""}`}
                                        onClick={() => setGiftDatePrecision("YEAR")}
                                        disabled={submittingTx}
                                    >
                                        {tr("Year", "Année")}
                                    </button>
                                    <button
                                        type="button"
                                        className={`tx-dialog__precision-btn ${giftDatePrecision === "MONTH" ? "tx-dialog__precision-btn--active" : ""}`}
                                        onClick={() => setGiftDatePrecision("MONTH")}
                                        disabled={submittingTx}
                                    >
                                        {tr("Month + Year", "Mois + Année")}
                                    </button>
                                    <button
                                        type="button"
                                        className={`tx-dialog__precision-btn ${giftDatePrecision === "DAY" ? "tx-dialog__precision-btn--active" : ""}`}
                                        onClick={() => setGiftDatePrecision("DAY")}
                                        disabled={submittingTx}
                                    >
                                        {tr("Full date", "Date complète")}
                                    </button>
                                </div>

                                {giftDatePrecision === "YEAR" && (
                                    <input
                                        type="number"
                                        min={1900}
                                        max={2100}
                                        step={1}
                                        required
                                        placeholder={tr("e.g. 2024", "ex : 2024")}
                                        value={giftYear}
                                        onChange={(e) => setGiftYear(e.target.value)}
                                        style={{ marginTop: "6px" }}
                                    />
                                )}

                                {giftDatePrecision === "MONTH" && (
                                    <div className="tx-dialog__grid" style={{ marginTop: "6px" }}>
                                        <select
                                            value={giftMonth}
                                            onChange={(e) => setGiftMonth(e.target.value)}
                                            aria-label={tr("Month", "Mois")}
                                        >
                                            {Array.from({ length: 12 }, (_, idx) => {
                                                const mVal = String(idx + 1).padStart(2, "0");
                                                const label = new Date(2000, idx, 1).toLocaleDateString(locale, { month: "long" });
                                                return (
                                                    <option key={mVal} value={mVal}>
                                                        {label.charAt(0).toUpperCase() + label.slice(1)}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                        <input
                                            type="number"
                                            min={1900}
                                            max={2100}
                                            step={1}
                                            required
                                            placeholder={tr("e.g. 2024", "ex : 2024")}
                                            value={giftYear}
                                            onChange={(e) => setGiftYear(e.target.value)}
                                            aria-label={tr("Year", "Année")}
                                        />
                                    </div>
                                )}

                                {giftDatePrecision === "DAY" && (
                                    <input
                                        type="date"
                                        required
                                        value={buyDate}
                                        onChange={(e) => setBuyDate(e.target.value)}
                                        style={{ marginTop: "6px" }}
                                    />
                                )}
                            </div>
                        )}

                        <div className="tx-dialog__field">
                            <label>
                                <FontAwesomeIcon icon={buyType === "GIFT" ? faGift : faStore} />
                                <span>{buyType === "GIFT" ? tr("Gifted by / Occasion", "Offert par / Occasion") : tr("Purchase location", "Lieu d'achat")}</span>
                            </label>
                            <input
                                type="text"
                                placeholder={buyType === "GIFT" ? tr("e.g. Birthday, Christmas, From a friend...", "ex: Anniversaire, Noël, Offert par un ami...") : tr("e.g. Local bookstore, Fnac, Vinted...", "ex: Librairie Album, Fnac, Vinted, Brocante...")}
                                value={buyLocation}
                                onChange={(e) => setBuyLocation(e.target.value)}
                            />
                        </div>

                        <div className="tx-dialog__field">
                            <label>
                                <FontAwesomeIcon icon={faNoteSticky} />
                                <span>{tr("Memo / Notes", "Mémo / Remarques")}</span>
                            </label>
                            <textarea
                                placeholder={tr("e.g. Special edition, mint condition, signed...", "ex: Édition spéciale, état neuf, dédicacé...")}
                                value={buyMemo}
                                onChange={(e) => setBuyMemo(e.target.value)}
                            />
                        </div>

                        <div className="tx-dialog__actions">
                            <button
                                type="button"
                                className="tx-dialog__btn-cancel"
                                onClick={() => setPurchaseModalOpen(false)}
                            >
                                {tr("Cancel", "Annuler")}
                            </button>
                            <button
                                type="submit"
                                disabled={submittingTx}
                                className={`tx-dialog__btn-submit ${buyType === "GIFT" ? "tx-dialog__btn-submit--gift" : "tx-dialog__btn-submit--bought"}`}
                            >
                                <FontAwesomeIcon icon={faCheck} />
                                <span>
                                    {submittingTx
                                        ? tr("Saving...", "Enregistrement...")
                                        : buyType === "GIFT"
                                            ? tr("Save gift", "Enregistrer le cadeau")
                                            : tr("Save purchase", "Enregistrer l'achat")}
                                </span>
                            </button>
                        </div>
                    </form>
                </div>
            </Dialog>

            {/* Listing Modal */}
            <Dialog
                open={listingModalOpen}
                onClose={() => setListingModalOpen(false)}
                PaperProps={{
                    style: {
                        backgroundColor: "var(--bg-surface, #1e1e24)",
                        border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))",
                        borderRadius: "16px",
                        maxWidth: "460px",
                        width: "100%",
                        padding: "24px",
                        color: "var(--text-primary)",
                        overflow: "visible"
                    }
                }}
            >
                <div className="tx-dialog">
                    <div className="tx-dialog__header">
                        <div className="tx-dialog__header-title">
                            <FontAwesomeIcon icon={faTag} style={{ color: "var(--accent-primary)" }} />
                            <h3>{tr("List for sale", "Mettre en vente")}</h3>
                        </div>
                        <button
                            type="button"
                            className="tx-dialog__header-close"
                            onClick={() => setListingModalOpen(false)}
                            aria-label={tr("Close", "Fermer")}
                        >
                            <FontAwesomeIcon icon={faXmark} />
                        </button>
                    </div>

                    {book && (
                        <p style={{ margin: "0 0 4px", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                            {tr("Enter listing details for", "Indiquez les informations de l'annonce pour")} <strong>« {book.title} »</strong> :
                        </p>
                    )}

                    <form className="tx-dialog__form" onSubmit={handleSaveListing}>
                        <div className="tx-dialog__field">
                            <label>
                                <FontAwesomeIcon icon={faCoins} />
                                <span>{tr("Listing price (€)", "Prix de mise en vente (€)")}</span>
                                <span style={{ fontSize: "0.75rem", fontWeight: 400, color: "var(--text-muted)" }}>{tr("(optional)", "(optionnel)")}</span>
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder={tr("e.g. 12.00", "ex: 12.00")}
                                value={listingPrice}
                                onChange={(e) => setListingPrice(e.target.value)}
                            />
                        </div>

                        <div className="tx-dialog__field">
                            <label>
                                <FontAwesomeIcon icon={faLink} />
                                <span>{tr("Listing URL", "Lien de l'annonce")}</span>
                                <span style={{ fontSize: "0.75rem", fontWeight: 400, color: "var(--text-muted)" }}>{tr("(optional)", "(optionnel)")}</span>
                            </label>
                            <input
                                type="url"
                                placeholder="https://..."
                                value={listingUrl}
                                onChange={(e) => setListingUrl(e.target.value)}
                            />
                        </div>

                        <div className="tx-dialog__actions">
                            <button
                                type="button"
                                className="tx-dialog__btn-cancel"
                                onClick={() => setListingModalOpen(false)}
                            >
                                {tr("Cancel", "Annuler")}
                            </button>
                            <button
                                type="submit"
                                disabled={submittingListing}
                                className="tx-dialog__btn-submit"
                            >
                                <FontAwesomeIcon icon={faCheck} />
                                <span>{submittingListing ? tr("Saving...", "Enregistrement...") : tr("List for sale", "Mettre en vente")}</span>
                            </button>
                        </div>
                    </form>
                </div>
            </Dialog>

            {/* Sale Modal */}
            <Dialog
                open={saleModalOpen}
                onClose={() => setSaleModalOpen(false)}
                PaperProps={{
                    style: {
                        backgroundColor: "var(--bg-surface, #1e1e24)",
                        border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))",
                        borderRadius: "16px",
                        maxWidth: "460px",
                        width: "100%",
                        padding: "24px",
                        color: "var(--text-primary)",
                        overflow: "visible"
                    }
                }}
            >
                <div className="tx-dialog">
                    <div className="tx-dialog__header">
                        <div className="tx-dialog__header-title">
                            <FontAwesomeIcon icon={faCoins} style={{ color: "var(--accent-primary)" }} />
                            <h3>{tr("Record sale", "Renseigner la vente")}</h3>
                        </div>
                        <button
                            type="button"
                            className="tx-dialog__header-close"
                            onClick={() => setSaleModalOpen(false)}
                            aria-label={tr("Close", "Fermer")}
                        >
                            <FontAwesomeIcon icon={faXmark} />
                        </button>
                    </div>

                    {book && (
                        <p style={{ margin: "0 0 4px", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                            {tr("Enter sale details for", "Renseignez les détails de la vente pour")} <strong>« {book.title} »</strong> :
                        </p>
                    )}

                    <form className="tx-dialog__form" onSubmit={handleSaveSale}>
                        <div className="tx-dialog__grid">
                            <div className="tx-dialog__field">
                                <label>
                                    <FontAwesomeIcon icon={faCalendarDays} />
                                    <span>{tr("Sale date", "Date de vente")}</span>
                                    <span style={{ fontSize: "0.75rem", fontWeight: 400, color: "var(--text-muted)" }}>{tr("(optional)", "(optionnel)")}</span>
                                </label>
                                <input
                                    type="date"
                                    value={sellDate}
                                    onChange={(e) => setSellDate(e.target.value)}
                                />
                            </div>

                            <div className="tx-dialog__field">
                                <label>
                                    <FontAwesomeIcon icon={faCoins} />
                                    <span>{tr("Sale price (€)", "Prix de vente (€)")}</span>
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder={tr("e.g. 12.00", "ex: 12.00")}
                                    value={sellPrice}
                                    onChange={(e) => setSellPrice(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="tx-dialog__field">
                            <label>
                                <FontAwesomeIcon icon={faStore} />
                                <span>{tr("Sale location / platform (optional)", "Lieu / Canal de vente (optionnel)")}</span>
                            </label>
                            <input
                                type="text"
                                placeholder={tr("e.g. Vinted, Flea market, Friend, etc.", "ex: Vinted, Brocante, Ami, etc.")}
                                value={sellLocation}
                                onChange={(e) => setSellLocation(e.target.value)}
                            />
                        </div>

                        <div className="tx-dialog__field">
                            <label>
                                <FontAwesomeIcon icon={faNoteSticky} />
                                <span>{tr("Memo / Notes (optional)", "Mémo / Remarques (optionnel)")}</span>
                            </label>
                            <textarea
                                placeholder={tr("e.g. Local pickup, sold as a bundle...", "ex: Remise en main propre, vendu en lot...")}
                                value={sellMemo}
                                onChange={(e) => setSellMemo(e.target.value)}
                            />
                        </div>

                        <div className="tx-dialog__actions">
                            <button
                                type="button"
                                className="tx-dialog__btn-cancel"
                                onClick={() => setSaleModalOpen(false)}
                            >
                                {tr("Cancel", "Annuler")}
                            </button>
                            <button
                                type="submit"
                                disabled={submittingTx}
                                className="tx-dialog__btn-submit tx-dialog__btn-submit--sold"
                            >
                                <FontAwesomeIcon icon={faCheck} />
                                <span>{submittingTx ? tr("Confirming...", "Validation...") : tr("Confirm sale", "Valider la vente")}</span>
                            </button>
                        </div>
                    </form>
                </div>
            </Dialog>
        </div>
    );
}
