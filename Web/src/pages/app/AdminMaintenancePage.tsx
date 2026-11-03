import { WrapperHeader } from "../../components/Wrapper/Wrapper.tsx";
import { useState, useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faWrench,
    faClone,
    faBarcode,
    faCheckDouble,
    faCheck,
    faRotate,
    faTriangleExclamation,
    faPlay,
    faImage,
    faUserPen
} from "@fortawesome/free-solid-svg-icons";
import useSession from "../../hooks/UseSession.tsx";
import useLanguage from "../../hooks/UseLanguage.tsx";
import "./AdminMaintenancePage.scss";

type TaskId = "utf8" | "dedup" | "dedup_authors" | "bnf" | "verify_isbn" | "migrate_covers";

interface MaintenanceTaskDef {
    id: TaskId;
    title: [string, string];
    tag: [string, string];
    desc: [string, string];
    icon: typeof faWrench;
    iconClass: string;
}

const TASKS: MaintenanceTaskDef[] = [
    {
        id: "utf8",
        title: ["Repair UTF-8", "Réparer l'UTF-8"],
        tag: ["Encoding & Typography", "Encodage & Typographie"],
        desc: [
            "Detects and repairs text corrupted by double UTF-8 encoding (e.g., dÃ©mon -> démon), normalizes Unicode dashes (–, —), cleans up stray author roles, and consolidates corrupted series.",
            "Détecte et répare les textes corrompus par un double encodage UTF-8 (ex: dÃ©mon -> démon), normalise les tirets Unicode (–, —), nettoie les rôles parasites d'auteurs et consolide les séries corrompues."
        ],
        icon: faWrench,
        iconClass: "admin-maintenance__task-icon--utf8"
    },
    {
        id: "dedup",
        title: ["Deduplicate books", "Dédoupliquer les albums"],
        tag: ["Catalog Integrity", "Intégrité du catalogue"],
        desc: [
            "Finds and merges duplicate books from the same publisher (same cover, same ISBN, or near-identical titles with dash or case variations). Automatically reassigns your readings and collection items to the canonical volume without data loss.",
            "Recherche et fusionne les albums en double d'un même éditeur (même couverture, même ISBN, ou titres quasi-identiques avec variations de tirets ou casse). Réattribue automatiquement vos lectures et possessions vers le tome canonique sans perte de données."
        ],
        icon: faClone,
        iconClass: "admin-maintenance__task-icon--dedup"
    },
    {
        id: "dedup_authors",
        title: ["Merge duplicate authors", "Fusionner les auteurs en double"],
        tag: ["Authors & Normalization", "Auteurs & Normalisation"],
        desc: [
            "Analyzes all authors in the catalog to identify duplicates (swapped first/last names, case, accents, punctuation variations like 'TYNION IV James' vs 'James Tynion IV'). Merges profiles into the highest-quality entry, reassigns books and subscriptions without conflict, and removes duplicates.",
            "Analyse tous les auteurs du catalogue pour identifier les doublons (inversions prénom/nom, casse, accents, variations de ponctuation comme 'TYNION IV James' vs 'James Tynion IV'). Fusionne les profils vers le plus qualitatif, réattribue les albums et abonnements sans conflit, et supprime les doublons."
        ],
        icon: faUserPen,
        iconClass: "admin-maintenance__task-icon--authors"
    },
    {
        id: "bnf",
        title: ["Enrich via BnF", "Enrichir via la BnF"],
        tag: ["Catalog & Metadata", "Catalogue & Métadonnées"],
        desc: [
            "Queries the National Library of France (BnF) SRU catalog API to retrieve missing ISBN/EAN codes, page counts, collections, and authors for your books.",
            "Interroge l'API SRU du catalogue de la Bibliothèque nationale de France (BnF) pour retrouver les ISBN/EAN manquants, le nombre de pages, la collection et les auteurs de vos albums."
        ],
        icon: faBarcode,
        iconClass: "admin-maintenance__task-icon--bnf"
    },
    {
        id: "verify_isbn",
        title: ["Verify with BnF", "Vérifier avec la BnF"],
        tag: ["Verification & Pages", "Contrôle & Pages"],
        desc: [
            "Verifies every book with an ISBN against the BnF catalog to fix exact page counts, link official collections, and fill in missing authors.",
            "Vérifie chaque album ayant un ISBN auprès du catalogue BnF pour corriger le nombre exact de pages, rattacher la collection officielle et compléter les auteurs manquants."
        ],
        icon: faCheckDouble,
        iconClass: "admin-maintenance__task-icon--verify"
    },
    {
        id: "migrate_covers",
        title: ["Migrate covers", "Migrer les couvertures"],
        tag: ["Media & Storage", "Médias & Stockage"],
        desc: [
            "Downloads covers still referenced by an external URL, optimizes them as WebP via the media service, and replaces the URL with the image UUID in the database. Unreachable images keep their original URL.",
            "Télécharge les couvertures encore référencées par une URL externe, les optimise en WebP via le service média, puis remplace l'URL par l'UUID de l'image en base. Les images inaccessibles conservent leur URL d'origine."
        ],
        icon: faImage,
        iconClass: "admin-maintenance__task-icon--media"
    }
];

