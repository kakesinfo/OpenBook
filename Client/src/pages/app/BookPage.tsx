import { useParams, Link, useNavigate } from "react-router";
import { ReactNode, useEffect, useRef, useState } from "react";
import BookDTO from "../../dto/Book.dto";
import SeriesDTO from "../../dto/Series.dto.ts";
import UserBookTransactionDTO from "../../dto/UserBookTransaction.dto.ts";
import { useSnackbar } from "notistack";
import useSession, { SessionContextType } from "../../hooks/UseSession.tsx";
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
    faClone,
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
    IconDefinition
} from "@fortawesome/free-solid-svg-icons";
import { Dialog } from "@mui/material";

import "./BookPage.scss";
import { WrapperHeader } from "../../components/Wrapper/Wrapper.tsx";

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
    emptyLabel = "-- Aucun --",
    openDirection = "down"
}: {
    value: string;
    onChange: (val: string) => void;
    options: string[];
    placeholder?: string;
    emptyLabel?: string;
    openDirection?: "down" | "up";
}) {
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
            emptyLabel.toLowerCase().includes(normalizedQuery));

    const showEmptyOption = !isFiltering || normalizedQuery === "" || isNoneQuery;

    const exactMatchExists = options.some(
        (opt) => opt.toLowerCase() === value.trim().toLowerCase()
    ) || ["aucun", "aucune"].includes(value.trim().toLowerCase());

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
                            title="Effacer"
                            aria-label="Effacer"
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
                        aria-label="Ouvrir la liste"
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
                            <span>{emptyLabel}</span>
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
                            <span>Utiliser « {value.trim()} »</span>
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
                            <div className="searchable-select__empty">Aucune option disponible</div>
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
    const [isOpen, setIsOpen] = useState(false);
    const [isFiltering, setIsFiltering] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const containerRef = useRef<HTMLDivElement | null>(null);

    const selectedSeries = seriesList.find((s) => Number(s.id) === Number(selectedId)) || null;
    const selectedDisplay = selectedSeries
        ? `${selectedSeries.name} (${selectedSeries.category || "Comics"})`
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
                    placeholder="Rechercher ou sélectionner une série..."
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
                            title="Effacer"
                            aria-label="Effacer"
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
                        aria-label="Ouvrir la liste des séries"
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
                            <span>-- Aucune série --</span>
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
                            <span>Créer la nouvelle série « {searchQuery.trim()} »</span>
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
                                        {s.name} <small style={{ color: "var(--text-muted)" }}>({s.category || "Comics"})</small>
                                    </span>
                                    {isSelected && <FontAwesomeIcon icon={faCheck} className="searchable-select__check" />}
                                </button>
                            );
                        })
                    ) : (
                        <div className="searchable-select__empty">Aucune série trouvée</div>
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
        case "series": return "Série";
        case "author": return "Auteur";
        case "editor": return "Maison d'édition";
        case "collection": return "Collection";
    }
}

