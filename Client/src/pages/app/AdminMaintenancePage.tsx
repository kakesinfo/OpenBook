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
    faCircleCheck,
    faTriangleExclamation,
    faPlay
} from "@fortawesome/free-solid-svg-icons";
import useSession from "../../hooks/UseSession.tsx";
import "./AdminMaintenancePage.scss";

type TaskId = "utf8" | "dedup" | "bnf" | "verify_isbn";

interface MaintenanceTaskDef {
    id: TaskId;
    title: string;
    tag: string;
    desc: string;
    icon: typeof faWrench;
    iconClass: string;
}

const TASKS: MaintenanceTaskDef[] = [
    {
        id: "utf8",
        title: "Réparer l'UTF-8",
        tag: "Encodage & Typographie",
        desc: "Détecte et répare les textes corrompus par un double encodage UTF-8 (ex: dÃ©mon -> démon), normalise les tirets Unicode (–, —), nettoie les rôles parasites d'auteurs et consolide les séries corrompues.",
        icon: faWrench,
        iconClass: "admin-maintenance__task-icon--utf8"
    },
    {
        id: "dedup",
        title: "Dédoupliquer les albums",
        tag: "Intégrité du catalogue",
        desc: "Recherche et fusionne les albums en double d'un même éditeur (même couverture, même ISBN, ou titres quasi-identiques avec variations de tirets ou casse). Réattribue automatiquement vos lectures et possessions vers le tome canonique sans perte de données.",
        icon: faClone,
        iconClass: "admin-maintenance__task-icon--dedup"
    },
    {
        id: "bnf",
        title: "Enrichir via la BnF",
        tag: "Catalogue & Métadonnées",
        desc: "Interroge l'API SRU du catalogue de la Bibliothèque nationale de France (BnF) pour retrouver les ISBN/EAN manquants, le nombre de pages, la collection et les auteurs de vos albums.",
        icon: faBarcode,
        iconClass: "admin-maintenance__task-icon--bnf"
    },
    {
        id: "verify_isbn",
        title: "Vérifier avec la BnF",
        tag: "Contrôle & Pages",
        desc: "Vérifie chaque album ayant un ISBN auprès du catalogue BnF pour corriger le nombre exact de pages, rattacher la collection officielle et compléter les auteurs manquants.",
        icon: faCheckDouble,
        iconClass: "admin-maintenance__task-icon--verify"
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
    const [serverConnected] = useState<boolean | null>(null);
    const [selectedTasks, setSelectedTasks] = useState<TaskId[]>([]);
    const [runningTasks, setRunningTasks] = useState<TaskId[]>([]);
    const [result, setResult] = useState<MaintenanceResult | null>(null);
    const [taskStatuses, setTaskStatuses] = useState<Record<TaskId, TaskStatusInfo>>({
        utf8: { state: "idle" },
        dedup: { state: "idle" },
        bnf: { state: "idle" },
        verify_isbn: { state: "idle" }
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
        return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
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
        let taskName = "Réparation UTF-8";
        if (taskId === "dedup") {
            endpoint = "/admin/scrapers/deduplicate";
            taskName = "Déduplication";
        } else if (taskId === "bnf") {
            endpoint = "/admin/scrapers/enrich-bnf";
            taskName = "Enrichissement BnF";
        } else if (taskId === "verify_isbn") {
            endpoint = "/admin/scrapers/verify-isbn";
            taskName = "Vérification BnF";
        }

        setTaskStatuses(prev => ({
            ...prev,
            [taskId]: { state: "running" }
        }));

        try {
            const resp = await session.customFetch(endpoint, { method: "POST" });
            const data = await resp.json();
            const msg = data.message || `${taskName} effectuée avec succès.`;

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
            const errorMsg = err?.message || `Erreur lors de l'exécution de ${taskName}.`;
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
            taskName: taskDef?.title || taskId,
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
            taskName: `Sélection (${targetIds.length} tâche${targetIds.length > 1 ? "s" : ""})`,
            type: anyError ? "error" : "success",
            message: results.join(" | "),
            timestamp: nowFormatted()
        });

        setRunningTasks([]);
    };

    const handleExecuteAll = async () => {
        if (runningTasks.length > 0) return;
        setRunningTasks(["utf8", "dedup", "bnf", "verify_isbn"]);
        setResult(null);

        const results: string[] = [];
        let anyError = false;

        const resUtf8 = await runSingleTask("utf8");
        if (!resUtf8.ok) anyError = true;
        results.push(resUtf8.message);

        const resDedup = await runSingleTask("dedup");
        if (!resDedup.ok) anyError = true;
        results.push(resDedup.message);

        const resBnf = await runSingleTask("bnf");
        if (!resBnf.ok) anyError = true;
        results.push(resBnf.message);

        const resVerify = await runSingleTask("verify_isbn");
        if (!resVerify.ok) anyError = true;
        results.push(resVerify.message);

        setResult({
            taskName: "Maintenance complète (Tout)",
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
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", flexWrap: "wrap", gap: "12px" }}>
                    <div className="admin-maintenance__header-title">
                        <h2>Maintenance</h2>
                    </div>

                    <div style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "6px 14px",
                        borderRadius: "20px",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        background: serverConnected ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                        color: serverConnected ? "#10b981" : "#ef4444",
                        border: `1px solid ${serverConnected ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`
                    }}>
                        <FontAwesomeIcon icon={serverConnected ? faCircleCheck : faTriangleExclamation} />
                        <span>{serverConnected ? "Microservice Connecté" : "Microservice Injoignable"}</span>
                    </div>
                </div>
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
                            Exécuté à {result.timestamp}
                        </div>
                    </div>
                )}

                {/* Maintenance Tasks Panel */}
                <div className="admin-maintenance__panel">
                    <div className="admin-maintenance__panel-header">
                        <div className="admin-maintenance__panel-title-group">
                            <div className="admin-maintenance__panel-title-row">
                                <h3>Tâches de maintenance</h3>
                                <span className="admin-maintenance__badge">
                                    {TASKS.length} disponibles
                                </span>
                                {selectedTasks.length > 0 && (
                                    <span className="admin-maintenance__badge admin-maintenance__badge--selected">
                                        {selectedTasks.length} cochée{selectedTasks.length > 1 ? "s" : ""}
                                    </span>
                                )}
                            </div>
                            <p className="admin-maintenance__panel-subtitle">
                                Cochez les tâches à exécuter ou lancez une maintenance complète en un clic.
                            </p>
                        </div>

                        <div className="admin-maintenance__panel-actions">
                            {selectedTasks.length > 0 && (
                                <button
                                    type="button"
                                    className="admin-maintenance__btn-action admin-maintenance__btn-action--execute"
                                    onClick={handleExecuteSelected}
                                    disabled={isRunning}
                                    title="Exécuter les tâches sélectionnées"
                                >
                                    <FontAwesomeIcon icon={isRunning ? faRotate : faPlay} spin={isRunning} />
                                    <span>
                                        Exécuter la sélection ({selectedTasks.length})
                                    </span>
                                </button>
                            )}

                            <button
                                type="button"
                                className="admin-maintenance__btn-action admin-maintenance__btn-action--all"
                                onClick={handleExecuteAll}
                                disabled={isRunning}
                                title="Exécuter toutes les tâches de maintenance consécutivement"
                            >
                                <FontAwesomeIcon icon={isRunning ? faRotate : faPlay} spin={isRunning} />
                                <span>Tout exécuter</span>
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
                                            title={allSelected ? "Tout désélectionner" : "Tout sélectionner"}
                                        />
                                    </th>
                                    <th style={{ width: "260px" }}>Tâche de maintenance</th>
                                    <th>Description & Action effectuée</th>
                                    <th style={{ width: "160px", textAlign: "center" }}>État</th>
                                    <th style={{ width: "130px", textAlign: "right" }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {TASKS.map((task) => {
                                    const isSelected = selectedTasks.includes(task.id);
                                    const taskRunning = runningTasks.includes(task.id);
                                    const statusInfo = taskStatuses[task.id] || { state: "idle" };

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
                                                        <span className="admin-maintenance__task-title">{task.title}</span>
                                                        <span className="admin-maintenance__task-tag">{task.tag}</span>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Description cell */}
                                            <td>
                                                <div className="admin-maintenance__task-desc">
                                                    {task.desc}
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
                                                        <span>En cours...</span>
                                                    </span>
                                                ) : statusInfo.state === "success" ? (
                                                    <span
                                                        className="admin-maintenance__status-badge admin-maintenance__status-badge--success"
                                                        title={statusInfo.message}
                                                    >
                                                        <FontAwesomeIcon icon={faCheck} />
                                                        <span>Terminé</span>
                                                    </span>
                                                ) : statusInfo.state === "error" ? (
                                                    <span
                                                        className="admin-maintenance__status-badge admin-maintenance__status-badge--error"
                                                        title={statusInfo.message}
                                                    >
                                                        <FontAwesomeIcon icon={faTriangleExclamation} />
                                                        <span>Erreur</span>
                                                    </span>
                                                ) : (
                                                    <span className="admin-maintenance__status-badge admin-maintenance__status-badge--idle">
                                                        <span>Prêt</span>
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
                                                    title={`Exécuter « ${task.title} »`}
                                                >
                                                    <FontAwesomeIcon icon={taskRunning ? faRotate : faPlay} spin={taskRunning} />
                                                    <span>{taskRunning ? "En cours..." : "Exécuter"}</span>
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
