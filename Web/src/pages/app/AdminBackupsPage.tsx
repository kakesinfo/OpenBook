import { WrapperHeader } from "../../components/Wrapper/Wrapper.tsx";
import { useState, useEffect, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faBoxArchive,
    faPlus,
    faRotate,
    faTrashCan,
    faDownload,
    faHardDrive,
    faDatabase,
    faImage,
    faCalendarDays,
    faCircleNotch,
    faTriangleExclamation,
    faRotateLeft
} from "@fortawesome/free-solid-svg-icons";
import { Dialog } from "@mui/material";
import { enqueueSnackbar } from "notistack";
import useSession from "../../hooks/UseSession.tsx";
import useLanguage from "../../hooks/UseLanguage.tsx";
import { BackupMetadataDTO, RestoreResultDTO } from "../../dto/BackupMetadata.dto.ts";
import "./AdminBackupsPage.scss";

export default function AdminBackupsPage() {
    const session = useSession();
    const { tr, locale } = useLanguage();

    const [backups, setBackups] = useState<BackupMetadataDTO[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [creating, setCreating] = useState<boolean>(false);
    const [downloading, setDownloading] = useState<string | null>(null);

    // Modal delete state
    const [backupToDelete, setBackupToDelete] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<boolean>(false);

    // Modal restore state
    const [backupToRestore, setBackupToRestore] = useState<string | null>(null);
    const [restoring, setRestoring] = useState<boolean>(false);

    const formatBytes = (bytes: number): string => {
        if (!bytes || bytes <= 0) return "0 o";
        const units = ["o", "Ko", "Mo", "Go"];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        const formatted = (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2);
        return `${formatted} ${units[i] || "o"}`;
    };

    const formatDate = (isoString?: string): string => {
        if (!isoString) return "-";
        try {
            const date = new Date(isoString);
            return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
                dateStyle: "medium",
                timeStyle: "short"
            }).format(date);
        } catch {
            return isoString;
        }
    };

    const fetchBackups = useCallback(async (quiet = false) => {
        if (!quiet) setLoading(true);
        try {
            const res = await session.customFetch("/admin/backup", { method: "GET" });
            if (res.ok) {
                const data: BackupMetadataDTO[] = await res.json();
                setBackups(data);
            } else {
                enqueueSnackbar(
                    tr("Failed to load backups list", "Impossible de charger la liste des sauvegardes"),
                    { variant: "error" }
                );
            }
        } catch {
            enqueueSnackbar(
                tr("Network error while loading backups", "Erreur réseau lors du chargement des sauvegardes"),
                { variant: "error" }
            );
        } finally {
            if (!quiet) setLoading(false);
        }
    }, [session, tr]);

    useEffect(() => {
        void (async () => {
            await fetchBackups();
        })();
    }, [fetchBackups]);

    const handleCreateBackup = async () => {
        if (creating) return;
        setCreating(true);
        enqueueSnackbar(
            tr("Creating backup (database dump + images)...", "Création de la sauvegarde en cours (dump BDD + images)..."),
            { variant: "info", autoHideDuration: 4000 }
        );

        try {
            const res = await session.customFetch("/admin/backup", { method: "POST" });
            if (res.ok) {
                const created: BackupMetadataDTO = await res.json();
                enqueueSnackbar(
                    tr(`Backup created successfully: ${created.filename}`, `Sauvegarde créée avec succès : ${created.filename}`),
                    { variant: "success" }
                );
                await fetchBackups(true);
            } else {
                enqueueSnackbar(
                    tr("Failed to create backup", "Échec lors de la création de la sauvegarde"),
                    { variant: "error" }
                );
            }
        } catch {
            enqueueSnackbar(
                tr("An error occurred during backup creation", "Une erreur est survenue lors de la création de la sauvegarde"),
                { variant: "error" }
            );
        } finally {
            setCreating(false);
        }
    };

    const handleDownloadBackup = async (filename: string) => {
        if (downloading) return;
        setDownloading(filename);

        try {
            const res = await session.customFetch(`/admin/backup/download/${encodeURIComponent(filename)}`, {
                method: "GET"
            });

            if (!res.ok) {
                throw new Error("Download failed");
            }

            const blob = await res.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = downloadUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(downloadUrl);

            enqueueSnackbar(
                tr("Backup download started", "Téléchargement de la sauvegarde démarré"),
                { variant: "success" }
            );
        } catch {
            enqueueSnackbar(
                tr("Failed to download backup", "Impossible de télécharger la sauvegarde"),
                { variant: "error" }
            );
        } finally {
            setDownloading(null);
        }
    };

    const handleDeleteBackup = async () => {
        if (!backupToDelete || deleting) return;
        setDeleting(true);

        try {
            const res = await session.customFetch(`/admin/backup/${encodeURIComponent(backupToDelete)}`, {
                method: "DELETE"
            });

            if (res.ok) {
                enqueueSnackbar(
                    tr("Backup deleted successfully", "Sauvegarde supprimée avec succès"),
                    { variant: "success" }
                );
                setBackupToDelete(null);
                await fetchBackups(true);
            } else {
                enqueueSnackbar(
                    tr("Failed to delete backup", "Impossible de supprimer la sauvegarde"),
                    { variant: "error" }
                );
            }
        } catch {
            enqueueSnackbar(
                tr("Error while deleting backup", "Erreur lors de la suppression de la sauvegarde"),
                { variant: "error" }
            );
        } finally {
            setDeleting(false);
        }
    };

    const handleRestoreBackup = async () => {
        if (!backupToRestore || restoring) return;
        setRestoring(true);
        enqueueSnackbar(
            tr("Restoring backup (database + images)...", "Restauration de la sauvegarde en cours (BDD + images)..."),
            { variant: "info", autoHideDuration: 6000 }
        );

        try {
            const res = await session.customFetch(`/admin/backup/restore/${encodeURIComponent(backupToRestore)}`, {
                method: "POST"
            });

            if (res.ok) {
                const result: RestoreResultDTO = await res.json();
                enqueueSnackbar(
                    tr(
                        `Backup restored successfully in ${Math.round(result.durationMs / 1000)}s (${result.restoredImagesCount} images restored)`,
                        `Sauvegarde restaurée avec succès en ${Math.round(result.durationMs / 1000)}s (${result.restoredImagesCount} images restaurées)`
                    ),
                    { variant: "success", autoHideDuration: 6000 }
                );
                setBackupToRestore(null);
                await fetchBackups(true);
            } else {
                const errData = await res.json().catch(() => ({}));
                enqueueSnackbar(
                    errData.error || tr("Failed to restore backup", "Échec lors de la restauration de la sauvegarde"),
                    { variant: "error" }
                );
            }
        } catch {
            enqueueSnackbar(
                tr("Error while restoring backup", "Erreur lors de la restauration de la sauvegarde"),
                { variant: "error" }
            );
        } finally {
            setRestoring(false);
        }
    };

    return (
        <div className="admin-backups">
            <WrapperHeader>
                <div className="admin-backups__header-title">
                    <h2>{tr("Backups", "Sauvegardes")}</h2>
                    <p>{tr("Database and media archives management", "Gestion des archives de la base de données et des médias")}</p>
                </div>
            </WrapperHeader>

            <div className="admin-backups__content">
                {/* Hero / Action banner */}
                <div className="admin-backups__banner">
                    <div className="admin-backups__banner-info">
                        <div className="admin-backups__banner-icon">
                            <FontAwesomeIcon icon={faBoxArchive} />
                        </div>
                        <div>
                            <h3 className="admin-backups__banner-title">
                                {tr("Full Backup Archive", "Sauvegarde complète du système")}
                            </h3>
                            <p className="admin-backups__banner-desc">
                                {tr(
                                    "Creates a dated .zip archive containing the entire PostgreSQL database (dump.sql) and all media images in WebP format.",
                                    "Crée une archive .zip datée contenant l'intégralité de la base PostgreSQL (dump.sql) et toutes les couvertures d'albums en WebP."
                                )}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        className="admin-backups__create-btn"
                        onClick={handleCreateBackup}
                        disabled={creating || restoring}
                    >
                        <FontAwesomeIcon icon={creating ? faCircleNotch : faPlus} spin={creating} />
                        <span>
                            {creating
                                ? tr("Generating backup...", "Génération en cours...")
                                : tr("Create new backup", "Créer une nouvelle sauvegarde")}
                        </span>
                    </button>
                </div>

                {/* List section */}
                <div className="admin-backups__section">
                    <div className="admin-backups__section-header">
                        <h4 className="admin-backups__section-title">
                            <span>{tr("Existing Backups", "Sauvegardes existantes")}</span>
                            <span className="admin-backups__badge-count">{backups.length}</span>
                        </h4>

                        <button
                            type="button"
                            className="admin-backups__refresh-btn"
                            onClick={() => fetchBackups()}
                            disabled={loading || restoring}
                            title={tr("Refresh list", "Rafraîchir la liste")}
                        >
                            <FontAwesomeIcon icon={faRotate} spin={loading} />
                            <span>{tr("Refresh", "Actualiser")}</span>
                        </button>
                    </div>

                    {loading && backups.length === 0 ? (
                        <div className="admin-backups__empty">
                            <FontAwesomeIcon icon={faCircleNotch} spin className="admin-backups__empty-icon" />
                            <p>{tr("Loading backups...", "Chargement des sauvegardes...")}</p>
                        </div>
                    ) : backups.length === 0 ? (
                        <div className="admin-backups__empty">
                            <FontAwesomeIcon icon={faBoxArchive} className="admin-backups__empty-icon" />
                            <p>{tr("No backups found yet. Create one to protect your data.", "Aucune sauvegarde pour le moment. Créez-en une pour sécuriser vos données.")}</p>
                        </div>
                    ) : (
                        <div className="admin-backups__list">
                            {backups.map((b) => (
                                <div key={b.filename} className="admin-backups__card">
                                    <div className="admin-backups__card-left">
                                        <div className="admin-backups__file-icon">
                                            <FontAwesomeIcon icon={faHardDrive} />
                                        </div>
                                        <div className="admin-backups__file-info">
                                            <span className="admin-backups__filename">{b.filename}</span>
                                            <div className="admin-backups__meta-row">
                                                <span className="admin-backups__meta-item">
                                                    <FontAwesomeIcon icon={faCalendarDays} />
                                                    {formatDate(b.createdAt)}
                                                </span>
                                                <span className="admin-backups__meta-item">
                                                    <FontAwesomeIcon icon={faHardDrive} />
                                                    {formatBytes(b.sizeBytes)}
                                                </span>
                                                {b.databaseSizeBytes > 0 && (
                                                    <span className="admin-backups__meta-item">
                                                        <FontAwesomeIcon icon={faDatabase} />
                                                        BDD {formatBytes(b.databaseSizeBytes)}
                                                    </span>
                                                )}
                                                {b.imageCount > 0 && (
                                                    <span className="admin-backups__meta-item">
                                                        <FontAwesomeIcon icon={faImage} />
                                                        {b.imageCount} {tr("images", "images")}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="admin-backups__card-actions">
                                        <button
                                            type="button"
                                            className="admin-backups__action-btn admin-backups__action-btn--download"
                                            onClick={() => handleDownloadBackup(b.filename)}
                                            disabled={downloading === b.filename || restoring}
                                            title={tr("Download backup archive", "Télécharger l'archive")}
                                        >
                                            <FontAwesomeIcon
                                                icon={downloading === b.filename ? faCircleNotch : faDownload}
                                                spin={downloading === b.filename}
                                            />
                                            <span>
                                                {downloading === b.filename
                                                    ? tr("Downloading...", "Téléchargement...")
                                                    : tr("Download", "Télécharger")}
                                            </span>
                                        </button>

                                        <button
                                            type="button"
                                            className="admin-backups__action-btn admin-backups__action-btn--restore"
                                            onClick={() => setBackupToRestore(b.filename)}
                                            disabled={restoring || deleting}
                                            title={tr("Restore this backup", "Restaurer cette sauvegarde")}
                                        >
                                            <FontAwesomeIcon icon={faRotateLeft} />
                                            <span>{tr("Restore", "Restaurer")}</span>
                                        </button>

                                        <button
                                            type="button"
                                            className="admin-backups__action-btn admin-backups__action-btn--delete"
                                            onClick={() => setBackupToDelete(b.filename)}
                                            disabled={(deleting && backupToDelete === b.filename) || restoring}
                                            title={tr("Delete backup", "Supprimer la sauvegarde")}
                                        >
                                            <FontAwesomeIcon icon={faTrashCan} />
                                            <span>{tr("Delete", "Supprimer")}</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Confirmation Dialog for Restore */}
            <Dialog
                open={backupToRestore !== null}
                onClose={() => !restoring && setBackupToRestore(null)}
                slotProps={{ paper: {
                    style: {
                        backgroundColor: "var(--bg-surface)",
                        color: "var(--text-primary)",
                        borderRadius: "16px",
                        padding: "20px",
                        maxWidth: "480px",
                        width: "100%",
                        border: "1px solid var(--border-subtle)"
                    }
                }}}
            >
                <div className="admin-backups__dialog-content">
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "var(--accent-primary)" }}>
                        <FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: "1.4rem" }} />
                        <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "var(--text-primary)" }}>
                            {tr("Restore Backup?", "Restaurer la sauvegarde ?")}
                        </h3>
                    </div>

                    <p style={{ margin: 0, fontSize: "0.95rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                        {tr(
                            `Are you sure you want to restore "${backupToRestore}"? Current database tables and media images will be overwritten by the state stored in this backup.`,
                            `Êtes-vous sûr de vouloir restaurer la sauvegarde « ${backupToRestore} » ? La base de données actuelle et les médias seront remplacés par l'état contenu dans cette sauvegarde.`
                        )}
                    </p>

                    <div className="admin-backups__dialog-actions">
                        <button
                            type="button"
                            className="admin-backups__action-btn admin-backups__action-btn--download"
                            onClick={() => setBackupToRestore(null)}
                            disabled={restoring}
                        >
                            {tr("Cancel", "Annuler")}
                        </button>
                        <button
                            type="button"
                            className="admin-backups__action-btn admin-backups__action-btn--restore"
                            onClick={handleRestoreBackup}
                            disabled={restoring}
                        >
                            <FontAwesomeIcon icon={restoring ? faCircleNotch : faRotateLeft} spin={restoring} />
                            <span>{restoring ? tr("Restoring...", "Restauration...") : tr("Confirm Restore", "Confirmer la restauration")}</span>
                        </button>
                    </div>
                </div>
            </Dialog>

            {/* Confirmation Dialog for Deletion */}
            <Dialog
                open={backupToDelete !== null}
                onClose={() => !deleting && setBackupToDelete(null)}
                slotProps={{ paper: {
                    style: {
                        backgroundColor: "var(--bg-surface)",
                        color: "var(--text-primary)",
                        borderRadius: "16px",
                        padding: "20px",
                        maxWidth: "460px",
                        width: "100%",
                        border: "1px solid var(--border-subtle)"
                    }
                }}}
            >
                <div className="admin-backups__dialog-content">
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "#ef4444" }}>
                        <FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: "1.4rem" }} />
                        <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "var(--text-primary)" }}>
                            {tr("Delete Backup?", "Supprimer la sauvegarde ?")}
                        </h3>
                    </div>

                    <p style={{ margin: 0, fontSize: "0.95rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                        {tr(
                            `Are you sure you want to permanently delete the backup "${backupToDelete}"? This action cannot be undone.`,
                            `Êtes-vous sûr de vouloir supprimer définitivement la sauvegarde « ${backupToDelete} » ? Cette action est irréversible.`
                        )}
                    </p>

                    <div className="admin-backups__dialog-actions">
                        <button
                            type="button"
                            className="admin-backups__action-btn admin-backups__action-btn--download"
                            onClick={() => setBackupToDelete(null)}
                            disabled={deleting}
                        >
                            {tr("Cancel", "Annuler")}
                        </button>
                        <button
                            type="button"
                            className="admin-backups__action-btn admin-backups__action-btn--delete"
                            onClick={handleDeleteBackup}
                            disabled={deleting}
                        >
                            <FontAwesomeIcon icon={deleting ? faCircleNotch : faTrashCan} spin={deleting} />
                            <span>{deleting ? tr("Deleting...", "Suppression...") : tr("Delete permanently", "Supprimer définitivement")}</span>
                        </button>
                    </div>
                </div>
            </Dialog>
        </div>
    );
}
