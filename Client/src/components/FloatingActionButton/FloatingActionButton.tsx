import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faPlus,
    faMagnifyingGlass,
    faPenNib
} from "@fortawesome/free-solid-svg-icons";
import AddBookToLibraryModal from "./AddBookToLibraryModal.tsx";
import CreateMissingBookModal from "./CreateMissingBookModal.tsx";
import "./FloatingActionButton.scss";

export default function FloatingActionButton() {
    const [menuOpen, setMenuOpen] = useState(false);
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [createModalOpen, setCreateModalOpen] = useState(false);

    // Close menu when escape key pressed
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && menuOpen) {
                setMenuOpen(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [menuOpen]);

    const handleToggleMenu = () => {
        setMenuOpen((prev) => !prev);
    };

    const handleOpenAddModal = () => {
        setMenuOpen(false);
        setAddModalOpen(true);
    };

    const handleOpenCreateModal = () => {
        setMenuOpen(false);
        setCreateModalOpen(true);
    };

    return (
        <>
            {/* Backdrop when menu is open */}
            {menuOpen && (
                <div
                    className="fab-backdrop"
                    onClick={() => setMenuOpen(false)}
                    aria-hidden="true"
                />
            )}

            <div className="fab-container">
                {/* Main Floating Action Button */}
                <button
                    type="button"
                    className={`fab-main-btn ${menuOpen ? "fab-main-btn--open" : ""}`}
                    onClick={handleToggleMenu}
                    title={menuOpen ? "Fermer les actions" : "Ajouter ou créer un livre"}
                    aria-label={menuOpen ? "Fermer les actions" : "Ajouter ou créer un livre"}
                >
                    <span className="fab-main-icon">
                        <FontAwesomeIcon icon={faPlus} />
                    </span>
                </button>

                {/* Speed-dial action options */}
                {menuOpen && (
                    <div className="fab-actions-menu">
                        <button
                            type="button"
                            className="fab-action-item"
                            onClick={handleOpenCreateModal}
                        >
                            <span className="fab-action-icon">
                                <FontAwesomeIcon icon={faPenNib} />
                            </span>
                            <span className="fab-action-text">Créer un livre manquant</span>
                        </button>

                        <button
                            type="button"
                            className="fab-action-item"
                            onClick={handleOpenAddModal}
                        >
                            <span className="fab-action-icon">
                                <FontAwesomeIcon icon={faMagnifyingGlass} />
                            </span>
                            <span className="fab-action-text">Ajouter un livre existant</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Modal: Add existing book to library */}
            <AddBookToLibraryModal
                open={addModalOpen}
                onClose={() => setAddModalOpen(false)}
                onOpenCreateBook={() => setCreateModalOpen(true)}
            />

            {/* Modal: Create a missing book */}
            <CreateMissingBookModal
                open={createModalOpen}
                onClose={() => setCreateModalOpen(false)}
            />
        </>
    );
}
