import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router";
import { WrapperHeader } from "../../components/Wrapper/Wrapper.tsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faArrowLeft,
    faCheck,
    faChevronDown,
    faLock,
    faMinus,
    faPen,
    faPlus,
    faTrash,
    faTrophy,
    faUnlock,
    faXmark
} from "@fortawesome/free-solid-svg-icons";
import { Dialog, Popover } from "@mui/material";
import { enqueueSnackbar } from "notistack";
import useSession from "../../hooks/UseSession.tsx";
import useLanguage from "../../hooks/UseLanguage.tsx";
import AchievementDTO from "../../dto/Achievement.dto.ts";
import Card from "../../components/Card/Card.tsx";
import SearchBar from "../../components/SearchBar/SearchBar.tsx";
import Select from "../../components/Select/Select.tsx";
import HeaderFilterTabs, { HeaderFilterTab } from "../../components/HeaderFilterTabs/HeaderFilterTabs.tsx";
import AchievementIcon, { ACHIEVEMENT_ICON_OPTIONS } from "../../components/AchievementIcon/AchievementIcon.tsx";
import AchievementMedal, { ACHIEVEMENT_ORNAMENT_OPTIONS } from "../../components/AchievementIcon/AchievementMedal.tsx";
import "./HomePage.scss";
import "./AchievementsPage.scss";

const COLOR_PRESETS = [
    // Or, Argent, Bronze
    "#ffd700",
    "#d4af37",
    "#c0c0c0",
    "#94a3b8",
    "#cd7f32",
    "#a97142",
    // Autres couleurs
    "#f59e0b",
    "#eab308",
    "#d97706",
    "#b45309",
    "#ea580c",
    "#ef4444",
    "#f43f5e",
    "#ec4899",
    "#f472b6",
    "#f9a8d4",
    "#d946ef",
    "#a855f7",
    "#8b5cf6",
    "#6366f1",
    "#3b82f6",
    "#0ea5e9",
    "#06b6d4",
    "#14b8a6",
    "#10b981",
    "#22c55e",
    "#2d6a4f",
    "#1b4332",
    "#84cc16",
    "#57534e",
    "#1e293b",
    "#ffffff"
];

const BG_PRESETS = [
    // Fonds Or, Argent, Bronze (clairs & foncés)
    "#fef08a",
    "#785616",
    "#e2e8f0",
    "#475569",
    "#e6ccb2",
    "#5c3a21",
    // Autres fonds
    "#fef3c7",
    "#fef9c3",
    "#ffedd5",
    "#fee2e2",
    "#ffe4e6",
    "#fce7f3",
    "#fbcfe8",
    "#f9a8d4",
    "#fae8ff",
    "#f3e8ff",
    "#ede9fe",
    "#e0e7ff",
    "#dbeafe",
    "#e0f2fe",
    "#cffafe",
    "#ccfbf1",
    "#d1fae5",
    "#dcfce7",
    "#ecfccb",
    "#a3b18a",
    "#2d6a4f",
    "#1b4332",
    "#e7e5e4",
    "#1e293b",
    "#312e81"
];

type FilterTab = "all" | "unlocked" | "locked";