interface TaskStatusInfo {
    state: "idle" | "running" | "success" | "error";
    message?: string;
    timestamp?: string;
}

interface MaintenanceResult {
    taskName: string;
    type: "success" | "error";
    message: string;
    timestamp: string;
}

export default function AdminMaintenancePage() {
    const session = useSession();
    const { tr, locale } = useLanguage();
    const [selectedTasks, setSelectedTasks] = useState<TaskId[]>([]);
    const [runningTasks, setRunningTasks] = useState<TaskId[]>([]);
    const [result, setResult] = useState<MaintenanceResult | null>(null);
    const [taskStatuses, setTaskStatuses] = useState<Record<TaskId, TaskStatusInfo>>({
        utf8: { state: "idle" },
        dedup: { state: "idle" },
        dedup_authors: { state: "idle" },
        bnf: { state: "idle" },
        verify_isbn: { state: "idle" },
        migrate_covers: { state: "idle" }
    });

    const headerCheckboxRef = useRef<HTMLInputElement>(null);

    const allSelected = selectedTasks.length === TASKS.length;
    const isIndeterminate = selectedTasks.length > 0 && !allSelected;

    useEffect(() => {
        if (headerCheckboxRef.current) {
            headerCheckboxRef.current.indeterminate = isIndeterminate;
        }
    }, [isIndeterminate]);

    const nowFormatted = () => {
        const d = new Date();
        return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    };

    const handleToggleSelect = (taskId: TaskId) => {
        setSelectedTasks(prev =>
            prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
        );
    };

    const handleSelectAll = () => {
        if (allSelected) {
            setSelectedTasks([]);
        } else {
            setSelectedTasks(TASKS.map(t => t.id));
        }
    };

    const runSingleTask = async (taskId: TaskId): Promise<{ ok: boolean; message: string }> => {
        let endpoint = "/admin/scrapers/repair";
        let taskName = tr("UTF-8 repair", "Réparation UTF-8");
        if (taskId === "dedup") {
            endpoint = "/admin/scrapers/deduplicate";
            taskName = tr("Book deduplication", "Déduplication des albums");
        } else if (taskId === "dedup_authors") {
            endpoint = "/admin/scrapers/maintenance/deduplicate-authors";
            taskName = tr("Author merging", "Fusion des auteurs");
        } else if (taskId === "bnf") {
            endpoint = "/admin/scrapers/enrich-bnf";
            taskName = tr("BnF enrichment", "Enrichissement BnF");
        } else if (taskId === "verify_isbn") {
            endpoint = "/admin/scrapers/verify-isbn";
            taskName = tr("BnF verification", "Vérification BnF");
        } else if (taskId === "migrate_covers") {
            endpoint = "/admin/scrapers/maintenance/migrate-covers";
            taskName = tr("Cover migration", "Migration des couvertures");
        }

        setTaskStatuses(prev => ({
            ...prev,
            [taskId]: { state: "running" }
        }));

        try {
            const resp = await session.customFetch(endpoint, { method: "POST" });
            const data = await resp.json();
            const msg = data.message || tr(`${taskName} completed successfully.`, `${taskName} effectuée avec succès.`);

            setTaskStatuses(prev => ({
                ...prev,
                [taskId]: {
                    state: "success",
                    message: msg,
                    timestamp: nowFormatted()
                }
            }));
            return { ok: true, message: msg };
        } catch (err: any) {
            const errorMsg = err?.message || tr(`Error while running ${taskName}.`, `Erreur lors de l'exécution de ${taskName}.`);
            setTaskStatuses(prev => ({
                ...prev,
                [taskId]: {
                    state: "error",
                    message: errorMsg,
                    timestamp: nowFormatted()
                }
            }));
            return { ok: false, message: errorMsg };
        }
    };

    const handleExecuteTask = async (taskId: TaskId) => {
        if (runningTasks.length > 0) return;
        setRunningTasks([taskId]);
        setResult(null);

        const taskDef = TASKS.find(t => t.id === taskId);
        const res = await runSingleTask(taskId);

        setResult({
            taskName: taskDef ? tr(taskDef.title[0], taskDef.title[1]) : taskId,
            type: res.ok ? "success" : "error",
            message: res.message,
            timestamp: nowFormatted()
        });

        setRunningTasks([]);
    };

    const handleExecuteSelected = async () => {
        if (runningTasks.length > 0 || selectedTasks.length === 0) return;
        const targetIds = selectedTasks;
        setRunningTasks(targetIds);
        setResult(null);

        const results: string[] = [];
        let anyError = false;

        for (const taskId of targetIds) {
            const res = await runSingleTask(taskId);
            if (!res.ok) anyError = true;
            results.push(res.message);
        }

        setResult({
            taskName: tr(
                `Selection (${targetIds.length} task${targetIds.length > 1 ? "s" : ""})`,
                `Sélection (${targetIds.length} tâche${targetIds.length > 1 ? "s" : ""})`
            ),
            type: anyError ? "error" : "success",
            message: results.join(" | "),
            timestamp: nowFormatted()
        });

        setRunningTasks([]);
    };

    const handleExecuteAll = async () => {
        if (runningTasks.length > 0) return;
        setRunningTasks(["utf8", "dedup", "dedup_authors", "bnf", "verify_isbn", "migrate_covers"]);
        setResult(null);

        const results: string[] = [];
        let anyError = false;

        const resUtf8 = await runSingleTask("utf8");
        if (!resUtf8.ok) anyError = true;
        results.push(resUtf8.message);

        const resDedup = await runSingleTask("dedup");
        if (!resDedup.ok) anyError = true;
        results.push(resDedup.message);

        const resAuthors = await runSingleTask("dedup_authors");
        if (!resAuthors.ok) anyError = true;
        results.push(resAuthors.message);

        const resBnf = await runSingleTask("bnf");
        if (!resBnf.ok) anyError = true;
        results.push(resBnf.message);

        const resVerify = await runSingleTask("verify_isbn");
        if (!resVerify.ok) anyError = true;
        results.push(resVerify.message);

        const resCovers = await runSingleTask("migrate_covers");
        if (!resCovers.ok) anyError = true;
        results.push(resCovers.message);

        setResult({
            taskName: tr("Full maintenance (All)", "Maintenance complète (Tout)"),
            type: anyError ? "error" : "success",
            message: results.join(" | "),
            timestamp: nowFormatted()
        });

        setRunningTasks([]);
    };

    const isRunning = runningTasks.length > 0;

    return (
        <div className="admin-maintenance">
            <WrapperHeader>
                <h2>{tr("Maintenance", "Maintenance")}</h2>
            </WrapperHeader>

            <div className="admin-maintenance__content">
                {/* Result Message */}
                {result && (
                    <div className={`admin-maintenance__result admin-maintenance__result--${result.type}`}>
                        <div className="admin-maintenance__result-content">
                            <FontAwesomeIcon icon={result.type === "success" ? faCheck : faTriangleExclamation} />
                            <span><strong>{result.taskName} :</strong> {result.message}</span>
                        </div>
                        <div className="admin-maintenance__result-time">
                            {tr(`Executed at ${result.timestamp}`, `Exécuté à ${result.timestamp}`)}
                        </div>
                    </div>
                )}

                {/* Maintenance Tasks Panel */}
                <div className="admin-maintenance__panel">
                    <div className="admin-maintenance__panel-header">
                        <div className="admin-maintenance__panel-title-group">
                            <div className="admin-maintenance__panel-title-row">
                                <h3>{tr("Maintenance Tasks", "Tâches de maintenance")}</h3>
                                <span className="admin-maintenance__badge">
                                    {tr(`${TASKS.length} available`, `${TASKS.length} disponibles`)}
                                </span>
                                {selectedTasks.length > 0 && (
                                    <span className="admin-maintenance__badge admin-maintenance__badge--selected">
                                        {tr(
                                            `${selectedTasks.length} selected`,
                                            `${selectedTasks.length} cochée${selectedTasks.length > 1 ? "s" : ""}`
                                        )}
                                    </span>
                                )}
                            </div>
                            <p className="admin-maintenance__panel-subtitle">
                                {tr(
                                    "Check the tasks to run or launch a full maintenance in one click.",
                                    "Cochez les tâches à exécuter ou lancez une maintenance complète en un clic."
                                )}
                            </p>
                        </div>

                        <div className="admin-maintenance__panel-actions">
                            {selectedTasks.length > 0 && (
                                <button
                                    type="button"
                                    className="admin-maintenance__btn-action admin-maintenance__btn-action--execute"
                                    onClick={handleExecuteSelected}
                                    disabled={isRunning}
                                    title={tr("Run selected tasks", "Exécuter les tâches sélectionnées")}
                                >
                                    <FontAwesomeIcon icon={isRunning ? faRotate : faPlay} spin={isRunning} />
                                    <span>
                                        {tr(`Run selected (${selectedTasks.length})`, `Exécuter la sélection (${selectedTasks.length})`)}
                                    </span>
                                </button>
                            )}

                            <button
                                type="button"
                                className="admin-maintenance__btn-action admin-maintenance__btn-action--all"
                                onClick={handleExecuteAll}
                                disabled={isRunning}
                                title={tr("Run all maintenance tasks consecutively", "Exécuter toutes les tâches de maintenance consécutivement")}
                            >
                                <FontAwesomeIcon icon={isRunning ? faRotate : faPlay} spin={isRunning} />
                                <span>{tr("Run all", "Tout exécuter")}</span>
                            </button>
                        </div>
                    </div>

                    <div className="admin-maintenance__table-wrapper">
                        <table className="admin-maintenance__table">
                            <thead>
                                <tr>
                                    <th style={{ width: "48px", textAlign: "center" }}>
                                        <input
                                            ref={headerCheckboxRef}
                                            type="checkbox"
                                            className="admin-checkbox"
                                            checked={allSelected}
                                            onChange={handleSelectAll}
                                            disabled={isRunning}
                                            title={allSelected ? tr("Deselect all", "Tout désélectionner") : tr("Select all", "Tout sélectionner")}
                                        />
                                    </th>
                                    <th style={{ width: "260px" }}>{tr("Maintenance Task", "Tâche de maintenance")}</th>
                                    <th>{tr("Description & Action Performed", "Description & Action effectuée")}</th>
                                    <th style={{ width: "160px", textAlign: "center" }}>{tr("Status", "État")}</th>
                                    <th style={{ width: "130px", textAlign: "right" }}>{tr("Action", "Action")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {TASKS.map((task) => {
                                    const isSelected = selectedTasks.includes(task.id);
                                    const taskRunning = runningTasks.includes(task.id);
                                    const statusInfo = taskStatuses[task.id] || { state: "idle" };
                                    const taskTitle = tr(task.title[0], task.title[1]);
                                    const taskTag = tr(task.tag[0], task.tag[1]);
                                    const taskDesc = tr(task.desc[0], task.desc[1]);

                                    return (
                                        <tr
                                            key={task.id}
                                            className={`admin-maintenance__row ${isSelected ? "is-selected" : ""}`}
                                            onClick={() => handleToggleSelect(task.id)}
                                        >
                                            {/* Checkbox column */}
                                            <td
                                                style={{ textAlign: "center" }}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <input
                                                    type="checkbox"
                                                    className="admin-checkbox"
                                                    checked={isSelected}
                                                    disabled={isRunning}
                                                    onChange={() => handleToggleSelect(task.id)}
                                                />
                                            </td>

                                            {/* Task cell */}
                                            <td>
                                                <div className="admin-maintenance__task-cell">
                                                    <div className={`admin-maintenance__task-icon ${task.iconClass}`}>
                                                        <FontAwesomeIcon icon={task.icon} />
                                                    </div>
                                                    <div className="admin-maintenance__task-info">
                                                        <span className="admin-maintenance__task-title">{taskTitle}</span>
                                                        <span className="admin-maintenance__task-tag">{taskTag}</span>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Description cell */}
                                            <td>
                                                <div className="admin-maintenance__task-desc">
                                                    {taskDesc}
                                                </div>
                                            </td>

                                            {/* Status cell */}
                                            <td
                                                style={{ textAlign: "center" }}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {taskRunning ? (
                                                    <span className="admin-maintenance__status-badge admin-maintenance__status-badge--running">
                                                        <FontAwesomeIcon icon={faRotate} spin />
                                                        <span>{tr("Running...", "En cours...")}</span>
                                                    </span>
                                                ) : statusInfo.state === "success" ? (
                                                    <span
                                                        className="admin-maintenance__status-badge admin-maintenance__status-badge--success"
                                                        title={statusInfo.message}
                                                    >
                                                        <FontAwesomeIcon icon={faCheck} />
                                                        <span>{tr("Completed", "Terminé")}</span>
                                                    </span>
                                                ) : statusInfo.state === "error" ? (
                                                    <span
                                                        className="admin-maintenance__status-badge admin-maintenance__status-badge--error"
                                                        title={statusInfo.message}
                                                    >
                                                        <FontAwesomeIcon icon={faTriangleExclamation} />
                                                        <span>{tr("Error", "Erreur")}</span>
                                                    </span>
                                                ) : (
                                                    <span className="admin-maintenance__status-badge admin-maintenance__status-badge--idle">
                                                        <span>{tr("Ready", "Prêt")}</span>
                                                    </span>
                                                )}
                                            </td>

                                            {/* Action cell */}
                                            <td
                                                style={{ textAlign: "right" }}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <button
                                                    type="button"
                                                    className="admin-maintenance__row-btn"
                                                    onClick={() => handleExecuteTask(task.id)}
                                                    disabled={isRunning}
                                                    title={tr(`Run "${taskTitle}"`, `Exécuter « ${taskTitle} »`)}
                                                >
                                                    <FontAwesomeIcon icon={taskRunning ? faRotate : faPlay} spin={taskRunning} />
                                                    <span>{taskRunning ? tr("Running...", "En cours...") : tr("Run", "Exécuter")}</span>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
