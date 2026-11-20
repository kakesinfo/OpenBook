import { useState, useEffect } from "react";
import { useLocation } from "react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import AddBookToLibraryModal from "./AddBookToLibraryModal.tsx";
import CreateMissingBookModal, { InitialBookData } from "./CreateMissingBookModal.tsx";
import useLanguage from "../../hooks/UseLanguage.tsx";
import "./FloatingActionButton.scss";

export default function FloatingActionButton() {
    const location = useLocation();
    const { tr } = useLanguage();
    const isSalesPage = location.pathname.startsWith("/app/sales") || location.pathname.startsWith("/app/ventes");
    const isLoansPage = location.pathname.startsWith("/app/loans") || location.pathname.startsWith("/app/emprunts");

    const [addModalOpen, setAddModalOpen] = useState(false);
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [initialData, setInitialData] = useState<InitialBookData | string | undefined>(undefined);

    useEffect(() => {
        const handleOpenLoanModal = () => setAddModalOpen(true);
        window.addEventListener("open-loan-modal", handleOpenLoanModal);
        return () => window.removeEventListener("open-loan-modal", handleOpenLoanModal);
    }, []);

    const handleOpenCreateModal = (data?: InitialBookData | string) => {
        setAddModalOpen(false);
        setInitialData(data);
        setCreateModalOpen(true);
    };

    const fabLabel = isLoansPage
        ? tr("Search for a book to lend / borrow", "Chercher un livre à prêter / emprunter")
        : isSalesPage
            ? tr("Search for a book to list for sale", "Chercher un livre à mettre en vente")
            : tr("Add a book to my library", "Ajouter un livre à ma bibliothèque");

    const modalMode = isLoansPage ? "loan" : isSalesPage ? "sale" : "library";

    return (
        <>
            <div className="fab-container">
                {/* Main Floating Action Button directly opens search modal */}
                <button
                    type="button"
                    className={`fab-main-btn ${isSalesPage ? "fab-main-btn--sales" : ""} ${isLoansPage ? "fab-main-btn--loans" : ""}`}
                    onClick={() => setAddModalOpen(true)}
                    title={fabLabel}
                    aria-label={fabLabel}
                >
                    <span className="fab-main-icon">
                        <FontAwesomeIcon icon={faPlus} />
                    </span>
                </button>
            </div>

            {/* Modal: Add existing book to library, put book for sale, or lend/borrow book */}
            <AddBookToLibraryModal
                open={addModalOpen}
                onClose={() => setAddModalOpen(false)}
                onOpenCreateBook={handleOpenCreateModal}
                mode={modalMode}
            />

            {/* Modal: Create a missing book */}
            <CreateMissingBookModal
                open={createModalOpen}
                onClose={() => setCreateModalOpen(false)}
                initialData={initialData}
            />
        </>
    );
}
