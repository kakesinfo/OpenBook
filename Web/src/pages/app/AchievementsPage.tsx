import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router";
import { WrapperHeader } from "../../components/Wrapper/Wrapper.tsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faArrowLeft,
    faLock,
    faMinus,
    faPen,
    faPlus,
    faTrash,
    faTrophy,
    faUnlock,
    faXmark
} from "@fortawesome/free-solid-svg-icons";
import { Checkbox, Dialog, LinearProgress } from "@mui/material";
import { enqueueSnackbar } from "notistack";
import useSession from "../../hooks/UseSession.tsx";
import useLanguage from "../../hooks/UseLanguage.tsx";
import AchievementDTO from "../../dto/Achievement.dto.ts";
import Card from "../../components/Card/Card.tsx";
import FormGroup from "../../components/Form/FormGroup.tsx";
import SearchBar from "../../components/SearchBar/SearchBar.tsx";
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

    const fetchAchievements = async () => {
        try {
            setLoading(true);
            const res = await session.customFetch("/achievements", { method: "GET" });
            if (res.ok) {
                const data = await res.json();
                setAchievements(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error("Failed to load achievements:", err);
            enqueueSnackbar(
                tr("Failed to load achievements", "Impossible de charger les succès"),
                { variant: "error" }
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAchievements();
    }, []);

    const unlockedCount = useMemo(
        () => achievements.filter((a) => a.unlocked).length,
        [achievements]
    );
    const lockedCount = achievements.length - unlockedCount;
    const progressPercent = achievements.length > 0
        ? Math.round((unlockedCount / achievements.length) * 100)
        : 0;

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
            return new Date(dateStr).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
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
                <Card className="achievements-page__summary">
                    <div className="achievements-page__summary-progress">
                        <div className="achievements-page__summary-info">
                            <div className="achievements-page__summary-title">
                                <span>
                                    {tr(
                                        `${unlockedCount} / ${achievements.length} achievements unlocked`,
                                        `${unlockedCount} / ${achievements.length} succès débloqués`
                                    )}
                                </span>
                            </div>
                            <span className="achievements-page__summary-percent">{progressPercent}%</span>
                        </div>
                        <LinearProgress
                            variant="determinate"
                            value={progressPercent}
                            className="achievements-page__summary-bar"
                        />
                    </div>

                    <div className="achievements-page__summary-search">
                        <SearchBar
                            value={searchQuery}
                            onChange={setSearchQuery}
                            placeholder={tr("Search achievements...", "Rechercher un succès...")}
                        />
                    </div>
                </Card>

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
                                <Card
                                    key={achievement.id}
                                    className={`achievement-card ${achievement.unlocked ? "is-unlocked" : "is-locked"}`}
                                    style={{
                                        "--medal-color": achievement.iconColor,
                                        "--medal-bg": achievement.backgroundColor
                                    } as React.CSSProperties}
                                >
                                    <div className="achievement-card__medal-wrap">
                                        <AchievementMedal
                                            icon={achievement.icon}
                                            ornament={achievement.ornament}
                                            iconColor={achievement.iconColor}
                                            backgroundColor={achievement.backgroundColor}
                                            size="lg"
                                        />
                                    </div>

                                    <div className="achievement-card__info">
                                        <h3 className="achievement-card__name">{achievement.name}</h3>
                                        <span className="achievement-card__status">
                                            {achievement.unlocked
                                                ? tr(
                                                    `Unlocked${achievement.unlockedAt ? ` • ${formatUnlockedDate(achievement.unlockedAt)}` : ""}`,
                                                    `Débloqué${achievement.unlockedAt ? ` • ${formatUnlockedDate(achievement.unlockedAt)}` : ""}`
                                                )
                                                : achievement.totalSteps > 1
                                                    ? tr(
                                                        `${achievement.completedSteps} / ${achievement.totalSteps} steps`,
                                                        `${achievement.completedSteps} / ${achievement.totalSteps} étapes`
                                                    )
                                                    : tr("Locked", "À débloquer")}
                                        </span>
                                    </div>

                                    {achievement.totalSteps > 1 && (
                                        <div className="achievement-card__steps">
                                            <LinearProgress
                                                variant="determinate"
                                                value={stepPercent}
                                                className="achievement-card__progress"
                                            />
                                            <div className="achievement-card__step-controls">
                                                <button
                                                    type="button"
                                                    className="achievement-card__step-btn"
                                                    disabled={achievement.completedSteps <= 0}
                                                    onClick={() => updateSteps(achievement, achievement.completedSteps - 1)}
                                                    title={tr("Decrease step", "Retirer une étape")}
                                                >
                                                    <FontAwesomeIcon icon={faMinus} />
                                                </button>
                                                <span className="achievement-card__step-count">
                                                    {achievement.completedSteps} / {achievement.totalSteps}
                                                </span>
                                                <button
                                                    type="button"
                                                    className="achievement-card__step-btn"
                                                    disabled={achievement.completedSteps >= achievement.totalSteps}
                                                    onClick={() => updateSteps(achievement, achievement.completedSteps + 1)}
                                                    title={tr("Complete a step", "Valider une étape")}
                                                >
                                                    <FontAwesomeIcon icon={faPlus} />
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="achievement-card__footer">
                                        <button
                                            type="button"
                                            className="achievement-card__action-btn"
                                            onClick={() => openEditModal(achievement)}
                                            title={tr("Edit", "Modifier")}
                                        >
                                            <FontAwesomeIcon icon={faPen} />
                                        </button>
                                        <Checkbox
                                            checked={achievement.unlocked}
                                            onChange={(e) => handleToggleCheckbox(achievement, e.target.checked)}
                                            inputProps={{
                                                "aria-label": tr(
                                                    `Toggle ${achievement.name}`,
                                                    `Cocher ${achievement.name}`
                                                )
                                            }}
                                            className="achievement-card__checkbox"
                                        />
                                        <button
                                            type="button"
                                            className="achievement-card__action-btn is-danger"
                                            onClick={() => setDeleteConfirm(achievement)}
                                            title={tr("Delete", "Supprimer")}
                                        >
                                            <FontAwesomeIcon icon={faTrash} />
                                        </button>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Create / Edit Modal */}
            <Dialog
                open={isFormOpen}
                onClose={() => !submitting && setIsFormOpen(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{ className: "achievements-modal" }}
            >
                <form onSubmit={handleSaveAchievement}>
                    <div className="achievements-modal__header">
                        <h3>
                            {editingAchievement
                                ? tr("Edit achievement", "Modifier le succès")
                                : tr("New achievement", "Créer un succès")}
                        </h3>
                        <button
                            type="button"
                            className="achievements-modal__close"
                            onClick={() => setIsFormOpen(false)}
                            disabled={submitting}
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

                        <FormGroup>
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
                        </FormGroup>

                        <FormGroup>
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
                        </FormGroup>

                        <FormGroup>
                            <label htmlFor="achievement-unlocked-at">
                                {tr("Unlock date (optional)", "Date d'obtention (optionnel)")}
                            </label>
                            <input
                                id="achievement-unlocked-at"
                                type="date"
                                value={unlockedAtInput}
                                onChange={(e) => setUnlockedAtInput(e.target.value)}
                            />
                        </FormGroup>

                        <FormGroup>
                            <label>{tr("Ornament", "Ornement autour de l'icône")}</label>
                            <div className="achievements-modal__ornament-grid">
                                {ACHIEVEMENT_ORNAMENT_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        className={`achievements-modal__ornament-option ${ornamentInput === opt.id ? "is-selected" : ""}`}
                                        onClick={() => setOrnamentInput(opt.id)}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </FormGroup>

                        <FormGroup>
                            <label>{tr("Icon", "Icône")}</label>
                            <div className="achievements-modal__icon-grid">
                                {ACHIEVEMENT_ICON_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        className={`achievements-modal__icon-option ${iconInput === opt.id ? "is-selected" : ""}`}
                                        onClick={() => setIconInput(opt.id)}
                                        title={opt.label}
                                    >
                                        <AchievementIcon icon={opt.id} />
                                    </button>
                                ))}
                            </div>
                        </FormGroup>

                        <div className="achievements-modal__colors">
                            <FormGroup>
                                <label htmlFor="achievement-icon-color">
                                    {tr("Icon color", "Couleur de l'icône")}
                                </label>
                                <div className="achievements-modal__color-row">
                                    <input
                                        id="achievement-icon-color"
                                        type="color"
                                        value={iconColorInput}
                                        onChange={(e) => setIconColorInput(e.target.value)}
                                    />
                                    <div className="achievements-modal__swatches">
                                        {COLOR_PRESETS.map((color) => (
                                            <button
                                                key={color}
                                                type="button"
                                                className={`achievements-modal__swatch ${iconColorInput.toLowerCase() === color ? "is-selected" : ""}`}
                                                style={{ backgroundColor: color }}
                                                onClick={() => setIconColorInput(color)}
                                                aria-label={color}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </FormGroup>

                            <FormGroup>
                                <label htmlFor="achievement-bg-color">
                                    {tr("Background color", "Couleur de fond")}
                                </label>
                                <div className="achievements-modal__color-row">
                                    <input
                                        id="achievement-bg-color"
                                        type="color"
                                        value={bgColorInput}
                                        onChange={(e) => setBgColorInput(e.target.value)}
                                    />
                                    <div className="achievements-modal__swatches">
                                        {BG_PRESETS.map((color) => (
                                            <button
                                                key={color}
                                                type="button"
                                                className={`achievements-modal__swatch ${bgColorInput.toLowerCase() === color ? "is-selected" : ""}`}
                                                style={{ backgroundColor: color }}
                                                onClick={() => setBgColorInput(color)}
                                                aria-label={color}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </FormGroup>
                        </div>
                    </div>

                    <div className="achievements-modal__footer">
                        <button
                            type="button"
                            className="achievements-modal__btn is-secondary"
                            onClick={() => setIsFormOpen(false)}
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

            {/* Delete confirmation Modal */}
            <Dialog
                open={Boolean(deleteConfirm)}
                onClose={() => !submitting && setDeleteConfirm(null)}
                maxWidth="xs"
                fullWidth
                PaperProps={{ className: "achievements-modal" }}
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