function ChangeBookStatusButton({
    status,
    setStatus,
    newStatus,
    children,
    bookId,
    session,
    icon
}: {
    status: string | null;
    setStatus: (s: string | null) => void;
    newStatus: string;
    children: ReactNode;
    bookId?: string;
    session?: SessionContextType;
    icon?: IconDefinition;
}) {
    const [processing, setProcessing] = useState(false);
    const isCurrent = status === newStatus;

    const handleClick = async () => {
        if (!newStatus || !bookId || !session || processing) return;
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

    const [book, setBook] = useState<BookDTO | null>(null);
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
    const [submittingTx, setSubmittingTx] = useState(false);

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

    // Buy modal form
    const [buyDate, setBuyDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
    const [buyPrice, setBuyPrice] = useState<string>("");
    const [buyLocation, setBuyLocation] = useState<string>("");
    const [buyMemo, setBuyMemo] = useState<string>("");

    // Sale modal form
    const [sellDate, setSellDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
    const [sellPrice, setSellPrice] = useState<string>("");
    const [sellLocation, setSellLocation] = useState<string>("");
    const [sellMemo, setSellMemo] = useState<string>("");

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

    const handleOpenPurchaseModal = () => {
        setBuyDate(new Date().toISOString().split("T")[0]);
        setBuyPrice(book?.price ? String(book.price) : "");
        setBuyLocation("");
        setBuyMemo("");
        setPurchaseModalOpen(true);
    };

    const handleSavePurchase = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id || submittingTx) return;

        setSubmittingTx(true);
        try {
            const parsedPrice = buyPrice ? parseFloat(buyPrice) : null;
            const res = await session.customFetch(`/user/books/${encodeURIComponent(id)}/transactions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "BOUGHT",
                    date: buyDate,
                    price: parsedPrice,
                    location: buyLocation.trim() || null,
                    memo: buyMemo.trim() || null
                })
            });

            if (res.ok) {
                enqueueSnackbar("Achat enregistré avec succès !", { variant: "success" });
                setPurchaseModalOpen(false);
                fetchTransactions(id);
                if (bookStatus !== "OWNED" && bookStatus !== "FOR_SALE" && bookStatus !== "SOLD") {
                    setBookStatus("OWNED");
                }
            } else {
                enqueueSnackbar("Erreur lors de l'enregistrement de l'achat", { variant: "error" });
            }
        } catch (err: any) {
            enqueueSnackbar(`Erreur: ${err.message}`, { variant: "error" });
        } finally {
            setSubmittingTx(false);
        }
    };

    const handleOpenSaleModal = () => {
        setSellDate(new Date().toISOString().split("T")[0]);
        setSellPrice(book?.price ? String(book.price) : "");
        setSellLocation("");
        setSellMemo("");
        setSaleModalOpen(true);
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
                    date: sellDate,
                    price: parsedPrice,
                    location: sellLocation.trim() || null,
                    memo: sellMemo.trim() || null
                })
            });

            if (res.ok) {
                enqueueSnackbar("Vente enregistrée avec succès !", { variant: "success" });
                setSaleModalOpen(false);
                setBookStatus("SOLD");
                fetchTransactions(id);
            } else {
                enqueueSnackbar("Erreur lors de l'enregistrement de la vente", { variant: "error" });
            }
        } catch (err: any) {
            enqueueSnackbar(`Erreur: ${err.message}`, { variant: "error" });
        } finally {
            setSubmittingTx(false);
        }
    };

    const handleDeleteTransaction = async (txId: number) => {
        const confirm = window.confirm("Supprimer cette ligne d'historique ?");
        if (!confirm || !id) return;

        try {
            const res = await session.customFetch(`/user/transactions/${txId}`, { method: "DELETE" });
            if (res.ok) {
                enqueueSnackbar("Ligne supprimée", { variant: "info" });
                fetchTransactions(id);
            } else {
                enqueueSnackbar("Erreur lors de la suppression", { variant: "error" });
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
            enqueueSnackbar("Le titre de l'album est obligatoire", { variant: "warning" });
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
                enqueueSnackbar("Informations de l'album mises à jour avec succès !", { variant: "success" });
            } else {
                let errMsg = "Impossible de mettre à jour les informations de l'album";
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
            enqueueSnackbar("Veuillez sélectionner un fichier image valide (JPG, PNG, WebP...)", { variant: "warning" });
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
            enqueueSnackbar("Veuillez sélectionner une image depuis votre appareil", { variant: "warning" });
            return;
        }
        if (coverMode === "url" && !coverRemoteUrl.trim()) {
            enqueueSnackbar("Veuillez saisir l'URL d'une image", { variant: "warning" });
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
                enqueueSnackbar("Couverture mise à jour et optimisée !", { variant: "success" });
                setCoverModalOpen(false);
                if (coverPreviewUrl && coverPreviewUrl.startsWith("blob:")) {
                    URL.revokeObjectURL(coverPreviewUrl);
                }
                setCoverPreviewUrl(null);
                setCoverFile(null);
                setCoverRemoteUrl("");
            } else {
                let errMsg = "Impossible de mettre à jour la couverture";
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
                    enqueueSnackbar("Veuillez renseigner le nom de la série", { variant: "warning" });
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

                enqueueSnackbar(`Nouvelle série « ${createdSeries.name} » créée et associée`, { variant: "success" });
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
                    enqueueSnackbar("Erreur lors de l'association à la série", { variant: "error" });
                    setSavingSeries(false);
                    return;
                }

                enqueueSnackbar(selectedSeriesId ? "Série et tomaison associées avec succès" : "Série dissociée", { variant: "success" });
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

    const handleRemoveFromSeries = async () => {
        if (!id || savingSeries) return;
        const confirm = window.confirm("Retirer cet album de sa série ?");
        if (!confirm) return;

        setSavingSeries(true);
        try {
            const updateRes = await session.customFetch(`/books/${encodeURIComponent(id)}/series`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ seriesId: null, volume: null })
            });

            if (updateRes.ok) {
                enqueueSnackbar("Album retiré de la série", { variant: "info" });
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

    const handleReadingStatusChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newStatus = event.target.value;
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
                        <span>Retour</span>
                    </button>
                </div>
            </WrapperHeader>

            <div className="book-page__content">
                {loading && (
                    <div className="book-page__state">
                        <p>Chargement des détails de l'ouvrage...</p>
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
                                        alt={`Couverture de ${book.title}`}
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
                                    title="Changer l'image de couverture de cet album"
                                >
                                    <FontAwesomeIcon icon={faCamera} />
                                    <span>Changer l'image</span>
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
                                                title={book.previousBook?.title ? `Tome précédent : ${book.previousBook.title}` : "Tome précédent"}
                                            >
                                                <FontAwesomeIcon icon={faChevronLeft} />
                                                <span>Précédent</span>
                                            </Link>
                                        ) : (
                                            <button
                                                type="button"
                                                disabled
                                                className="book-page__volume-nav-btn book-page__volume-nav-btn--disabled book-page__volume-nav-btn--prev"
                                                title="Tome précédent non disponible dans la bibliothèque"
                                            >
                                                <FontAwesomeIcon icon={faChevronLeft} />
                                                <span>Précédent</span>
                                            </button>
                                        )
                                    )}
                                    {showNext && (
                                        hasNext ? (
                                            <Link
                                                to={`/app/book/${book.nextBookId}`}
                                                className="book-page__volume-nav-btn book-page__volume-nav-btn--next"
                                                title={book.nextBook?.title ? `Tome suivant : ${book.nextBook.title}` : "Tome suivant"}
                                            >
                                                <span>Suivant</span>
                                                <FontAwesomeIcon icon={faChevronRight} />
                                            </Link>
                                        ) : (
                                            <button
                                                type="button"
                                                disabled
                                                className="book-page__volume-nav-btn book-page__volume-nav-btn--disabled book-page__volume-nav-btn--next"
                                                title="Tome suivant non disponible dans la bibliothèque"
                                            >
                                                <span>Suivant</span>
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
                                    title="Actions"
                                    aria-label="Menu d'actions"
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
                                            <span>Modifier</span>
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
                                            <span>Historique d'achat{transactions.length > 0 ? ` (${transactions.length})` : ""}</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Badges */}
                            {(book.series?.status || (book.series && book.volume != null) || book.series?.category || book.parentBookId) && (
                                <div className="book-page__tags">
                                    {book.series?.status && (
                                        <span className="book-page__tag book-page__tag--status">
                                            {getSeriesStatusLabel(book.series.status)}
                                        </span>
                                    )}
                                    {book.series && book.volume != null && (
                                        <span className="book-page__tag book-page__tag--volume">
                                            {book.series?.totalVolumes && book.series.totalVolumes > 1
                                                ? `Tome ${book.volume} sur ${Math.max(book.volume, book.series.totalVolumes)}`
                                                : `Tome ${book.volume}`}
                                        </span>
                                    )}
                                    {book.series?.category && (
                                        <span className="book-page__tag book-page__tag--category">
                                            {book.series.category}
                                        </span>
                                    )}
                                    {book.parentBookId && (
                                        <Link to={`/app/book/${book.parentBookId}`} className="book-page__tag book-page__tag--variant">
                                            <FontAwesomeIcon icon={faClone} />
                                            <span>Couverture variante</span>
                                        </Link>
                                    )}
                                </div>
                            )}

                            {/* Titles */}
                            <div className="book-page__headings">
                                {/* Série */}
                                {book.series?.name ? (
                                    <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "4px" }}>
                                        <h2 className="book-page__series-title" style={{ margin: 0 }}>
                                            <button
                                                type="button"
                                                className="book-page__entity-title-btn"
                                                onClick={() => openFollowModal("series", book.series?.id, book.series.name)}
                                                title={`Gérer le suivi de la série ${book.series.name}`}
                                            >
                                                <span>{book.series.name}</span>
                                                {book.series?.id && followStates[`series_${book.series.id}`] && (
                                                    <FontAwesomeIcon icon={faBell} className="book-page__followed-icon" />
                                                )}
                                            </button>
                                        </h2>
                                    </div>
                                ) : (
                                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px", flexWrap: "wrap" }}>
                                        <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Aucune série associée</span>
                                    </div>
                                )}

                                <div className="book-page__title-row">
                                    <h1 className="book-page__title">{book.title}</h1>
                                </div>

                                {/* Auteurs cliquables pour Follow */}
                                {book.authors && book.authors.length > 0 && (
                                    <div className="book-page__authors-row">
                                        <span>Par</span>
                                        {book.authors.map((author, idx) => {
                                            const fullName = `${author.firstname || ""} ${author.lastname || ""}`.trim();
                                            const isFollowed = author.id ? Boolean(followStates[`author_${author.id}`]) : false;
                                            return (
                                                <span key={`${author.id || idx}-${author.type || idx}`} className="book-page__author-item">
                                                    <button
                                                        type="button"
                                                        className="book-page__entity-inline-btn"
                                                        onClick={() => openFollowModal("author", author.id, fullName, author.type)}
                                                        title={`Gérer le suivi de ${fullName}`}
                                                    >
                                                        <span>{fullName}</span>
                                                        {isFollowed && (
                                                            <FontAwesomeIcon icon={faBell} className="book-page__followed-icon" />
                                                        )}
                                                    </button>
                                                    {idx < (book.authors?.length || 0) - 1 && (
                                                        <span className="book-page__author-sep">,</span>
                                                    )}
                                                </span>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {book.parentBookId && (
                                <div className="book-page__variant-banner">
                                    <FontAwesomeIcon icon={faClone} />
                                    <span>
                                        Ceci est une <strong>couverture variante</strong>.{" "}
                                        <Link to={`/app/book/${book.parentBookId}`}>
                                            Voir l'édition standard {book.parentBookTitle ? `(« ${book.parentBookTitle} »)` : ""}
                                        </Link>
                                    </span>
                                </div>
                            )}

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
                                        {bookStatus === "WISHLISTED" ? "Dans les souhaits" : "Liste de souhaits"}
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
                                        {bookStatus === "OWNED" ? "Dans la bibliothèque" : "Ajouter à la bibliothèque"}
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
                                    >
                                        {bookStatus === "FOR_SALE" ? "En vente" : (bookStatus === "SOLD" ? "Vendu (remettre en vente)" : "Mettre à vendre")}
                                    </ChangeBookStatusButton>
                                )}

                                {(bookStatus === "FOR_SALE" || bookStatus === "SOLD") && (
                                    <button
                                        type="button"
                                        className={`book-action-btn ${bookStatus === 'SOLD' ? 'book-action-btn--active' : ''}`}
                                        onClick={handleOpenSaleModal}
                                    >
                                        <FontAwesomeIcon icon={bookStatus === 'SOLD' ? faCheck : faCoins} />
                                        <span>{bookStatus === 'SOLD' ? 'Vendu' : 'Marquer comme vendu'}</span>
                                    </button>
                                )}

                                <div className={`book-reading-status-selector ${readingStatus && readingStatus.toUpperCase() !== "UNREAD" ? 'book-reading-status-selector--active' : ''}`}>
                                    <FontAwesomeIcon icon={faBookOpen} />
                                    <select
                                        value={readingStatus ? readingStatus.toUpperCase() : "UNREAD"}
                                        onChange={handleReadingStatusChange}
                                        aria-label="Statut de lecture"
                                    >
                                        <option value="UNREAD">Non lu</option>
                                        <option value="TO_READ">Pile à lire</option>
                                        <option value="READING">En cours de lecture</option>
                                        <option value="READ">Lu</option>
                                        <option value="ABANDONED">Abandonné</option>
                                    </select>
                                </div>
                            </div>

                            {/* Technical Details Card */}
                            <div className="book-page__specs-card">
                                <div className="book-page__specs-header">
                                    <h3 className="book-page__specs-title">Détails</h3>
                                </div>
                                <div className="book-page__specs-list">
                                    {/* Date de sortie */}
                                    {book.releaseDate && (
                                        <div className="book-page__spec-row">
                                            <span className="book-page__spec-label">
                                                <FontAwesomeIcon icon={faCalendarDays} className="book-page__spec-icon" /> Date de sortie
                                            </span>
                                            <span className="book-page__spec-value">
                                                {new Date(book.releaseDate).toLocaleDateString('fr-FR', {
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
                                                <FontAwesomeIcon icon={faBuilding} className="book-page__spec-icon" /> Éditeur
                                            </span>
                                            <div className="book-page__spec-value">
                                                <button
                                                    type="button"
                                                    className="book-page__spec-author-link"
                                                    onClick={() => openFollowModal("editor", book.editor?.id, book.editor!.name)}
                                                    title={`Gérer le suivi de l'éditeur ${book.editor.name}`}
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
                                                    title={`Gérer le suivi de la collection ${book.collection.name}`}
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
                                                <FontAwesomeIcon icon={faPenNib} className="book-page__spec-icon" /> Scénariste{scenaristes.length > 1 ? "s" : ""}
                                            </span>
                                            <div className="book-page__spec-value book-page__spec-authors">
                                                {scenaristes.map((a, i) => {
                                                    const name = `${a.firstname || ""} ${a.lastname || ""}`.trim();
                                                    const isFollowed = a.id ? Boolean(followStates[`author_${a.id}`]) : false;
                                                    return (
                                                        <span key={a.id || i} className="book-page__spec-author-item">
                                                            <button
                                                                type="button"
                                                                className="book-page__spec-author-link"
                                                                onClick={() => openFollowModal("author", a.id, name, "Scénariste")}
                                                                title={`Gérer le suivi de ${name}`}
                                                            >
                                                                <span>{name}</span>
                                                                {isFollowed && (
                                                                    <FontAwesomeIcon icon={faBell} className="book-page__followed-icon" />
                                                                )}
                                                            </button>
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
                                                <FontAwesomeIcon icon={faPencil} className="book-page__spec-icon" /> Dessinateur{dessinateurs.length > 1 ? "s" : ""}
                                            </span>
                                            <div className="book-page__spec-value book-page__spec-authors">
                                                {dessinateurs.map((a, i) => {
                                                    const name = `${a.firstname || ""} ${a.lastname || ""}`.trim();
                                                    const isFollowed = a.id ? Boolean(followStates[`author_${a.id}`]) : false;
                                                    return (
                                                        <span key={a.id || i} className="book-page__spec-author-item">
                                                            <button
                                                                type="button"
                                                                className="book-page__spec-author-link"
                                                                onClick={() => openFollowModal("author", a.id, name, "Dessinateur")}
                                                                title={`Gérer le suivi de ${name}`}
                                                            >
                                                                <span>{name}</span>
                                                                {isFollowed && (
                                                                    <FontAwesomeIcon icon={faBell} className="book-page__followed-icon" />
                                                                )}
                                                            </button>
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
                                                <FontAwesomeIcon icon={faPalette} className="book-page__spec-icon" /> Coloriste{coloristes.length > 1 ? "s" : ""}
                                            </span>
                                            <div className="book-page__spec-value book-page__spec-authors">
                                                {coloristes.map((a, i) => {
                                                    const name = `${a.firstname || ""} ${a.lastname || ""}`.trim();
                                                    const isFollowed = a.id ? Boolean(followStates[`author_${a.id}`]) : false;
                                                    return (
                                                        <span key={a.id || i} className="book-page__spec-author-item">
                                                            <button
                                                                type="button"
                                                                className="book-page__spec-author-link"
                                                                onClick={() => openFollowModal("author", a.id, name, "Coloriste")}
                                                                title={`Gérer le suivi de ${name}`}
                                                            >
                                                                <span>{name}</span>
                                                                {isFollowed && (
                                                                    <FontAwesomeIcon icon={faBell} className="book-page__followed-icon" />
                                                                )}
                                                            </button>
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
                                                <FontAwesomeIcon icon={faScaleBalanced} className="book-page__spec-icon" /> Poids
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
                                                <FontAwesomeIcon icon={faTags} className="book-page__spec-icon" /> Thèmes
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
                                                <FontAwesomeIcon icon={faTag} className="book-page__spec-icon" /> Prix
                                            </span>
                                            <span className="book-page__spec-value">{book.price} €</span>
                                        </div>
                                    ) : null}
                                </div>
                            </div>

                            {/* Variants / Alternative Covers Section */}
                            {((book.variants && book.variants.length > 0) || Boolean(book.parentBookId)) && (
                                <div className="book-page__variants-card">
                                    <div className="book-page__variants-header">
                                        <FontAwesomeIcon icon={faClone} />
                                        <h3>Éditions & Couvertures alternatives ({1 + (book.variants?.length || (book.parentBookId ? 1 : 0))})</h3>
                                    </div>
                                    <p className="book-page__variants-desc">
                                        Sélectionnez une version pour afficher sa couverture dédiée, son ISBN et ses spécifications :
                                    </p>
                                    <div className="book-page__variants-grid">
                                        {/* Standard / Parent Edition */}
                                        {book.parentBookId ? (
                                            <Link
                                                to={`/app/book/${book.parentBookId}`}
                                                className="book-page__variant-pill"
                                                title={`Édition standard : ${book.parentBookTitle || ""}`}
                                            >
                                                <div className="book-page__variant-pill-thumb">
                                                    <FontAwesomeIcon icon={faBookOpen} />
                                                </div>
                                                <div className="book-page__variant-pill-info">
                                                    <span className="book-page__variant-pill-badge">Édition standard</span>
                                                    <span className="book-page__variant-pill-title">{book.parentBookTitle || "Édition standard"}</span>
                                                </div>
                                            </Link>
                                        ) : (
                                            <div className="book-page__variant-pill book-page__variant-pill--active" title="Édition standard affichée">
                                                {book.coverUrl ? (
                                                    <img src={book.coverUrl} alt={book.title} className="book-page__variant-pill-img" />
                                                ) : (
                                                    <div className="book-page__variant-pill-fallback"><FontAwesomeIcon icon={faBookOpen} /></div>
                                                )}
                                                <div className="book-page__variant-pill-info">
                                                    <span className="book-page__variant-pill-badge book-page__variant-pill-badge--active">Standard (Actuel)</span>
                                                    <span className="book-page__variant-pill-title">{book.title}</span>
                                                    {book.price ? <span className="book-page__variant-pill-price">{book.price} €</span> : null}
                                                </div>
                                            </div>
                                        )}

                                        {/* Variants list */}
                                        {book.variants && book.variants.map((v) => {
                                            const isCurrent = String(v.id) === String(book.id);
                                            if (isCurrent) {
                                                return (
                                                    <div key={v.id} className="book-page__variant-pill book-page__variant-pill--active" title="Variante actuelle affichée">
                                                        {v.coverUrl ? (
                                                            <img src={v.coverUrl} alt={v.title} className="book-page__variant-pill-img" />
                                                        ) : (
                                                            <div className="book-page__variant-pill-fallback"><FontAwesomeIcon icon={faBookOpen} /></div>
                                                        )}
                                                        <div className="book-page__variant-pill-info">
                                                            <span className="book-page__variant-pill-badge book-page__variant-pill-badge--active">Variante (Actuel)</span>
                                                            <span className="book-page__variant-pill-title">{v.title}</span>
                                                            {v.price ? <span className="book-page__variant-pill-price">{v.price} €</span> : null}
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return (
                                                <Link
                                                    key={v.id}
                                                    to={`/app/book/${v.id}`}
                                                    className="book-page__variant-pill"
                                                    title={v.title}
                                                >
                                                    {v.coverUrl ? (
                                                        <img src={v.coverUrl} alt={v.title} className="book-page__variant-pill-img" />
                                                    ) : (
                                                        <div className="book-page__variant-pill-fallback"><FontAwesomeIcon icon={faBookOpen} /></div>
                                                    )}
                                                    <div className="book-page__variant-pill-info">
                                                        <span className="book-page__variant-pill-badge book-page__variant-pill-badge--alt">Variante</span>
                                                        <span className="book-page__variant-pill-title">{v.title}</span>
                                                        {v.price ? <span className="book-page__variant-pill-price">{v.price} €</span> : null}
                                                    </div>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
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
                            <h3>Modifier les informations du livre</h3>
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
                                <FontAwesomeIcon icon={faLayerGroup} /> Série &amp; Tomaison
                            </span>
                            {book?.series?.name ? (
                                <strong className="book-edit-dialog__series-name">
                                    {book.series.name}{book.volume != null ? ` — Tome ${book.volume}` : ""}
                                </strong>
                            ) : (
                                <span className="book-edit-dialog__series-empty">Aucune série associée (pas de tomaison)</span>
                            )}
                        </div>
                        <button
                            type="button"
                            className="book-edit-dialog__series-btn"
                            onClick={handleOpenSeriesModal}
                        >
                            <FontAwesomeIcon icon={book?.series?.name ? faPen : faPlus} />
                            <span>{book?.series?.name ? "Modifier la série / tome" : "Associer à une série"}</span>
                        </button>
                    </div>

                    <form className="book-edit-dialog__form" onSubmit={handleSaveBookInfo}>
                        {/* Titre de l'album */}
                        <div className="tx-dialog__field">
                            <label>
                                <FontAwesomeIcon icon={faBook} />
                                <span>Titre de l'album *</span>
                            </label>
                            <input
                                type="text"
                                required
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                placeholder="Titre de l'ouvrage"
                            />
                        </div>

                        {/* Date de sortie & ISBN / EAN sur la même ligne */}
                        <div className="book-edit-dialog__row book-edit-dialog__row--2col">
                            <div className="tx-dialog__field">
                                <label>
                                    <FontAwesomeIcon icon={faCalendarDays} />
                                    <span>Date de sortie</span>
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
                                    <span>Éditeur</span>
                                </label>
                                <SearchableSelect
                                    value={editEditorName}
                                    onChange={setEditEditorName}
                                    options={editorOptions.map((ed) => ed.name)}
                                    placeholder="Rechercher ou saisir un éditeur..."
                                />
                            </div>

                            <div className="tx-dialog__field">
                                <label>
                                    <FontAwesomeIcon icon={faLayerGroup} />
                                    <span>Collection</span>
                                </label>
                                <SearchableSelect
                                    value={editCollectionName}
                                    onChange={setEditCollectionName}
                                    options={collectionOptions.map((col) => col.name)}
                                    placeholder="Rechercher ou saisir une collection..."
                                    emptyLabel="-- Aucun (sans collection) --"
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
                                    <span>Poids (g)</span>
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
                                    <span>Largeur (mm)</span>
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
                                    <span>Hauteur (mm)</span>
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
                                    <span>Épaisseur (mm)</span>
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
                                    <span>Prix (€)</span>
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
                                    <span>Format / Type</span>
                                </label>
                                <SearchableSelect
                                    value={editType}
                                    onChange={setEditType}
                                    options={typeOptions}
                                    placeholder="Rechercher ou choisir un format..."
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
                                Annuler
                            </button>
                            <button
                                type="submit"
                                disabled={savingBookInfo}
                                className="tx-dialog__btn-submit tx-dialog__btn-submit--bought"
                            >
                                <FontAwesomeIcon icon={faCheck} />
                                <span>{savingBookInfo ? "Enregistrement..." : "Enregistrer les modifications"}</span>
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
                            <h3>Changer la couverture</h3>
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
                            Choisissez une nouvelle image pour <strong>« {book.title} »</strong>. Elle sera automatiquement redimensionnée et convertie en WebP par <code>service-media</code>.
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
                            <span>Fichier local</span>
                        </button>
                        <button
                            type="button"
                            className={`cover-dialog__tab ${coverMode === "url" ? "cover-dialog__tab--active" : ""}`}
                            onClick={() => setCoverMode("url")}
                            disabled={uploadingCover}
                        >
                            <FontAwesomeIcon icon={faLink} />
                            <span>Depuis une URL</span>
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
                                    {coverFile ? coverFile.name : "Cliquez ou glissez-déposez une image ici"}
                                </span>
                                <span className="cover-dialog__dropzone-hint">
                                    JPG, PNG, WebP (optimisé automatiquement en WebP)
                                </span>
                            </div>
                        ) : (
                            <div className="tx-dialog__field">
                                <label>
                                    <FontAwesomeIcon icon={faLink} />
                                    <span>URL de l'image *</span>
                                </label>
                                <input
                                    type="url"
                                    placeholder="https://exemple.com/couverture.jpg"
                                    value={coverRemoteUrl}
                                    onChange={(e) => setCoverRemoteUrl(e.target.value)}
                                    required
                                />
                            </div>
                        )}

                        <div className="cover-dialog__preview-section">
                            <div className="cover-dialog__preview-col">
                                <span className="cover-dialog__preview-label">Actuelle</span>
                                <div className="cover-dialog__preview-box">
                                    {book?.coverUrl ? (
                                        <img src={book.coverUrl} alt="Couverture actuelle" />
                                    ) : (
                                        <div className="cover-dialog__preview-empty">
                                            <FontAwesomeIcon icon={faBook} />
                                            <span>Aucune</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="cover-dialog__preview-col">
                                <span className="cover-dialog__preview-label">Nouvelle</span>
                                <div className="cover-dialog__preview-box cover-dialog__preview-box--new">
                                    {currentCoverPreview ? (
                                        <img src={currentCoverPreview} alt="Aperçu nouvelle couverture" />
                                    ) : (
                                        <div className="cover-dialog__preview-empty">
                                            <FontAwesomeIcon icon={faImage} />
                                            <span>Aperçu</span>
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
                                Annuler
                            </button>
                            <button
                                type="submit"
                                disabled={uploadingCover || (coverMode === "file" ? !coverFile : !coverRemoteUrl.trim())}
                                className="tx-dialog__btn-submit tx-dialog__btn-submit--bought"
                            >
                                <FontAwesomeIcon icon={faCheck} />
                                <span>{uploadingCover ? "Envoi vers service-media..." : "Enregistrer la couverture"}</span>
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
                        color: "var(--text-primary)"
                    }
                }}
            >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <FontAwesomeIcon icon={faLayerGroup} style={{ color: "var(--accent-primary)" }} />
                        <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>
                            {book?.series ? "Gérer la série de cet album" : "Associer à une série"}
                        </h3>
                    </div>
                    <button
                        type="button"
                        onClick={() => setSeriesModalOpen(false)}
                        style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "1.1rem" }}
                    >
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>

                {/* Tabs: Choose existing vs Create new */}
                <div style={{ display: "flex", gap: "8px", background: "rgba(255, 255, 255, 0.04)", padding: "4px", borderRadius: "8px", marginBottom: "16px" }}>
                    <button
                        type="button"
                        onClick={() => setSeriesModalMode("select")}
                        style={{
                            flex: 1,
                            padding: "6px 12px",
                            background: seriesModalMode === "select" ? "var(--accent-primary)" : "transparent",
                            color: seriesModalMode === "select" ? "#fff" : "var(--text-muted)",
                            border: "none",
                            borderRadius: "6px",
                            fontWeight: 600,
                            fontSize: "0.85rem",
                            cursor: "pointer"
                        }}
                    >
                        Série existante
                    </button>
                    <button
                        type="button"
                        onClick={() => setSeriesModalMode("create")}
                        style={{
                            flex: 1,
                            padding: "6px 12px",
                            background: seriesModalMode === "create" ? "var(--accent-primary)" : "transparent",
                            color: seriesModalMode === "create" ? "#fff" : "var(--text-muted)",
                            border: "none",
                            borderRadius: "6px",
                            fontWeight: 600,
                            fontSize: "0.85rem",
                            cursor: "pointer"
                        }}
                    >
                        + Nouvelle série
                    </button>
                </div>

                {seriesModalMode === "select" ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                        <div className="tx-dialog__field">
                            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                                Sélectionner une série
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
                                    Position dans la série (Tome n°)
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    value={selectedVolume}
                                    onChange={(e) => setSelectedVolume(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                    style={{
                                        width: "100%",
                                        padding: "10px 14px",
                                        background: "rgba(255, 255, 255, 0.05)",
                                        border: "1px solid var(--border-subtle)",
                                        borderRadius: "8px",
                                        color: "var(--text-primary)",
                                        outline: "none"
                                    }}
                                />
                            </div>
                        ) : (
                            <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                                Sans série associée, cet album n'aura pas de tomaison.
                            </p>
                        )}
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                        <div>
                            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                                Nom de la nouvelle série *
                            </label>
                            <input
                                type="text"
                                placeholder="ex: Batman Rebirth, Blackwater..."
                                value={newSeriesName}
                                onChange={(e) => setNewSeriesName(e.target.value)}
                                style={{
                                    width: "100%",
                                    padding: "10px 14px",
                                    background: "rgba(255, 255, 255, 0.05)",
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
                                    Catégorie
                                </label>
                                <select
                                    value={newSeriesCategory}
                                    onChange={(e) => setNewSeriesCategory(Number(e.target.value))}
                                    style={{
                                        width: "100%",
                                        padding: "10px 14px",
                                        background: "rgba(255, 255, 255, 0.05)",
                                        border: "1px solid var(--border-subtle)",
                                        borderRadius: "8px",
                                        color: "var(--text-primary)",
                                        outline: "none"
                                    }}
                                >
                                    <option value={3} style={{ background: "#1f2937", color: "#fff" }}>Comics</option>
                                    <option value={2} style={{ background: "#1f2937", color: "#fff" }}>Bande dessinée</option>
                                    <option value={4} style={{ background: "#1f2937", color: "#fff" }}>Manga</option>
                                    <option value={5} style={{ background: "#1f2937", color: "#fff" }}>Roman Graphique</option>
                                    <option value={1} style={{ background: "#1f2937", color: "#fff" }}>Roman</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                                    Position dans la série (Tome n°)
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    value={selectedVolume}
                                    onChange={(e) => setSelectedVolume(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                    style={{
                                        width: "100%",
                                        padding: "10px 14px",
                                        background: "rgba(255, 255, 255, 0.05)",
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
                                color: "#ef4444",
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
                            <span>Retirer de la série</span>
                        </button>
                    ) : <div />}

                    <div style={{ display: "flex", gap: "10px" }}>
                        <button
                            type="button"
                            onClick={() => setSeriesModalOpen(false)}
                            style={{
                                padding: "8px 16px",
                                background: "transparent",
                                border: "1px solid var(--border-subtle)",
                                color: "var(--text-muted)",
                                borderRadius: "8px",
                                cursor: "pointer",
                                fontWeight: 600
                            }}
                        >
                            Annuler
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
                            {savingSeries ? "Enregistrement..." : "Valider"}
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
                                        ? `Vous êtes abonné aux parutions de cet élément. Vous recevrez les actualités et nouveaux albums associés.`
                                        : `Abonnez-vous à cet élément pour être alerté des futures sorties et facilement le retrouver dans vos suivis.`}
                                </p>

                                <div className="follow-dialog__actions">
                                    <button
                                        type="button"
                                        className={`follow-dialog__btn ${isFollowed ? "follow-dialog__btn--unfollow" : "follow-dialog__btn--follow"}`}
                                        onClick={handleToggleFollow}
                                        disabled={followProcessing}
                                    >
                                        <FontAwesomeIcon icon={isFollowed ? faBellSlash : faBell} />
                                        <span>{isFollowed ? "Ne plus suivre" : "Suivre"}</span>
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
                            <h3>Historique d'achat {transactions.length > 0 ? `(${transactions.length})` : ""}</h3>
                        </div>
                        <div className="book-page__transactions-header-actions">
                            <button
                                type="button"
                                className="book-page__tx-btn book-page__tx-btn--buy"
                                onClick={handleOpenPurchaseModal}
                                title="Ajouter un achat pour cet album"
                            >
                                <FontAwesomeIcon icon={faCartShopping} />
                                <span>Ajouter un achat</span>
                            </button>
                            <button
                                type="button"
                                className="book-page__tx-btn book-page__tx-btn--sell"
                                onClick={handleOpenSaleModal}
                                title="Renseigner une vente pour cet album"
                            >
                                <FontAwesomeIcon icon={faCoins} />
                                <span>Renseigner une vente</span>
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
                                    <span>Total acheté :</span>
                                    <strong>{totalBought.toFixed(2).replace('.', ',')} €</strong>
                                </div>
                            )}
                            {hasSold && (
                                <div className="book-page__summary-pill book-page__summary-pill--sold">
                                    <span>Total vendu :</span>
                                    <strong>{totalSold.toFixed(2).replace('.', ',')} €</strong>
                                </div>
                            )}
                            {hasBought && hasSold && (
                                <div className="book-page__summary-pill">
                                    <span>Solde :</span>
                                    <strong style={{ color: totalSold >= totalBought ? "#34d399" : "#f87171" }}>
                                        {(totalSold - totalBought >= 0 ? "+" : "") + (totalSold - totalBought).toFixed(2).replace('.', ',')} €
                                    </strong>
                                </div>
                            )}
                        </div>
                    )}

                    {loadingTransactions ? (
                        <div className="book-page__transactions-empty">
                            <p>Chargement de l'historique...</p>
                        </div>
                    ) : transactions.length === 0 ? (
                        <div className="book-page__transactions-empty">
                            <p>Aucun historique d'achat ou de vente renseigné pour cet album.</p>
                            <div style={{ marginTop: "10px" }}>
                                <button
                                    type="button"
                                    className="book-page__tx-btn book-page__tx-btn--buy"
                                    onClick={handleOpenPurchaseModal}
                                >
                                    <FontAwesomeIcon icon={faCartShopping} />
                                    <span>Ajouter un premier achat</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="book-page__transactions-list">
                            {transactions.map((tx) => {
                                const isBuy = tx.type === "BOUGHT";
                                return (
                                    <div key={tx.id} className="book-page__tx-item">
                                        <div className="book-page__tx-left">
                                            <span className={`book-page__tx-badge ${isBuy ? 'book-page__tx-badge--bought' : 'book-page__tx-badge--sold'}`}>
                                                <FontAwesomeIcon icon={isBuy ? faCartShopping : faCoins} />
                                                <span>{isBuy ? "Acheté" : "Vendu"}</span>
                                            </span>

                                            <div className="book-page__tx-details">
                                                <div className="book-page__tx-date-location">
                                                    <span>
                                                        {tx.date
                                                            ? new Date(tx.date + 'T00:00:00').toLocaleDateString('fr-FR', {
                                                                day: 'numeric',
                                                                month: 'short',
                                                                year: 'numeric'
                                                            })
                                                            : (tx.createdAt
                                                                ? new Date(tx.createdAt).toLocaleDateString('fr-FR', {
                                                                    day: 'numeric',
                                                                    month: 'short',
                                                                    year: 'numeric'
                                                                })
                                                                : "Date non renseignée")}
                                                    </span>

                                                    {tx.location && (
                                                        <span className="book-page__tx-location" title={isBuy ? "Lieu d'achat" : "Canal / Acheteur"}>
                                                            <FontAwesomeIcon icon={faStore} />
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
                                            <span className={`book-page__tx-price ${isBuy ? 'book-page__tx-price--bought' : 'book-page__tx-price--sold'}`}>
                                                {tx.price != null ? `${Number(tx.price).toFixed(2).replace('.', ',')} €` : "- €"}
                                            </span>

                                            <button
                                                type="button"
                                                className="book-page__tx-delete"
                                                onClick={() => handleDeleteTransaction(tx.id)}
                                                title="Supprimer cette ligne"
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

            {/* Purchase Modal */}
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
                        color: "var(--text-primary)"
                    }
                }}
            >
                <div className="tx-dialog">
                    <div className="tx-dialog__header">
                        <div className="tx-dialog__header-title">
                            <FontAwesomeIcon icon={faCartShopping} style={{ color: "#10b981" }} />
                            <h3>Ajouter un achat</h3>
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

                    {book && (
                        <p style={{ margin: "0 0 4px", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                            Renseignez les détails d'achat pour <strong>« {book.title} »</strong> :
                        </p>
                    )}

                    <form className="tx-dialog__form" onSubmit={handleSavePurchase}>
                        <div className="tx-dialog__grid">
                            <div className="tx-dialog__field">
                                <label>
                                    <FontAwesomeIcon icon={faCalendarDays} />
                                    <span>Date d'achat *</span>
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
                                    <span>Prix d'achat (€)</span>
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="ex: 15.00"
                                    value={buyPrice}
                                    onChange={(e) => setBuyPrice(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="tx-dialog__field">
                            <label>
                                <FontAwesomeIcon icon={faStore} />
                                <span>Lieu d'achat</span>
                            </label>
                            <input
                                type="text"
                                placeholder="ex: Librairie Album, Fnac, Vinted, Brocante..."
                                value={buyLocation}
                                onChange={(e) => setBuyLocation(e.target.value)}
                            />
                        </div>

                        <div className="tx-dialog__field">
                            <label>
                                <FontAwesomeIcon icon={faNoteSticky} />
                                <span>Mémo / Remarques</span>
                            </label>
                            <textarea
                                placeholder="ex: Édition spéciale, état neuf, dédicacé..."
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
                                Annuler
                            </button>
                            <button
                                type="submit"
                                disabled={submittingTx}
                                className="tx-dialog__btn-submit tx-dialog__btn-submit--bought"
                            >
                                <FontAwesomeIcon icon={faCheck} />
                                <span>{submittingTx ? "Enregistrement..." : "Enregistrer l'achat"}</span>
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
                        color: "var(--text-primary)"
                    }
                }}
            >
                <div className="tx-dialog">
                    <div className="tx-dialog__header">
                        <div className="tx-dialog__header-title">
                            <FontAwesomeIcon icon={faCoins} style={{ color: "#f59e0b" }} />
                            <h3>Renseigner la vente</h3>
                        </div>
                        <button
                            type="button"
                            className="tx-dialog__header-close"
                            onClick={() => setSaleModalOpen(false)}
                            aria-label="Fermer"
                        >
                            <FontAwesomeIcon icon={faXmark} />
                        </button>
                    </div>

                    {book && (
                        <p style={{ margin: "0 0 4px", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                            Renseignez les détails de la vente pour <strong>« {book.title} »</strong> :
                        </p>
                    )}

                    <form className="tx-dialog__form" onSubmit={handleSaveSale}>
                        <div className="tx-dialog__grid">
                            <div className="tx-dialog__field">
                                <label>
                                    <FontAwesomeIcon icon={faCalendarDays} />
                                    <span>Date de vente *</span>
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={sellDate}
                                    onChange={(e) => setSellDate(e.target.value)}
                                />
                            </div>

                            <div className="tx-dialog__field">
                                <label>
                                    <FontAwesomeIcon icon={faCoins} />
                                    <span>Prix de vente (€)</span>
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="ex: 12.00"
                                    value={sellPrice}
                                    onChange={(e) => setSellPrice(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="tx-dialog__field">
                            <label>
                                <FontAwesomeIcon icon={faStore} />
                                <span>Lieu / Canal de vente (optionnel)</span>
                            </label>
                            <input
                                type="text"
                                placeholder="ex: Vinted, Brocante, Ami, etc."
                                value={sellLocation}
                                onChange={(e) => setSellLocation(e.target.value)}
                            />
                        </div>

                        <div className="tx-dialog__field">
                            <label>
                                <FontAwesomeIcon icon={faNoteSticky} />
                                <span>Mémo / Remarques (optionnel)</span>
                            </label>
                            <textarea
                                placeholder="ex: Remise en main propre, vendu en lot..."
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
                                Annuler
                            </button>
                            <button
                                type="submit"
                                disabled={submittingTx}
                                className="tx-dialog__btn-submit tx-dialog__btn-submit--sold"
                            >
                                <FontAwesomeIcon icon={faCheck} />
                                <span>{submittingTx ? "Validation..." : "Valider la vente"}</span>
                            </button>
                        </div>
                    </form>
                </div>
            </Dialog>
        </div>
    );
}
