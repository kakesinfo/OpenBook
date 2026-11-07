import { useState, useEffect, useCallback } from "react";
import { WrapperHeader } from "../../components/Wrapper/Wrapper.tsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faUsers,
    faUserPlus,
    faRotate,
    faBan,
    faUnlock,
    faTrashCan,
    faKey,
    faShieldHalved,
    faUser,
    faCheck,
    faCircleNotch,
    faCopy,
    faTriangleExclamation,
    faInfoCircle,
    faDice
} from "@fortawesome/free-solid-svg-icons";
import { Dialog } from "@mui/material";
import { enqueueSnackbar } from "notistack";
import useSession from "../../hooks/UseSession.tsx";
import useLanguage from "../../hooks/UseLanguage.tsx";
import { AdminUserDTO } from "../../dto/AdminUser.dto.ts";
import SearchableSelect from "../../components/FloatingActionButton/SearchableSelect.tsx";
import "./AdminUsersPage.scss";

export default function AdminUsersPage() {
    const session = useSession();
    const { tr, locale } = useLanguage();

    const [users, setUsers] = useState<AdminUserDTO[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    // Modal Create User
    const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
    const [newUsername, setNewUsername] = useState<string>("");
    const [newTempPassword, setNewTempPassword] = useState<string>("");
    const [newRole, setNewRole] = useState<string>("ROLE_USER");
    const [creating, setCreating] = useState<boolean>(false);

    // Modal Created Success (Credentials)
    const [createdCredentials, setCreatedCredentials] = useState<{ username: string; tempPassword: string } | null>(null);

    // Modal Delete User
    const [userToDelete, setUserToDelete] = useState<AdminUserDTO | null>(null);
    const [deleting, setDeleting] = useState<boolean>(false);

    // Modal Reset Password
    const [userToReset, setUserToReset] = useState<AdminUserDTO | null>(null);
    const [resetTempPassword, setResetTempPassword] = useState<string>("");
    const [resetting, setResetting] = useState<boolean>(false);

    // Action in progress (e.g. blocking/unblocking user ID)
    const [togglingBlockId, setTogglingBlockId] = useState<number | null>(null);

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

    const generateRandomPassword = (): string => {
        const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*";
        let res = "";
        for (let i = 0; i < 12; i++) {
            res += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return res;
    };

    const fetchUsers = useCallback(async (quiet = false) => {
        if (!quiet) setLoading(true);
        try {
            const res = await session.customFetch("/admin/users", { method: "GET" });
            if (res.ok) {
                const data: AdminUserDTO[] = await res.json();
                setUsers(data);
            } else {
                enqueueSnackbar(
                    tr("Failed to load users list", "Impossible de charger la liste des utilisateurs"),
                    { variant: "error" }
                );
            }
        } catch (e) {
            console.error(e);
            enqueueSnackbar(
                tr("Network error while loading users", "Erreur réseau lors du chargement des utilisateurs"),
                { variant: "error" }
            );
        } finally {
            if (!quiet) setLoading(false);
        }
    }, [session, tr]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    // Open create modal with pre-generated password
    const handleOpenCreate = () => {
        setNewUsername("");
        setNewTempPassword(generateRandomPassword());
        setNewRole("ROLE_USER");
        setIsCreateOpen(true);
    };

    // Submit Create User
    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = newUsername.trim();
        if (!trimmed || trimmed.length < 3) {
            return enqueueSnackbar(
                tr("Username must be at least 3 characters long.", "Le nom d'utilisateur doit contenir au moins 3 caractères."),
                { variant: "error" }
            );
        }
        if (!newTempPassword || newTempPassword.length < 6) {
            return enqueueSnackbar(
                tr("Temporary password must be at least 6 characters long.", "Le mot de passe provisoire doit comporter au moins 6 caractères."),
                { variant: "error" }
            );
        }

        setCreating(true);
        try {
            const res = await session.customFetch("/admin/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: trimmed,
                    temporaryPassword: newTempPassword,
                    role: newRole
                })
            });

            if (res.ok) {
                setIsCreateOpen(false);
                setCreatedCredentials({
                    username: trimmed,
                    tempPassword: newTempPassword
                });
                enqueueSnackbar(
                    tr("User account created successfully!", "Compte utilisateur créé avec succès !"),
                    { variant: "success" }
                );
                await fetchUsers(true);
            } else {
                const errorData = await res.json().catch(() => null);
                const msg = errorData?.message || tr("Failed to create user account.", "Erreur lors de la création du compte.");
                enqueueSnackbar(msg, { variant: "error" });
            }
        } catch (e) {
            console.error(e);
            enqueueSnackbar(tr("An unexpected error occurred.", "Une erreur inattendue est survenue."), { variant: "error" });
        } finally {
            setCreating(false);
        }
    };

    // Toggle Block / Unblock
    const handleToggleBlock = async (user: AdminUserDTO) => {
        setTogglingBlockId(user.id);
        try {
            const res = await session.customFetch(`/admin/users/${user.id}/block`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ blocked: !user.blocked })
            });

            if (res.ok) {
                const data = await res.json();
                enqueueSnackbar(
                    data.message || (user.blocked ? tr("User unblocked", "Utilisateur débloqué") : tr("User blocked", "Utilisateur bloqué")),
                    { variant: "success" }
                );
                await fetchUsers(true);
            } else {
                const err = await res.json().catch(() => null);
                enqueueSnackbar(err?.message || tr("Error modifying block status.", "Erreur lors de la modification du statut."), { variant: "error" });
            }
        } catch (e) {
            console.error(e);
            enqueueSnackbar(tr("Network error.", "Erreur réseau."), { variant: "error" });
        } finally {
            setTogglingBlockId(null);
        }
    };

    // Submit Delete User
    const handleDeleteUser = async () => {
        if (!userToDelete) return;
        setDeleting(true);
        try {
            const res = await session.customFetch(`/admin/users/${userToDelete.id}`, {
                method: "DELETE"
            });

            if (res.ok) {
                enqueueSnackbar(
                    tr("User deleted successfully.", "Utilisateur supprimé avec succès."),
                    { variant: "success" }
                );
                setUserToDelete(null);
                await fetchUsers(true);
            } else {
                const err = await res.json().catch(() => null);
                enqueueSnackbar(err?.message || tr("Error deleting user.", "Erreur lors de la suppression."), { variant: "error" });
            }
        } catch (e) {
            console.error(e);
            enqueueSnackbar(tr("Network error.", "Erreur réseau."), { variant: "error" });
        } finally {
            setDeleting(false);
        }
    };

    // Submit Reset Temporary Password
    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userToReset) return;
        if (!resetTempPassword || resetTempPassword.length < 6) {
            return enqueueSnackbar(
                tr("Password must be at least 6 characters long.", "Le mot de passe doit comporter au moins 6 caractères."),
                { variant: "error" }
            );
        }

        setResetting(true);
        try {
            const res = await session.customFetch(`/admin/users/${userToReset.id}/reset-password`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ temporaryPassword: resetTempPassword })
            });

            if (res.ok) {
                const resetUser = userToReset;
                const tempPwd = resetTempPassword;
                setUserToReset(null);
                setCreatedCredentials({
                    username: resetUser.username,
                    tempPassword: tempPwd
                });
                enqueueSnackbar(
                    tr("Temporary password defined successfully.", "Mot de passe provisoire défini avec succès."),
                    { variant: "success" }
                );
                await fetchUsers(true);
            } else {
                const err = await res.json().catch(() => null);
                enqueueSnackbar(err?.message || tr("Error resetting password.", "Erreur lors de la réinitialisation."), { variant: "error" });
            }
        } catch (e) {
            console.error(e);
            enqueueSnackbar(tr("Network error.", "Erreur réseau."), { variant: "error" });
        } finally {
            setResetting(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        enqueueSnackbar(tr("Copied to clipboard!", "Copié dans le presse-papier !"), { variant: "success" });
    };

    const totalUsers = users.length;
    const blockedCount = users.filter(u => u.blocked).length;
    const activeCount = totalUsers - blockedCount;
    const tempPasswordCount = users.filter(u => u.mustChangePassword).length;

    return (
        <div className="admin-users">
            <WrapperHeader>
                <div className="admin-users__header-title">
                    <h2>{tr("User Management", "Gestion des utilisateurs")}</h2>
                    <p>{tr("Create accounts with temporary passwords, manage permissions, block or delete users.", "Créez des comptes avec mot de passe provisoire, gérez les accès et les statuts des utilisateurs.")}</p>
                </div>
            </WrapperHeader>

            <div className="admin-users__content">
                {/* Banner / Summary */}
                <div className="admin-users__banner">
                    <div className="admin-users__banner-info">
                        <div className="admin-users__banner-icon">
                            <FontAwesomeIcon icon={faUsers} />
                        </div>
                        <div className="admin-users__banner-text">
                            <h3>{tr("Users and Access", "Utilisateurs et accès")}</h3>
                            <div className="admin-users__banner-stats">
                                <span className="admin-users__stat-badge">
                                    <FontAwesomeIcon icon={faUser} /> {totalUsers} {tr("users", "utilisateurs")}
                                </span>
                                <span className="admin-users__stat-badge admin-users__stat-badge--active">
                                    <FontAwesomeIcon icon={faCheck} /> {activeCount} {tr("active", "actifs")}
                                </span>
                                {blockedCount > 0 && (
                                    <span className="admin-users__stat-badge admin-users__stat-badge--blocked">
                                        <FontAwesomeIcon icon={faBan} /> {blockedCount} {tr("blocked", "bloqués")}
                                    </span>
                                )}
                                {tempPasswordCount > 0 && (
                                    <span className="admin-users__stat-badge admin-users__stat-badge--temp">
                                        <FontAwesomeIcon icon={faKey} /> {tempPasswordCount} {tr("temp password", "mdp provisoire")}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="admin-users__banner-actions">
                        <button
                            type="button"
                            className="admin-users__btn admin-users__btn--secondary"
                            onClick={() => fetchUsers()}
                            disabled={loading}
                        >
                            <FontAwesomeIcon icon={faRotate} spin={loading} />
                            <span>{tr("Refresh", "Actualiser")}</span>
                        </button>

                        <button
                            type="button"
                            className="admin-users__btn admin-users__btn--primary"
                            onClick={handleOpenCreate}
                        >
                            <FontAwesomeIcon icon={faUserPlus} />
                            <span>{tr("New user", "Nouvel utilisateur")}</span>
                        </button>
                    </div>
                </div>

                {/* Users List Panel */}
                <div className="admin-users__panel">
                    <div className="admin-users__panel-header">
                        <h4>{tr("Registered Accounts", "Comptes enregistrés")}</h4>
                    </div>

                    {loading ? (
                        <div className="admin-users__loading">
                            <FontAwesomeIcon icon={faCircleNotch} spin size="2x" />
                            <span>{tr("Loading users...", "Chargement des utilisateurs...")}</span>
                        </div>
                    ) : users.length === 0 ? (
                        <div className="admin-users__empty">
                            <FontAwesomeIcon icon={faUsers} size="3x" />
                            <p>{tr("No users found.", "Aucun utilisateur trouvé.")}</p>
                        </div>
                    ) : (
                        <div className="admin-users__table-wrapper">
                            <table className="admin-users__table">
                                <thead>
                                    <tr>
                                        <th>{tr("User", "Utilisateur")}</th>
                                        <th>{tr("Role", "Rôle")}</th>
                                        <th>{tr("Status", "Statut")}</th>
                                        <th>{tr("Books", "Albums")}</th>
                                        <th>{tr("Created at", "Date de création")}</th>
                                        <th style={{ textAlign: "right" }}>{tr("Actions", "Actions")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(u => {
                                        const isCurrent = session.user?.username?.toLowerCase() === u.username.toLowerCase();
                                        const isActionLoading = togglingBlockId === u.id;

                                        return (
                                            <tr key={u.id} className={u.blocked ? "admin-users__table tbody tr--blocked" : ""}>
                                                <td>
                                                    <div className="admin-users__user-cell">
                                                        {u.avatar ? (
                                                            <img src={u.avatar} alt={u.username} className="admin-users__avatar" />
                                                        ) : (
                                                            <div className="admin-users__avatar">
                                                                {u.username.charAt(0).toUpperCase()}
                                                            </div>
                                                        )}
                                                        <div className="admin-users__user-name-group">
                                                            <div className="admin-users__username">
                                                                {u.username}
                                                                {isCurrent && (
                                                                    <span className="admin-users__you-badge">
                                                                        {tr("You", "Vous")}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="admin-users__user-id">ID: #{u.id}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={`admin-users__role-badge ${u.role === "ROLE_ADMIN" ? "admin-users__role-badge--admin" : "admin-users__role-badge--user"}`}>
                                                        <FontAwesomeIcon icon={u.role === "ROLE_ADMIN" ? faShieldHalved : faUser} />
                                                        {u.role === "ROLE_ADMIN" ? tr("Administrator", "Administrateur") : tr("Reader", "Lecteur")}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="admin-users__status-group">
                                                        <span className={`admin-users__status-pill ${u.blocked ? "admin-users__status-pill--blocked" : "admin-users__status-pill--active"}`}>
                                                            <FontAwesomeIcon icon={u.blocked ? faBan : faCheck} />
                                                            {u.blocked ? tr("Blocked", "Bloqué") : tr("Active", "Actif")}
                                                        </span>
                                                        {u.mustChangePassword && (
                                                            <span className="admin-users__status-pill admin-users__status-pill--temp">
                                                                <FontAwesomeIcon icon={faKey} />
                                                                {tr("Temp password", "Mdp provisoire")}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td>
                                                    <strong>{u.booksCount}</strong> {tr("books", "livres")}
                                                </td>
                                                <td>
                                                    {formatDate(u.createdAt)}
                                                </td>
                                                <td>
                                                    <div className="admin-users__actions-cell">
                                                        {/* Reset Temporary Password */}
                                                        <button
                                                            type="button"
                                                            className="admin-users__icon-btn admin-users__icon-btn--key"
                                                            title={tr("Define new temporary password", "Définir un nouveau mot de passe provisoire")}
                                                            onClick={() => {
                                                                setUserToReset(u);
                                                                setResetTempPassword(generateRandomPassword());
                                                            }}
                                                        >
                                                            <FontAwesomeIcon icon={faKey} />
                                                        </button>

                                                        {/* Block / Unblock */}
                                                        <button
                                                            type="button"
                                                            className={`admin-users__icon-btn ${u.blocked ? "admin-users__icon-btn--unblock" : "admin-users__icon-btn--block"}`}
                                                            title={u.blocked ? tr("Unblock user", "Débloquer l'utilisateur") : tr("Block user", "Bloquer l'utilisateur")}
                                                            disabled={isCurrent || isActionLoading}
                                                            onClick={() => handleToggleBlock(u)}
                                                        >
                                                            <FontAwesomeIcon
                                                                icon={isActionLoading ? faCircleNotch : (u.blocked ? faUnlock : faBan)}
                                                                spin={isActionLoading}
                                                            />
                                                        </button>

                                                        {/* Delete */}
                                                        <button
                                                            type="button"
                                                            className="admin-users__icon-btn admin-users__icon-btn--delete"
                                                            title={tr("Delete user", "Supprimer l'utilisateur")}
                                                            disabled={isCurrent}
                                                            onClick={() => setUserToDelete(u)}
                                                        >
                                                            <FontAwesomeIcon icon={faTrashCan} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal: Create User */}
            <Dialog
                open={isCreateOpen}
                onClose={() => !creating && setIsCreateOpen(false)}
                PaperProps={{
                    style: {
                        backgroundColor: "transparent",
                        boxShadow: "none",
                        overflow: "visible"
                    }
                }}
            >
                <div className="admin-users-dialog">
                    <h3 className="admin-users-dialog__title">
                        <FontAwesomeIcon icon={faUserPlus} />
                        {tr("Create a user account", "Créer un compte utilisateur")}
                    </h3>

                    <p className="admin-users-dialog__text">
                        {tr(
                            "The user will be created with a temporary password and will be required to change it on their very first login.",
                            "L'utilisateur sera créé avec un mot de passe provisoire et aura l'obligation de le modifier dès sa toute première connexion."
                        )}
                    </p>

                    <form onSubmit={handleCreateUser} className="admin-users-dialog__form">
                        <div className="admin-users-dialog__field">
                            <label htmlFor="modal-username">{tr("Username", "Nom d'utilisateur")}</label>
                            <input
                                id="modal-username"
                                type="text"
                                placeholder={tr("e.g., alex", "ex : alex")}
                                value={newUsername}
                                onChange={(e) => setNewUsername(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>

                        <div className="admin-users-dialog__field">
                            <label htmlFor="modal-role">{tr("Role", "Rôle")}</label>
                            <SearchableSelect
                                id="modal-role"
                                value={newRole}
                                onChange={(val) => setNewRole(val)}
                                options={[
                                    { label: tr("Reader (Standard User)", "Lecteur (Utilisateur standard)"), value: "ROLE_USER" },
                                    { label: tr("Administrator", "Administrateur"), value: "ROLE_ADMIN" }
                                ]}
                                allowEmpty={false}
                                allowCustom={false}
                                searchable={false}
                            />
                        </div>

                        <div className="admin-users-dialog__field">
                            <label htmlFor="modal-password">{tr("Temporary password", "Mot de passe provisoire")}</label>
                            <div className="admin-users-dialog__pwd-input-group">
                                <input
                                    id="modal-password"
                                    type="text"
                                    value={newTempPassword}
                                    onChange={(e) => setNewTempPassword(e.target.value)}
                                    required
                                />
                                <button
                                    type="button"
                                    className="admin-users-dialog__btn-generate"
                                    onClick={() => setNewTempPassword(generateRandomPassword())}
                                    title={tr("Generate another password", "Générer un autre mot de passe")}
                                >
                                    <FontAwesomeIcon icon={faDice} />
                                    <span>{tr("Generate", "Générer")}</span>
                                </button>
                            </div>
                        </div>

                        <div className="admin-users-dialog__info-box">
                            <FontAwesomeIcon icon={faInfoCircle} />
                            <span>
                                {tr(
                                    "When the user logs in for the first time with this temporary password, the application will immediately prompt them to define their own secure password.",
                                    "Lors de sa première connexion avec ce mot de passe provisoire, l'application lui imposera immédiatement de définir son propre mot de passe personnel."
                                )}
                            </span>
                        </div>

                        <div className="admin-users-dialog__actions">
                            <button
                                type="button"
                                className="admin-users__btn admin-users__btn--secondary"
                                onClick={() => setIsCreateOpen(false)}
                                disabled={creating}
                            >
                                {tr("Cancel", "Annuler")}
                            </button>
                            <button
                                type="submit"
                                className="admin-users__btn admin-users__btn--primary"
                                disabled={creating}
                            >
                                <FontAwesomeIcon icon={creating ? faCircleNotch : faCheck} spin={creating} />
                                <span>{creating ? tr("Creating...", "Création...") : tr("Create account", "Créer le compte")}</span>
                            </button>
                        </div>
                    </form>
                </div>
            </Dialog>

            {/* Modal: Credentials Summary after creation or reset */}
            <Dialog
                open={Boolean(createdCredentials)}
                onClose={() => setCreatedCredentials(null)}
                PaperProps={{
                    style: {
                        backgroundColor: "transparent",
                        boxShadow: "none",
                        overflow: "visible"
                    }
                }}
            >
                <div className="admin-users-dialog">
                    <h3 className="admin-users-dialog__title" style={{ color: "#10b981" }}>
                        <FontAwesomeIcon icon={faCheck} />
                        {tr("Account ready!", "Compte prêt !")}
                    </h3>

                    <p className="admin-users-dialog__text">
                        {tr(
                            "Here are the temporary credentials to provide to the user. A password change will be enforced immediately upon login.",
                            "Voici les identifiants provisoires à communiquer à l'utilisateur. Le changement de mot de passe sera exigé dès sa connexion."
                        )}
                    </p>

                    {createdCredentials && (
                        <div className="admin-users-dialog__credentials-card">
                            <div className="admin-users-dialog__cred-row">
                                <span>{tr("Username", "Nom d'utilisateur")} :</span>
                                <code>{createdCredentials.username}</code>
                            </div>
                            <div className="admin-users-dialog__cred-row">
                                <span>{tr("Temporary password", "Mot de passe provisoire")} :</span>
                                <code>{createdCredentials.tempPassword}</code>
                            </div>
                        </div>
                    )}

                    <div className="admin-users-dialog__actions">
                        <button
                            type="button"
                            className="admin-users__btn admin-users__btn--secondary"
                            onClick={() => {
                                if (createdCredentials) {
                                    copyToClipboard(
                                        `Identifiants Yet Another Library:\nUtilisateur: ${createdCredentials.username}\nMot de passe provisoire: ${createdCredentials.tempPassword}`
                                    );
                                }
                            }}
                        >
                            <FontAwesomeIcon icon={faCopy} />
                            <span>{tr("Copy credentials", "Copier les identifiants")}</span>
                        </button>
                        <button
                            type="button"
                            className="admin-users__btn admin-users__btn--primary"
                            onClick={() => setCreatedCredentials(null)}
                        >
                            {tr("Close", "Fermer")}
                        </button>
                    </div>
                </div>
            </Dialog>

            {/* Modal: Reset Temporary Password */}
            <Dialog
                open={Boolean(userToReset)}
                onClose={() => !resetting && setUserToReset(null)}
                PaperProps={{
                    style: {
                        backgroundColor: "transparent",
                        boxShadow: "none",
                        overflow: "visible"
                    }
                }}
            >
                <div className="admin-users-dialog">
                    <h3 className="admin-users-dialog__title">
                        <FontAwesomeIcon icon={faKey} />
                        {tr("Define temporary password", "Définir un mot de passe provisoire")}
                    </h3>

                    <p className="admin-users-dialog__text">
                        {tr(
                            `Set a new temporary password for ${userToReset?.username}. The user will be required to change it on their next login.`,
                            `Définir un nouveau mot de passe temporaire pour ${userToReset?.username}. L'utilisateur devra obligatoirement le changer à sa prochaine connexion.`
                        )}
                    </p>

                    <form onSubmit={handleResetPassword} className="admin-users-dialog__form">
                        <div className="admin-users-dialog__field">
                            <label htmlFor="reset-password">{tr("New temporary password", "Nouveau mot de passe provisoire")}</label>
                            <div className="admin-users-dialog__pwd-input-group">
                                <input
                                    id="reset-password"
                                    type="text"
                                    value={resetTempPassword}
                                    onChange={(e) => setResetTempPassword(e.target.value)}
                                    required
                                />
                                <button
                                    type="button"
                                    className="admin-users-dialog__btn-generate"
                                    onClick={() => setResetTempPassword(generateRandomPassword())}
                                    title={tr("Generate another password", "Générer un autre mot de passe")}
                                >
                                    <FontAwesomeIcon icon={faDice} />
                                    <span>{tr("Generate", "Générer")}</span>
                                </button>
                            </div>
                        </div>

                        <div className="admin-users-dialog__actions">
                            <button
                                type="button"
                                className="admin-users__btn admin-users__btn--secondary"
                                onClick={() => setUserToReset(null)}
                                disabled={resetting}
                            >
                                {tr("Cancel", "Annuler")}
                            </button>
                            <button
                                type="submit"
                                className="admin-users__btn admin-users__btn--primary"
                                disabled={resetting}
                            >
                                <FontAwesomeIcon icon={resetting ? faCircleNotch : faCheck} spin={resetting} />
                                <span>{resetting ? tr("Saving...", "Enregistrement...") : tr("Confirm reset", "Confirmer le mot de passe")}</span>
                            </button>
                        </div>
                    </form>
                </div>
            </Dialog>

            {/* Modal: Delete User */}
            <Dialog
                open={Boolean(userToDelete)}
                onClose={() => !deleting && setUserToDelete(null)}
                PaperProps={{
                    style: {
                        backgroundColor: "transparent",
                        boxShadow: "none",
                        overflow: "visible"
                    }
                }}
            >
                <div className="admin-users-dialog">
                    <h3 className="admin-users-dialog__title admin-users-dialog__title--danger">
                        <FontAwesomeIcon icon={faTriangleExclamation} />
                        {tr("Delete user account?", "Supprimer le compte utilisateur ?")}
                    </h3>

                    <p className="admin-users-dialog__text">
                        {tr(
                            `Are you sure you want to delete user "${userToDelete?.username}"? All associated data (owned books, reading sessions, wishlist) will be permanently deleted. This action cannot be undone.`,
                            `Êtes-vous sûr de vouloir supprimer définitivement le compte de "${userToDelete?.username}" ? Toutes ses données associées (collection de livres, sessions de lecture, listes) seront définitivement supprimées. Cette action est irréversible.`
                        )}
                    </p>

                    <div className="admin-users-dialog__actions">
                        <button
                            type="button"
                            className="admin-users__btn admin-users__btn--secondary"
                            onClick={() => setUserToDelete(null)}
                            disabled={deleting}
                        >
                            {tr("Cancel", "Annuler")}
                        </button>
                        <button
                            type="button"
                            className="admin-users__btn admin-users__btn--primary"
                            style={{ background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)", boxShadow: "0 4px 12px rgba(239, 68, 68, 0.3)" }}
                            onClick={handleDeleteUser}
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
