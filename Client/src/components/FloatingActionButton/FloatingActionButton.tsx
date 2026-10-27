import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import AddBookToLibraryModal from "./AddBookToLibraryModal.tsx";
import CreateMissingBookModal from "./CreateMissingBookModal.tsx";
import "./FloatingActionButton.scss";

export default function FloatingActionButton() {
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [initialTitle, setInitialTitle] = useState("");

    const handleOpenCreateModal = (title?: string) => {
        setAddModalOpen(false);
        setInitialTitle(title || "");
        setCreateModalOpen(true);
    };

    return (
        <>
            <div className="fab-container">
                {/* Main Floating Action Button directly opens search modal */}
                <button
                    type="button"
                    className="fab-main-btn"
                    onClick={() => setAddModalOpen(true)}
                    title="Ajouter un livre à ma bibliothèque"
                    aria-label="Ajouter un livre à ma bibliothèque"
                >
                    <span className="fab-main-icon">
                        <FontAwesomeIcon icon={faPlus} />
                    </span>
                </button>
            </div>

            {/* Modal: Add existing book to library */}
            <AddBookToLibraryModal
                open={addModalOpen}
                onClose={() => setAddModalOpen(false)}
                onOpenCreateBook={handleOpenCreateModal}
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