export default function AchievementsPage() {
    const session = useSession();
    const { tr, locale } = useLanguage();

    const [achievements, setAchievements] = useState<AchievementDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterTab, setFilterTab] = useState<FilterTab>("all");

    // Modal state
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingAchievement, setEditingAchievement] = useState<AchievementDTO | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<AchievementDTO | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Form fields
    const [nameInput, setNameInput] = useState("");
    const [totalStepsInput, setTotalStepsInput] = useState<number>(1);
    const [iconInput, setIconInput] = useState("trophy");
    const [ornamentInput, setOrnamentInput] = useState("laurel");
    const [iconColorInput, setIconColorInput] = useState("#f59e0b");
    const [bgColorInput, setBgColorInput] = useState("#fef3c7");
    const [unlockedAtInput, setUnlockedAtInput] = useState<string>("");

    // Picker popovers
    const [iconAnchorEl, setIconAnchorEl] = useState<HTMLElement | null>(null);
    const [colorPickerState, setColorPickerState] = useState<{
        anchorEl: HTMLElement;
        target: "icon" | "bg";
    } | null>(null);

    const closeFormModal = () => {
        if (submitting) return;
        setIconAnchorEl(null);
        setColorPickerState(null);
        setIsFormOpen(false);
    };

    const selectedIconOption = useMemo(
        () => ACHIEVEMENT_ICON_OPTIONS.find((opt) => opt.id === iconInput) ?? ACHIEVEMENT_ICON_OPTIONS[0],
        [iconInput]
    );

    useEffect(() => {
        let cancelled = false;
        const loadAchievements = async () => {
            try {
                const res = await session.customFetch("/achievements", { method: "GET" });
                if (!cancelled && res.ok) {
                    const data = await res.json();
                    setAchievements(Array.isArray(data) ? data : []);
                }
            } catch (err) {
                if (!cancelled) {
                    console.error("Failed to load achievements:", err);
                    enqueueSnackbar(
                        tr("Failed to load achievements", "Impossible de charger les succès"),
                        { variant: "error" }
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };
        loadAchievements();
        return () => {
            cancelled = true;
        };
    }, [session, tr]);

    const unlockedCount = useMemo(
        () => achievements.filter((a) => a.unlocked).length,
        [achievements]
    );
    const lockedCount = achievements.length - unlockedCount;
    const progressPercent = achievements.length > 0
        ? Math.round((unlockedCount / achievements.length) * 100)
        : 0;

    const achievementRank = useMemo(() => {
        if (achievements.length === 0 || unlockedCount === 0) {
            return { label: tr("Beginner", "Débutant"), active: false };
        }
        if (progressPercent === 100) {
            return { label: tr("Legend", "Légende"), active: true };
        }
        if (progressPercent >= 75) {
            return { label: tr("Master", "Maître"), active: true };
        }
        if (progressPercent >= 50) {
            return { label: tr("Collector", "Collectionneur"), active: true };
        }
        if (progressPercent >= 25) {
            return { label: tr("Explorer", "Explorateur"), active: true };
        }
        return { label: tr("Apprentice", "Apprenti"), active: true };
    }, [achievements.length, unlockedCount, progressPercent, tr]);

    const filterTabs: HeaderFilterTab<FilterTab>[] = useMemo(() => [
        { id: "all", label: tr("All", "Tous"), icon: faTrophy, count: achievements.length },
        { id: "unlocked", label: tr("Unlocked", "Débloqués"), icon: faUnlock, count: unlockedCount },
        { id: "locked", label: tr("Locked", "À débloquer"), icon: faLock, count: lockedCount }
    ], [achievements.length, unlockedCount, lockedCount, tr]);

    const filteredAchievements = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return achievements.filter((a) => {
            if (filterTab === "unlocked" && !a.unlocked) return false;
            if (filterTab === "locked" && a.unlocked) return false;
            if (q && !a.name.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [achievements, filterTab, searchQuery]);

    const openCreateModal = () => {
        setEditingAchievement(null);
        setNameInput("");
        setTotalStepsInput(1);
        setIconInput("trophy");
        setOrnamentInput("laurel");
        setIconColorInput("#f59e0b");
        setBgColorInput("#fef3c7");
        setUnlockedAtInput("");
        setIsFormOpen(true);
    };

    const openEditModal = (achievement: AchievementDTO) => {
        setEditingAchievement(achievement);
        setNameInput(achievement.name);
        setTotalStepsInput(achievement.totalSteps);
        setIconInput(achievement.icon || "trophy");
        setOrnamentInput(achievement.ornament || "laurel");
        setIconColorInput(achievement.iconColor || "#f59e0b");
        setBgColorInput(achievement.backgroundColor || "#fef3c7");
        setUnlockedAtInput(achievement.unlockedAt ? achievement.unlockedAt.slice(0, 10) : "");
        setIsFormOpen(true);
    };

    const handleSaveAchievement = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = nameInput.trim();
        if (!trimmedName) {
            enqueueSnackbar(
                tr("Please enter an achievement name", "Veuillez saisir un nom de succès"),
                { variant: "warning" }
            );
            return;
        }

        const steps = Math.max(1, Number(totalStepsInput) || 1);
        const unlockedAtIso = unlockedAtInput
            ? new Date(`${unlockedAtInput}T12:00:00Z`).toISOString()
            : null;

        try {
            setSubmitting(true);
            if (editingAchievement) {
                const payload: Record<string, unknown> = {
                    name: trimmedName,
                    totalSteps: steps,
                    icon: iconInput,
                    ornament: ornamentInput,
                    iconColor: iconColorInput,
                    backgroundColor: bgColorInput
                };
                if (unlockedAtIso) {
                    payload.completedSteps = steps;
                    payload.unlockedAt = unlockedAtIso;
                }
                const res = await session.customFetch(`/achievements/${editingAchievement.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                if (!res.ok) {
                    const errData = await res.json().catch(() => null);
                    throw new Error(errData?.message || `HTTP ${res.status}`);
                }
                const updated: AchievementDTO = await res.json();
                setAchievements((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
                enqueueSnackbar(tr("Achievement updated", "Succès mis à jour"), { variant: "success" });
            } else {
                const res = await session.customFetch("/achievements", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: trimmedName,
                        totalSteps: steps,
                        icon: iconInput,
                        ornament: ornamentInput,
                        iconColor: iconColorInput,
                        backgroundColor: bgColorInput,
                        unlockedAt: unlockedAtIso
                    })
                });
                if (!res.ok) {
                    const errData = await res.json().catch(() => null);
                    throw new Error(errData?.message || `HTTP ${res.status}`);
                }
                const created: AchievementDTO = await res.json();
                setAchievements((prev) => [created, ...prev]);
                enqueueSnackbar(tr("Achievement created", "Succès créé"), { variant: "success" });
            }
            setIsFormOpen(false);
        } catch (err) {
            console.error("Failed to save achievement:", err);
            const detail = err instanceof Error ? err.message : "";
            enqueueSnackbar(
                tr(
                    `Failed to save achievement${detail ? ` (${detail})` : ""}`,
                    `Impossible d'enregistrer le succès${detail ? ` (${detail})` : ""}`
                ),
                { variant: "error" }
            );
        } finally {
            setSubmitting(false);
        }
    };

    const updateSteps = async (achievement: AchievementDTO, nextSteps: number) => {
        const clamped = Math.max(0, Math.min(achievement.totalSteps, nextSteps));
        if (clamped === achievement.completedSteps) return;

        // Optimistic update
        const optimistic: AchievementDTO = {
            ...achievement,
            completedSteps: clamped,
            unlocked: clamped >= achievement.totalSteps,
            unlockedAt: clamped >= achievement.totalSteps
                ? (achievement.unlockedAt || new Date().toISOString())
                : null
        };
        setAchievements((prev) => prev.map((a) => (a.id === achievement.id ? optimistic : a)));

        try {
            const res = await session.customFetch(`/achievements/${achievement.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ completedSteps: clamped })
            });
            if (!res.ok) throw new Error("Failed to update progress");
            const saved: AchievementDTO = await res.json();
            setAchievements((prev) => prev.map((a) => (a.id === saved.id ? saved : a)));

            if (!achievement.unlocked && saved.unlocked) {
                enqueueSnackbar(
                    tr(`Achievement unlocked: ${saved.name}!`, `Succès débloqué : ${saved.name} !`),
                    { variant: "success" }
                );
            }
        } catch (err) {
            console.error("Failed to update achievement steps:", err);
            setAchievements((prev) => prev.map((a) => (a.id === achievement.id ? achievement : a)));
            enqueueSnackbar(
                tr("Failed to update achievement", "Impossible de mettre à jour le succès"),
                { variant: "error" }
            );
        }
    };

    const handleToggleCheckbox = (achievement: AchievementDTO, checked: boolean) => {
        updateSteps(achievement, checked ? achievement.totalSteps : 0);
    };

    const handleDeleteAchievement = async () => {
        if (!deleteConfirm) return;
        try {
            setSubmitting(true);
            const res = await session.customFetch(`/achievements/${deleteConfirm.id}`, {
                method: "DELETE"
            });
            if (!res.ok) throw new Error("Failed to delete");
            setAchievements((prev) => prev.filter((a) => a.id !== deleteConfirm.id));
            setDeleteConfirm(null);
            enqueueSnackbar(tr("Achievement deleted", "Succès supprimé"), { variant: "success" });
        } catch (err) {
            console.error("Failed to delete achievement:", err);
            enqueueSnackbar(
                tr("Failed to delete achievement", "Impossible de supprimer le succès"),
                { variant: "error" }
            );
        } finally {
            setSubmitting(false);
        }
    };

    const formatUnlockedDate = (dateStr: string | null) => {
        if (!dateStr) return "";
        try {
            return new Date(dateStr).toLocaleDateString(locale, {
                day: "numeric",
                month: "short",
                year: "numeric"
            });
        } catch {
            return "";
        }
    };

    return (
        <div className="achievements-page">
            <WrapperHeader>
                <div className="achievements-page__header-title">
                    <Link
                        to="/app/home"
                        className="achievements-page__back-btn"
                        title={tr("Back to Home", "Retour à l'accueil")}
                    >
                        <FontAwesomeIcon icon={faArrowLeft} />
                    </Link>
                    <h2>{tr("Achievements", "Succès")}</h2>
                </div>

                <HeaderFilterTabs
                    tabs={filterTabs}
                    selectedId={filterTab}
                    onChange={setFilterTab}
                    className="achievements-page__header-tabs"
                />

                <div className="achievements-page__header-actions">
                    <button
                        type="button"
                        className="achievements-page__add-btn"
                        onClick={openCreateModal}
                    >
                        <FontAwesomeIcon icon={faPlus} />
                        <span>{tr("New achievement", "Créer un succès")}</span>
                    </button>
                </div>
            </WrapperHeader>

            <div className="achievements-page__content">
                <div className={`achievements-page__summary ${unlockedCount > 0 ? "is-active" : ""}`}>
                    <div className="achievements-page__summary-lead">
                        <div className={`achievements-page__summary-icon ${unlockedCount > 0 ? "is-active" : ""}`}>
                            <FontAwesomeIcon icon={faTrophy} />
                        </div>
                        <div className="achievements-page__summary-progress">
                            <div className="achievements-page__summary-info">
                                <span className="achievements-page__summary-count">
                                    <strong>{unlockedCount}</strong>
                                    <span className="achievements-page__summary-total"> / {achievements.length}</span>
                                </span>
                                <span className="achievements-page__summary-label">
                                    {tr("achievements unlocked", "succès débloqués")}
                                </span>
                                <span className={`achievements-page__summary-rank ${achievementRank.active ? "is-active" : ""}`}>
                                    {achievementRank.label}
                                </span>
                            </div>
                            <div className="achievements-page__summary-track-row">
                                <div className="achievements-page__summary-bar">
                                    <div
                                        className="achievements-page__summary-bar-fill"
                                        style={{ width: `${progressPercent}%` }}
                                    />
                                    <div className="achievements-page__summary-milestones" aria-hidden="true">
                                        {[25, 50, 75, 100].map((m) => (
                                            <span
                                                key={m}
                                                className={`achievements-page__summary-milestone ${progressPercent >= m ? "is-reached" : ""}`}
                                                style={{ left: `${m}%` }}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <span className={`achievements-page__summary-percent ${unlockedCount > 0 ? "is-active" : ""}`}>
                                    {progressPercent}%
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="achievements-page__summary-search">
                        <SearchBar
                            value={searchQuery}
                            onChange={setSearchQuery}
                            placeholder={tr("Search achievements...", "Rechercher un succès...")}
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="achievements-page__empty">
                        {tr("Loading achievements...", "Chargement des succès...")}
                    </div>
                ) : filteredAchievements.length === 0 ? (
                    <Card className="achievements-page__empty-card">
                        <FontAwesomeIcon icon={faTrophy} className="achievements-page__empty-icon" />
                        <h3>
                            {achievements.length === 0
                                ? tr("No achievements yet", "Aucun succès pour le moment")
                                : tr("No matching achievements", "Aucun succès trouvé")}
                        </h3>
                        <p>
                            {achievements.length === 0
                                ? tr(
                                    "Create your first reading achievement and check it off when unlocked!",
                                    "Créez votre premier succès et cochez-le lorsque vous l'avez débloqué !"
                                )
                                : tr(
                                    "Try another filter or search term.",
                                    "Essayez un autre filtre ou une autre recherche."
                                )}
                        </p>
                        {achievements.length === 0 && (
                            <button
                                type="button"
                                className="achievements-page__add-btn"
                                onClick={openCreateModal}
                            >
                                <FontAwesomeIcon icon={faPlus} />
                                <span>{tr("Create an achievement", "Créer un succès")}</span>
                            </button>
                        )}
                    </Card>
                ) : (
                    <div className="achievements-page__grid">
                        {filteredAchievements.map((achievement) => {
                            const stepPercent = Math.round(
                                (achievement.completedSteps / Math.max(1, achievement.totalSteps)) * 100
                            );
                            return (
                                <div
                                    key={achievement.id}
                                    className={`achievement-card ${achievement.unlocked ? "is-unlocked" : "is-locked"}`}
                                    style={{
                                        "--medal-color": achievement.iconColor,
                                        "--medal-bg": achievement.backgroundColor
                                    } as React.CSSProperties}
                                >
                                    <div className="achievement-card__visual">
                                        <div className="achievement-card__scrim achievement-card__scrim--bottom" />

                                        <div className="achievement-card__top-bar">
                                            <span
                                                className={`achievement-card__status-badge ${
                                                    achievement.unlocked
                                                        ? "is-unlocked"
                                                        : achievement.completedSteps > 0
                                                            ? "is-in-progress"
                                                            : "is-locked"
                                                }`}
                                            >
                                                <FontAwesomeIcon icon={achievement.unlocked ? faCheck : faLock} />
                                                <span>
                                                    {achievement.unlocked
                                                        ? tr("Unlocked", "Débloqué")
                                                        : achievement.completedSteps > 0
                                                            ? tr("In progress", "En cours")
                                                            : tr("Locked", "À débloquer")}
                                                </span>
                                            </span>

                                            {achievement.totalSteps > 1 && (
                                                <span className="achievement-card__step-badge">
                                                    {achievement.completedSteps}/{achievement.totalSteps}
                                                </span>
                                            )}
                                        </div>

                                        <div className="achievement-card__medal-wrap">
                                            <AchievementMedal
                                                icon={achievement.icon}
                                                ornament={achievement.ornament}
                                                iconColor={achievement.iconColor}
                                                backgroundColor={achievement.backgroundColor}
                                                size="lg"
                                            />
                                        </div>

                                        {achievement.totalSteps > 1 && (
                                            <div className="achievement-card__progress-track">
                                                <div
                                                    className="achievement-card__progress-fill"
                                                    style={{ width: `${stepPercent}%` }}
                                                />
                                            </div>
                                        )}

                                        <div className="achievement-card__actions">
                                            {achievement.totalSteps > 1 && (
                                                <>
                                                    <button
                                                        type="button"
                                                        className="achievement-card__action-btn"
                                                        disabled={achievement.completedSteps <= 0}
                                                        onClick={() => updateSteps(achievement, achievement.completedSteps - 1)}
                                                        title={tr("Decrease step", "Retirer une étape")}
                                                        aria-label={tr("Decrease step", "Retirer une étape")}
                                                    >
                                                        <FontAwesomeIcon icon={faMinus} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="achievement-card__action-btn"
                                                        disabled={achievement.completedSteps >= achievement.totalSteps}
                                                        onClick={() => updateSteps(achievement, achievement.completedSteps + 1)}
                                                        title={tr("Complete a step", "Valider une étape")}
                                                        aria-label={tr("Complete a step", "Valider une étape")}
                                                    >
                                                        <FontAwesomeIcon icon={faPlus} />
                                                    </button>
                                                </>
                                            )}

                                            <button
                                                type="button"
                                                className={`achievement-card__action-btn achievement-card__action-btn--toggle ${achievement.unlocked ? "is-active" : ""}`}
                                                onClick={() => handleToggleCheckbox(achievement, !achievement.unlocked)}
                                                title={
                                                    achievement.unlocked
                                                        ? tr("Mark as locked", "Marquer comme non débloqué")
                                                        : tr("Mark as unlocked", "Débloquer")
                                                }
                                                aria-label={tr(`Toggle ${achievement.name}`, `Basculer ${achievement.name}`)}
                                            >
                                                <FontAwesomeIcon icon={faCheck} />
                                            </button>

                                            <span className="achievement-card__actions-divider" />

                                            <button
                                                type="button"
                                                className="achievement-card__action-btn achievement-card__action-btn--edit"
                                                onClick={() => openEditModal(achievement)}
                                                title={tr("Edit", "Modifier")}
                                                aria-label={tr(`Edit ${achievement.name}`, `Modifier ${achievement.name}`)}
                                            >
                                                <FontAwesomeIcon icon={faPen} />
                                            </button>
                                            <button
                                                type="button"
                                                className="achievement-card__action-btn achievement-card__action-btn--delete"
                                                onClick={() => setDeleteConfirm(achievement)}
                                                title={tr("Delete", "Supprimer")}
                                                aria-label={tr(`Delete ${achievement.name}`, `Supprimer ${achievement.name}`)}
                                            >
                                                <FontAwesomeIcon icon={faTrash} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="achievement-card__info">
                                        <h3 className="achievement-card__title" title={achievement.name}>
                                            {achievement.name}
                                        </h3>
                                        <span className="achievement-card__meta">
                                            {achievement.unlocked
                                                ? achievement.unlockedAt
                                                    ? formatUnlockedDate(achievement.unlockedAt)
                                                    : tr("Unlocked", "Débloqué")
                                                : achievement.totalSteps > 1
                                                    ? tr(
                                                        `${achievement.completedSteps} / ${achievement.totalSteps} steps (${stepPercent}%)`,
                                                        `${achievement.completedSteps} / ${achievement.totalSteps} étapes (${stepPercent}%)`
                                                    )
                                                    : tr("Not unlocked yet", "Non débloqué")}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Create / Edit Modal */}
            <Dialog
                open={isFormOpen}
                onClose={closeFormModal}
                maxWidth="xs"
                fullWidth
                slotProps={{ paper: { className: "achievements-modal achievements-modal--form" } }}
            >
                <form onSubmit={handleSaveAchievement}>
                    <div className="achievements-modal__header">
                        <h3>
                            <FontAwesomeIcon icon={faTrophy} className="achievements-modal__title-icon" />
                            <span>
                                {editingAchievement
                                    ? tr("Edit achievement", "Modifier le succès")
                                    : tr("New achievement", "Créer un succès")}
                            </span>
                        </h3>
                        <button
                            type="button"
                            className="achievements-modal__close"
                            onClick={closeFormModal}
                            disabled={submitting}
                            aria-label={tr("Close", "Fermer")}
                        >
                            <FontAwesomeIcon icon={faXmark} />
                        </button>
                    </div>

                    <div className="achievements-modal__body">
                        {/* Live preview: Locked vs Unlocked */}
                        <div className="achievements-modal__preview-row">
                            <div className="achievements-modal__preview-item is-locked">
                                <AchievementMedal
                                    icon={iconInput}
                                    ornament={ornamentInput}
                                    iconColor={iconColorInput}
                                    backgroundColor={bgColorInput}
                                    size="md"
                                />
                                <span>{tr("Locked", "Grisé")}</span>
                            </div>
                            <div className="achievements-modal__preview-item is-unlocked">
                                <AchievementMedal
                                    icon={iconInput}
                                    ornament={ornamentInput}
                                    iconColor={iconColorInput}
                                    backgroundColor={bgColorInput}
                                    size="md"
                                />
                                <span>{tr("Unlocked", "Débloqué")}</span>
                            </div>
                        </div>

                        <div className="achievements-modal__field">
                            <label htmlFor="achievement-name">
                                {tr("Achievement name", "Nom du succès")}
                            </label>
                            <input
                                id="achievement-name"
                                type="text"
                                value={nameInput}
                                onChange={(e) => setNameInput(e.target.value)}
                                placeholder={tr("e.g. Read 10 mangas", "Ex : Lire 10 mangas")}
                                maxLength={150}
                                required
                            />
                        </div>

                        <div className="achievements-modal__row">
                            <div className="achievements-modal__field">
                                <label htmlFor="achievement-steps">
                                    {tr("Number of steps", "Nombre d'étapes")}
                                </label>
                                <input
                                    id="achievement-steps"
                                    type="number"
                                    min={1}
                                    max={9999}
                                    value={totalStepsInput}
                                    onChange={(e) => setTotalStepsInput(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                    required
                                />
                            </div>

                            <div className="achievements-modal__field">
                                <label htmlFor="achievement-unlocked-at">
                                    {tr("Unlock date (optional)", "Date d'obtention (optionnel)")}
                                </label>
                                <input
                                    id="achievement-unlocked-at"
                                    type="date"
                                    value={unlockedAtInput}
                                    onChange={(e) => setUnlockedAtInput(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="achievements-modal__row">
                            <div className="achievements-modal__field">
                                <label htmlFor="achievement-ornament">
                                    {tr("Ornament", "Ornement")}
                                </label>
                                <Select
                                    id="achievement-ornament"
                                    className="achievements-modal__select"
                                    options={ACHIEVEMENT_ORNAMENT_OPTIONS}
                                    value={ornamentInput}
                                    onChange={(val: string) => setOrnamentInput(val)}
                                    placeholder={tr("Ornament", "Ornement")}
                                />
                            </div>

                            <div className="achievements-modal__field">
                                <label htmlFor="achievement-icon-trigger">
                                    {tr("Icon", "Icône")}
                                </label>
                                <button
                                    id="achievement-icon-trigger"
                                    type="button"
                                    className={`achievements-modal__picker-trigger ${iconAnchorEl ? "is-open" : ""}`}
                                    onClick={(e) => setIconAnchorEl(e.currentTarget)}
                                    aria-haspopup="true"
                                    aria-expanded={Boolean(iconAnchorEl)}
                                >
                                    <span
                                        className="achievements-modal__picker-icon-badge"
                                        style={{ backgroundColor: bgColorInput, color: iconColorInput }}
                                    >
                                        <AchievementIcon icon={iconInput} />
                                    </span>
                                    <span className="achievements-modal__picker-label">
                                        {selectedIconOption.label}
                                    </span>
                                    <FontAwesomeIcon
                                        icon={faChevronDown}
                                        className={`achievements-modal__picker-chevron ${iconAnchorEl ? "is-open" : ""}`}
                                    />
                                </button>
                            </div>
                        </div>

                        <div className="achievements-modal__row">
                            <div className="achievements-modal__field">
                                <label htmlFor="achievement-icon-color-trigger">
                                    {tr("Icon color", "Couleur de l'icône")}
                                </label>
                                <button
                                    id="achievement-icon-color-trigger"
                                    type="button"
                                    className={`achievements-modal__picker-trigger ${colorPickerState?.target === "icon" ? "is-open" : ""}`}
                                    onClick={(e) =>
                                        setColorPickerState({ anchorEl: e.currentTarget, target: "icon" })
                                    }
                                    aria-haspopup="true"
                                    aria-expanded={colorPickerState?.target === "icon"}
                                >
                                    <span
                                        className="achievements-modal__picker-swatch"
                                        style={{ backgroundColor: iconColorInput }}
                                    />
                                    <span className="achievements-modal__picker-hex">
                                        {iconColorInput.toUpperCase()}
                                    </span>
                                    <FontAwesomeIcon
                                        icon={faChevronDown}
                                        className={`achievements-modal__picker-chevron ${colorPickerState?.target === "icon" ? "is-open" : ""}`}
                                    />
                                </button>
                            </div>

                            <div className="achievements-modal__field">
                                <label htmlFor="achievement-bg-color-trigger">
                                    {tr("Background color", "Couleur de fond")}
                                </label>
                                <button
                                    id="achievement-bg-color-trigger"
                                    type="button"
                                    className={`achievements-modal__picker-trigger ${colorPickerState?.target === "bg" ? "is-open" : ""}`}
                                    onClick={(e) =>
                                        setColorPickerState({ anchorEl: e.currentTarget, target: "bg" })
                                    }
                                    aria-haspopup="true"
                                    aria-expanded={colorPickerState?.target === "bg"}
                                >
                                    <span
                                        className="achievements-modal__picker-swatch"
                                        style={{ backgroundColor: bgColorInput }}
                                    />
                                    <span className="achievements-modal__picker-hex">
                                        {bgColorInput.toUpperCase()}
                                    </span>
                                    <FontAwesomeIcon
                                        icon={faChevronDown}
                                        className={`achievements-modal__picker-chevron ${colorPickerState?.target === "bg" ? "is-open" : ""}`}
                                    />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="achievements-modal__footer">
                        <button
                            type="button"
                            className="achievements-modal__btn is-secondary"
                            onClick={closeFormModal}
                            disabled={submitting}
                        >
                            {tr("Cancel", "Annuler")}
                        </button>
                        <button
                            type="submit"
                            className="achievements-modal__btn is-primary"
                            disabled={submitting}
                        >
                            {editingAchievement
                                ? tr("Save", "Enregistrer")
                                : tr("Create", "Créer")}
                        </button>
                    </div>
                </form>
            </Dialog>

            {/* Icon Picker Popover */}
            <Popover
                open={Boolean(iconAnchorEl)}
                anchorEl={iconAnchorEl}
                onClose={() => setIconAnchorEl(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
                slotProps={{ paper: { className: "achievements-popover" } }}
            >
                <div className="achievements-popover__title">{tr("Choose an icon", "Choisir une icône")}</div>
                <div className="achievements-popover__icon-grid">
                    {ACHIEVEMENT_ICON_OPTIONS.map((opt) => (
                        <button
                            key={opt.id}
                            type="button"
                            className={`achievements-popover__icon-option ${iconInput === opt.id ? "is-selected" : ""}`}
                            onClick={() => {
                                setIconInput(opt.id);
                                setIconAnchorEl(null);
                            }}
                            title={opt.label}
                            aria-label={opt.label}
                        >
                            <AchievementIcon icon={opt.id} />
                        </button>
                    ))}
                </div>
            </Popover>

            {/* Color Picker Popover */}
            <Popover
                open={Boolean(colorPickerState)}
                anchorEl={colorPickerState?.anchorEl ?? null}
                onClose={() => setColorPickerState(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                transformOrigin={{ vertical: "top", horizontal: "left" }}
                slotProps={{ paper: { className: "achievements-popover" } }}
            >
                {colorPickerState && (() => {
                    const isIcon = colorPickerState.target === "icon";
                    const currentColor = isIcon ? iconColorInput : bgColorInput;
                    const setColor = isIcon ? setIconColorInput : setBgColorInput;
                    const presets = isIcon ? COLOR_PRESETS : BG_PRESETS;
                    return (
                        <>
                            <div className="achievements-popover__title">
                                {isIcon
                                    ? tr("Icon color", "Couleur de l'icône")
                                    : tr("Background color", "Couleur de fond")}
                            </div>
                            <div className="achievements-popover__swatches">
                                {presets.map((color) => (
                                    <button
                                        key={color}
                                        type="button"
                                        className={`achievements-popover__swatch ${currentColor.toLowerCase() === color ? "is-selected" : ""}`}
                                        style={{ backgroundColor: color }}
                                        onClick={() => {
                                            setColor(color);
                                            setColorPickerState(null);
                                        }}
                                        aria-label={color}
                                        title={color.toUpperCase()}
                                    />
                                ))}
                            </div>
                            <div className="achievements-popover__custom">
                                <label htmlFor="achievement-custom-color">
                                    {tr("Custom", "Personnalisée")}
                                </label>
                                <div className="achievements-popover__custom-controls">
                                    <input
                                        id="achievement-custom-color"
                                        type="color"
                                        value={currentColor}
                                        onChange={(e) => setColor(e.target.value)}
                                    />
                                    <span className="achievements-popover__custom-hex">
                                        {currentColor.toUpperCase()}
                                    </span>
                                </div>
                            </div>
                        </>
                    );
                })()}
            </Popover>

            {/* Delete confirmation Modal */}
            <Dialog
                open={Boolean(deleteConfirm)}
                onClose={() => !submitting && setDeleteConfirm(null)}
                maxWidth="xs"
                fullWidth
                slotProps={{ paper: { className: "achievements-modal" } }}
            >
                <div className="achievements-modal__header">
                    <h3>{tr("Delete achievement", "Supprimer le succès")}</h3>
                    <button
                        type="button"
                        className="achievements-modal__close"
                        onClick={() => setDeleteConfirm(null)}
                        disabled={submitting}
                    >
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>
                <div className="achievements-modal__body">
                    <p className="achievements-modal__confirm-text">
                        {tr(
                            `Are you sure you want to delete "${deleteConfirm?.name}"?`,
                            `Voulez-vous vraiment supprimer le succès « ${deleteConfirm?.name} » ?`
                        )}
                    </p>
                </div>
                <div className="achievements-modal__footer">
                    <button
                        type="button"
                        className="achievements-modal__btn is-secondary"
                        onClick={() => setDeleteConfirm(null)}
                        disabled={submitting}
                    >
                        {tr("Cancel", "Annuler")}
                    </button>
                    <button
                        type="button"
                        className="achievements-modal__btn is-danger"
                        onClick={handleDeleteAchievement}
                        disabled={submitting}
                    >
                        {tr("Delete", "Supprimer")}
                    </button>
                </div>
            </Dialog>
        </div>
    );
}
