import { useState } from "react";
import { useLocation } from "react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import AddBookToLibraryModal from "./AddBookToLibraryModal.tsx";
import CreateMissingBookModal from "./CreateMissingBookModal.tsx";
import "./FloatingActionButton.scss";

export default function FloatingActionButton() {
    const location = useLocation();
    const isSalesPage = location.pathname.startsWith("/app/sales") || location.pathname.startsWith("/app/ventes");

    const [addModalOpen, setAddModalOpen] = useState(false);
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [initialTitle, setInitialTitle] = useState("");

    const handleOpenCreateModal = (title?: string) => {
        setAddModalOpen(false);
        setInitialTitle(title || "");
        setCreateModalOpen(true);
    };

    const fabLabel = isSalesPage
        ? "Chercher un livre à mettre en vente"
        : "Ajouter un livre à ma bibliothèque";

    return (
        <>
            <div className="fab-container">
                {/* Main Floating Action Button directly opens search modal */}
                <button
                    type="button"
                    className={`fab-main-btn ${isSalesPage ? "fab-main-btn--sales" : ""}`}
                    onClick={() => setAddModalOpen(true)}
                    title={fabLabel}
                    aria-label={fabLabel}
                >
                    <span className="fab-main-icon">
                        <FontAwesomeIcon icon={faPlus} />
                    </span>
                </button>
            </div>

            {/* Modal: Add existing book to library or put book for sale */}
            <AddBookToLibraryModal
                open={addModalOpen}
                onClose={() => setAddModalOpen(false)}
                onOpenCreateBook={handleOpenCreateModal}
                mode={isSalesPage ? "sale" : "library"}
            />

            {/* Modal: Create a missing book */}
            <CreateMissingBookModal
                open={createModalOpen}
                onClose={() => setCreateModalOpen(false)}
                initialTitle={initialTitle}
            />
        </>
    );
}
