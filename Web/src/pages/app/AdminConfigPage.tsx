import { useState, useEffect, useCallback } from "react";
import { WrapperHeader } from "../../components/Wrapper/Wrapper.tsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faSliders,
    faPen,
    faRotateLeft,
    faRotate,
    faCheck,
    faCircleNotch,
    faClock,
    faHashtag,
    faToggleOn,
    faFont
} from "@fortawesome/free-solid-svg-icons";
import { Dialog } from "@mui/material";
import { enqueueSnackbar } from "notistack";
import useSession from "../../hooks/UseSession.tsx";
import useLanguage from "../../hooks/UseLanguage.tsx";
import { AdminConfigurationDTO } from "../../dto/AdminConfiguration.dto.ts";
import "./AdminConfigPage.scss";

type CronPresetMode = "daily" | "interval_hours" | "weekly" | "monthly" | "custom";

const DAYS_OF_WEEK = [
    { value: "1", fr: "Lundi", en: "Monday" },
    { value: "2", fr: "Mardi", en: "Tuesday" },
    { value: "3", fr: "Mercredi", en: "Wednesday" },
    { value: "4", fr: "Jeudi", en: "Thursday" },
    { value: "5", fr: "Vendredi", en: "Friday" },
    { value: "6", fr: "Samedi", en: "Saturday" },
    { value: "0", fr: "Dimanche", en: "Sunday" }
];

function pad2(n: number | string): string {
    const num = typeof n === "string" ? parseInt(n, 10) : n;
    if (isNaN(num)) return "00";
    return num < 10 ? `0${num}` : `${num}`;
}

function describeCron(cron: string, tr: (en: string, fr: string) => string): string {
    const trimmed = cron.trim().replace(/\s+/g, " ");
    const parts = trimmed.split(" ");
    const normalized = parts.length === 5 ? ["0", ...parts] : parts;

    if (normalized.length !== 6) {
        return tr("Custom or incomplete CRON expression", "Expression CRON personnalisée ou incomplète");
    }

    const [sec, min, hour, dom, month, dow] = normalized;
    const isSecZero = sec === "0" || sec === "00";
    const isMinNum = /^\d+$/.test(min) && Number(min) >= 0 && Number(min) <= 59;
    const isHourNum = /^\d+$/.test(hour) && Number(hour) >= 0 && Number(hour) <= 23;

    // Daily at HH:MM
    if (isSecZero && isMinNum && isHourNum && dom === "*" && month === "*" && (dow === "*" || dow === "?")) {
        return tr(
            `Every day at ${pad2(hour)}:${pad2(min)}`,
            `Tous les jours à ${pad2(hour)}:${pad2(min)}`
        );
    }

    // Every N hours
    const intervalMatch = hour.match(/^\*\/(\d+)$/);
    if (isSecZero && isMinNum && intervalMatch && dom === "*" && month === "*" && (dow === "*" || dow === "?")) {
        const everyHours = intervalMatch[1];
        return tr(
            `Every ${everyHours} hour(s) at minute ${pad2(min)}`,
            `Toutes les ${everyHours} heure(s) à la minute ${pad2(min)}`
        );
    }

    // Weekly on specific day
    if (isSecZero && isMinNum && isHourNum && (dom === "*" || dom === "?") && month === "*" && /^[0-7]$/.test(dow)) {
        const normalizedDow = dow === "7" ? "0" : dow;
        const dayObj = DAYS_OF_WEEK.find(d => d.value === normalizedDow);
        const dayLabel = dayObj ? tr(dayObj.en, dayObj.fr) : dow;
        return tr(
            `Every ${dayLabel} at ${pad2(hour)}:${pad2(min)}`,
            `Chaque ${dayLabel} à ${pad2(hour)}:${pad2(min)}`
        );
    }

    // Monthly on specific day
    if (isSecZero && isMinNum && isHourNum && /^\d+$/.test(dom) && month === "*" && (dow === "*" || dow === "?")) {
        return tr(
            `Monthly on day ${dom} at ${pad2(hour)}:${pad2(min)}`,
            `Tous les ${dom} du mois à ${pad2(hour)}:${pad2(min)}`
        );
    }

    return tr(
        `Custom CRON schedule (${trimmed})`,
        `Planification CRON personnalisée (${trimmed})`
    );
}

function isValidSpringCron(cron: string): boolean {
    const trimmed = cron.trim().replace(/\s+/g, " ");
    if (!trimmed) return false;
    const parts = trimmed.split(" ");
    if (parts.length !== 5 && parts.length !== 6) return false;
    const fieldRegex = /^(\*|(\*\/\d+)|(\d+(-\d+)?(,\d+(-\d+)?)*(\/\d+)?)|\?|[A-Z]{3}(-[A-Z]{3})?)$/i;
    return parts.every(p => fieldRegex.test(p));
}

export default function AdminConfigPage() {
    const session = useSession();
    const { tr } = useLanguage();

    const [configs, setConfigs] = useState<AdminConfigurationDTO[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [resettingId, setResettingId] = useState<number | null>(null);

    // Edit Dialog state
    const [editingConfig, setEditingConfig] = useState<AdminConfigurationDTO | null>(null);
    const [editValue, setEditValue] = useState<string>("");
    const [saving, setSaving] = useState<boolean>(false);

    // Specialized CRON builder states inside Dialog
    const [cronMode, setCronMode] = useState<CronPresetMode>("daily");
    const [cronHour, setCronHour] = useState<number>(3);
    const [cronMinute, setCronMinute] = useState<number>(0);
    const [cronIntervalHours, setCronIntervalHours] = useState<number>(6);
    const [cronDayOfWeek, setCronDayOfWeek] = useState<string>("1");
    const [cronDayOfMonth, setCronDayOfMonth] = useState<number>(1);

    const fetchConfigs = useCallback(async (quiet = false) => {
        if (!quiet) setLoading(true);
        try {
            const res = await session.customFetch("/admin/configurations", { method: "GET" });
            if (res.ok) {
                const data: AdminConfigurationDTO[] = await res.json();
                setConfigs(data);
            } else {
                enqueueSnackbar(
                    tr("Failed to load site configurations", "Impossible de charger la configuration du site"),
                    { variant: "error" }
                );
            }
        } catch (e) {
            console.error(e);
            enqueueSnackbar(
                tr("Network error while loading configurations", "Erreur réseau lors du chargement des configurations"),
                { variant: "error" }
            );
        } finally {
            if (!quiet) setLoading(false);
        }
    }, [session, tr]);

    useEffect(() => {
        fetchConfigs();
    }, [fetchConfigs]);

    const parseCronIntoBuilder = (cronStr: string) => {
        const trimmed = cronStr.trim().replace(/\s+/g, " ");
        const rawParts = trimmed.split(" ");
        const parts: [string, string, string, string, string, string] =
            rawParts.length === 6
                ? [rawParts[0], rawParts[1], rawParts[2], rawParts[3], rawParts[4], rawParts[5]]
                : rawParts.length === 5
                    ? ["0", rawParts[0], rawParts[1], rawParts[2], rawParts[3], rawParts[4]]
                    : ["0", "0", "3", "*", "*", "*"];

        const [sec, min, hour, dom, month, dow] = parts;
        const minNum = /^\d+$/.test(min) ? Math.min(59, Math.max(0, parseInt(min, 10))) : 0;
        const hourNum = /^\d+$/.test(hour) ? Math.min(23, Math.max(0, parseInt(hour, 10))) : 3;

        setCronMinute(minNum);
        setCronHour(hourNum);

        if ((sec === "0" || sec === "00") && /^\d+$/.test(min) && /^\d+$/.test(hour) && dom === "*" && month === "*" && (dow === "*" || dow === "?")) {
            setCronMode("daily");
            return;
        }

        const intervalMatch = hour.match(/^\*\/(\d+)$/);
        if ((sec === "0" || sec === "00") && /^\d+$/.test(min) && intervalMatch && dom === "*" && month === "*" && (dow === "*" || dow === "?")) {
            setCronMode("interval_hours");
            setCronIntervalHours(Math.max(1, Math.min(23, parseInt(intervalMatch[1], 10))));
            return;
        }

        if ((sec === "0" || sec === "00") && /^\d+$/.test(min) && /^\d+$/.test(hour) && (dom === "*" || dom === "?") && month === "*" && /^[0-7]$/.test(dow)) {
            setCronMode("weekly");
            setCronDayOfWeek(dow === "7" ? "0" : dow);
            return;
        }

        if ((sec === "0" || sec === "00") && /^\d+$/.test(min) && /^\d+$/.test(hour) && /^\d+$/.test(dom) && month === "*" && (dow === "*" || dow === "?")) {
            setCronMode("monthly");
            setCronDayOfMonth(Math.min(28, Math.max(1, parseInt(dom, 10))));
            return;
        }

        setCronMode("custom");
    };

    const handleOpenEdit = (config: AdminConfigurationDTO) => {
        setEditingConfig(config);
        setEditValue(config.value);
        if (config.valueType === "CRON") {
            parseCronIntoBuilder(config.value);
        }
    };

    const updateCronFromPreset = (
        mode: CronPresetMode,
        hour: number,
        minute: number,
        intervalH: number,
        dow: string,
        dom: number
    ) => {
        let newCron = editValue;
        if (mode === "daily") {
            newCron = `0 ${minute} ${hour} * * *`;
        } else if (mode === "interval_hours") {
            newCron = `0 ${minute} */${intervalH} * * *`;
        } else if (mode === "weekly") {
            newCron = `0 ${minute} ${hour} * * ${dow}`;
        } else if (mode === "monthly") {
            newCron = `0 ${minute} ${hour} ${dom} * *`;
        }

        if (mode !== "custom") {
            setEditValue(newCron);
        }
    };

    const handleSaveConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingConfig) return;

        const trimmed = editValue.trim();
        if (!trimmed) {
            enqueueSnackbar(
                tr("Value cannot be empty.", "La valeur ne peut pas être vide."),
                { variant: "error" }
            );
            return;
        }

        if (editingConfig.valueType === "CRON" && !isValidSpringCron(trimmed)) {
            enqueueSnackbar(
                tr("Invalid CRON expression format.", "Format d'expression CRON invalide."),
                { variant: "error" }
            );
            return;
        }

        if (editingConfig.valueType === "INTEGER" && !/^-?\d+$/.test(trimmed)) {
            enqueueSnackbar(
                tr("Value must be a valid integer.", "La valeur doit être un nombre entier valide."),
                { variant: "error" }
            );
            return;
        }

        setSaving(true);
        try {
            const res = await session.customFetch(`/admin/configurations/${editingConfig.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ value: trimmed })
            });

            if (res.ok) {
                const data = await res.json();
                enqueueSnackbar(
                    data.message || tr("Configuration updated successfully!", "Configuration mise à jour avec succès !"),
                    { variant: "success" }
                );
                setEditingConfig(null);
                await fetchConfigs(true);
            } else {
                const err = await res.json().catch(() => null);
                enqueueSnackbar(
                    err?.message || tr("Failed to update configuration.", "Erreur lors de la mise à jour de la configuration."),
                    { variant: "error" }
                );
            }
        } catch (err) {
            console.error(err);
            enqueueSnackbar(
                tr("Network error while saving configuration.", "Erreur réseau lors de l'enregistrement."),
                { variant: "error" }
            );
        } finally {
            setSaving(false);
        }
    };

    const handleResetConfig = async (config: AdminConfigurationDTO) => {
        setResettingId(config.id);
        try {
            const res = await session.customFetch(`/admin/configurations/${config.id}/reset`, {
                method: "POST"
            });

            if (res.ok) {
                const data = await res.json();
                enqueueSnackbar(
                    data.message || tr(
                        `${config.key} restored to default value (${config.defaultValue}).`,
                        `${config.key} restaurée à sa valeur par défaut (${config.defaultValue}).`
                    ),
                    { variant: "success" }
                );
                await fetchConfigs(true);
            } else {
                const err = await res.json().catch(() => null);
                enqueueSnackbar(
                    err?.message || tr("Failed to restore default value.", "Erreur lors de la restauration par défaut."),
                    { variant: "error" }
                );
            }
        } catch (err) {
            console.error(err);
            enqueueSnackbar(
                tr("Network error.", "Erreur réseau."),
                { variant: "error" }
            );
        } finally {
            setResettingId(null);
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case "CRON":
                return faClock;
            case "INTEGER":
                return faHashtag;
            case "BOOLEAN":
                return faToggleOn;
            default:
                return faFont;
        }
    };

    const modifiedCount = configs.filter(c => c.value !== c.defaultValue).length;

    return (
        <div className="admin-config">
            <WrapperHeader>
                <div className="admin-config__header-title">
                    <h2>{tr("Site Configuration", "Configuration du site")}</h2>
                    <p>
                        {tr(
                            "View and customize dynamic backend parameters and automated CRON schedules.",
                            "Consultez et modifiez les paramètres dynamiques du backend ainsi que la planification des tâches CRON."
                        )}
                    </p>
                </div>
            </WrapperHeader>

            <div className="admin-config__content">
                {/* Summary Banner */}
                <div className="admin-config__banner">
                    <div className="admin-config__banner-info">
                        <div className="admin-config__banner-icon">
                            <FontAwesomeIcon icon={faSliders} />
                        </div>
                        <div className="admin-config__banner-text">
                            <h3>{tr("System Parameters & Schedules", "Paramètres système & Planifications")}</h3>
                            <div className="admin-config__banner-stats">
                                <span className="admin-config__stat-badge">
                                    <FontAwesomeIcon icon={faSliders} /> {configs.length} {tr("parameters", "paramètres")}
                                </span>
                                {modifiedCount > 0 ? (
                                    <span className="admin-config__stat-badge admin-config__stat-badge--modified">
                                        <FontAwesomeIcon icon={faPen} /> {modifiedCount} {tr("customized", "personnalisé(s)")}
                                    </span>
                                ) : (
                                    <span className="admin-config__stat-badge admin-config__stat-badge--default">
                                        <FontAwesomeIcon icon={faCheck} /> {tr("All default values", "Valeurs par défaut")}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="admin-config__banner-actions">
                        <button
                            type="button"
                            className="admin-config__btn admin-config__btn--secondary"
                            onClick={() => fetchConfigs()}
                            disabled={loading}
                        >
                            <FontAwesomeIcon icon={faRotate} spin={loading} />
                            <span>{tr("Refresh", "Actualiser")}</span>
                        </button>
                    </div>
                </div>

                {/* Configurations Table Panel */}
                <div className="admin-config__panel">
                    <div className="admin-config__panel-header">
                        <h4>{tr("Configuration Entries", "Variables de configuration")}</h4>
                    </div>

                    {loading ? (
                        <div className="admin-config__loading">
                            <FontAwesomeIcon icon={faCircleNotch} spin size="2x" />
                            <span>{tr("Loading configuration...", "Chargement de la configuration...")}</span>
                        </div>
                    ) : configs.length === 0 ? (
                        <div className="admin-config__empty">
                            <FontAwesomeIcon icon={faSliders} size="3x" />
                            <p>{tr("No configuration entries found.", "Aucune configuration trouvée.")}</p>
                        </div>
                    ) : (
                        <div className="admin-config__table-wrapper">
                            <table className="admin-config__table">
                                <thead>
                                    <tr>
                                        <th>{tr("Configuration Name", "Nom de la config")}</th>
                                        <th>{tr("Value", "Valeur")}</th>
                                        <th style={{ textAlign: "right" }}>{tr("Actions", "Actions")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {configs.map((config) => {
                                        const isModified = config.value !== config.defaultValue;
                                        const isResetting = resettingId === config.id;

                                        return (
                                            <tr key={config.id} className={isModified ? "admin-config__row--modified" : ""}>
                                                <td>
                                                    <div className="admin-config__key-cell">
                                                        <div className="admin-config__key-row">
                                                            <code className="admin-config__key-name">{config.key}</code>
                                                            <span className={`admin-config__type-badge admin-config__type-badge--${config.valueType.toLowerCase()}`}>
                                                                <FontAwesomeIcon icon={getTypeIcon(config.valueType)} />
                                                                {config.valueType}
                                                            </span>
                                                            {isModified && (
                                                                <span className="admin-config__modified-pill">
                                                                    {tr("Modified", "Modifié")}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {config.description && (
                                                            <span className="admin-config__description">{config.description}</span>
                                                        )}
                                                    </div>
                                                </td>

                                                <td>
                                                    <div className="admin-config__value-cell">
                                                        <span className="admin-config__value-text">{config.value}</span>
                                                        {config.valueType === "CRON" && (
                                                            <span className="admin-config__value-hint">
                                                                {describeCron(config.value, tr)}
                                                            </span>
                                                        )}
                                                        {isModified && (
                                                            <span className="admin-config__default-hint">
                                                                {tr("Default:", "Par défaut :")} {config.defaultValue}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                <td>
                                                    <div className="admin-config__actions-cell">
                                                        {/* Bouton Modifier (icône uniquement, sans texte) */}
                                                        <button
                                                            type="button"
                                                            className="admin-config__icon-btn admin-config__icon-btn--edit"
                                                            title={tr("Edit configuration", "Modifier la configuration")}
                                                            aria-label={tr("Edit configuration", "Modifier la configuration")}
                                                            onClick={() => handleOpenEdit(config)}
                                                        >
                                                            <FontAwesomeIcon icon={faPen} />
                                                        </button>

                                                        {/* Bouton Restaurer par défaut (icône uniquement, sans texte) affiché uniquement si différent de la valeur par défaut */}
                                                        {isModified && (
                                                            <button
                                                                type="button"
                                                                className="admin-config__icon-btn admin-config__icon-btn--reset"
                                                                title={tr(
                                                                    `Restore default value (${config.defaultValue})`,
                                                                    `Restaurer par défaut (${config.defaultValue})`
                                                                )}
                                                                aria-label={tr("Restore default value", "Restaurer par défaut")}
                                                                disabled={isResetting}
                                                                onClick={() => handleResetConfig(config)}
                                                            >
                                                                <FontAwesomeIcon
                                                                    icon={isResetting ? faCircleNotch : faRotateLeft}
                                                                    spin={isResetting}
                                                                />
                                                            </button>
                                                        )}
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

            {/* Edit Dialog - Adapts dynamically to config.valueType */}
            <Dialog
                open={Boolean(editingConfig)}
                onClose={() => !saving && setEditingConfig(null)}
                PaperProps={{
                    style: {
                        backgroundColor: "transparent",
                        boxShadow: "none",
                        overflow: "visible"
                    }
                }}
            >
                {editingConfig && (
                    <div className="admin-config-dialog">
                        <div className="admin-config-dialog__header">
                            <h3 className="admin-config-dialog__title">
                                <FontAwesomeIcon icon={getTypeIcon(editingConfig.valueType)} />
                                <span>{editingConfig.key}</span>
                            </h3>
                            {editingConfig.description && (
                                <p className="admin-config-dialog__desc">{editingConfig.description}</p>
                            )}
                        </div>

                        <form onSubmit={handleSaveConfig} className="admin-config-dialog__form">
                            {/* Dynamic Dialog Body according to valueType */}
                            {editingConfig.valueType === "CRON" && (
                                <div className="admin-config-dialog__cron-editor">
                                    {/* Frequency Mode Tabs */}
                                    <div className="admin-config-dialog__field">
                                        <label>{tr("Frequency", "Fréquence")}</label>
                                        <div className="admin-config-dialog__mode-tabs">
                                            {(
                                                [
                                                    { id: "daily", fr: "Quotidien", en: "Daily" },
                                                    { id: "interval_hours", fr: "Toutes les X h", en: "Every X hrs" },
                                                    { id: "weekly", fr: "Hebdo", en: "Weekly" },
                                                    { id: "monthly", fr: "Mensuel", en: "Monthly" },
                                                    { id: "custom", fr: "CRON libre", en: "Custom CRON" }
                                                ] as { id: CronPresetMode; fr: string; en: string }[]
                                            ).map((tab) => (
                                                <button
                                                    key={tab.id}
                                                    type="button"
                                                    className={`admin-config-dialog__mode-tab ${cronMode === tab.id ? "is-active" : ""}`}
                                                    onClick={() => {
                                                        setCronMode(tab.id);
                                                        updateCronFromPreset(tab.id, cronHour, cronMinute, cronIntervalHours, cronDayOfWeek, cronDayOfMonth);
                                                    }}
                                                >
                                                    {tr(tab.en, tab.fr)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Visual Controls for Daily / Weekly / Monthly / Interval */}
                                    {cronMode === "daily" && (
                                        <div className="admin-config-dialog__visual-row">
                                            <div className="admin-config-dialog__field">
                                                <label htmlFor="cron-hour">{tr("Hour", "Heure")}</label>
                                                <select
                                                    id="cron-hour"
                                                    value={cronHour}
                                                    onChange={(e) => {
                                                        const h = parseInt(e.target.value, 10);
                                                        setCronHour(h);
                                                        updateCronFromPreset("daily", h, cronMinute, cronIntervalHours, cronDayOfWeek, cronDayOfMonth);
                                                    }}
                                                >
                                                    {Array.from({ length: 24 }, (_, i) => (
                                                        <option key={i} value={i}>{pad2(i)} h</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="admin-config-dialog__field">
                                                <label htmlFor="cron-minute">{tr("Minute", "Minute")}</label>
                                                <select
                                                    id="cron-minute"
                                                    value={cronMinute}
                                                    onChange={(e) => {
                                                        const m = parseInt(e.target.value, 10);
                                                        setCronMinute(m);
                                                        updateCronFromPreset("daily", cronHour, m, cronIntervalHours, cronDayOfWeek, cronDayOfMonth);
                                                    }}
                                                >
                                                    {Array.from({ length: 60 }, (_, i) => (
                                                        <option key={i} value={i}>{pad2(i)} min</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    )}

                                    {cronMode === "interval_hours" && (
                                        <div className="admin-config-dialog__visual-row">
                                            <div className="admin-config-dialog__field">
                                                <label htmlFor="cron-interval">{tr("Interval", "Intervalle")}</label>
                                                <select
                                                    id="cron-interval"
                                                    value={cronIntervalHours}
                                                    onChange={(e) => {
                                                        const iv = parseInt(e.target.value, 10);
                                                        setCronIntervalHours(iv);
                                                        updateCronFromPreset("interval_hours", cronHour, cronMinute, iv, cronDayOfWeek, cronDayOfMonth);
                                                    }}
                                                >
                                                    {[1, 2, 3, 4, 6, 8, 12].map((h) => (
                                                        <option key={h} value={h}>
                                                            {tr(`Every ${h} hour(s)`, `Toutes les ${h} heure(s)`)}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="admin-config-dialog__field">
                                                <label htmlFor="cron-interval-min">{tr("At minute", "À la minute")}</label>
                                                <select
                                                    id="cron-interval-min"
                                                    value={cronMinute}
                                                    onChange={(e) => {
                                                        const m = parseInt(e.target.value, 10);
                                                        setCronMinute(m);
                                                        updateCronFromPreset("interval_hours", cronHour, m, cronIntervalHours, cronDayOfWeek, cronDayOfMonth);
                                                    }}
                                                >
                                                    {[0, 15, 30, 45].map((m) => (
                                                        <option key={m} value={m}>{pad2(m)} min</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    )}

                                    {cronMode === "weekly" && (
                                        <div className="admin-config-dialog__visual-row admin-config-dialog__visual-row--three">
                                            <div className="admin-config-dialog__field">
                                                <label htmlFor="cron-dow">{tr("Day", "Jour")}</label>
                                                <select
                                                    id="cron-dow"
                                                    value={cronDayOfWeek}
                                                    onChange={(e) => {
                                                        const d = e.target.value;
                                                        setCronDayOfWeek(d);
                                                        updateCronFromPreset("weekly", cronHour, cronMinute, cronIntervalHours, d, cronDayOfMonth);
                                                    }}
                                                >
                                                    {DAYS_OF_WEEK.map((d) => (
                                                        <option key={d.value} value={d.value}>{tr(d.en, d.fr)}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="admin-config-dialog__field">
                                                <label htmlFor="cron-weekly-hour">{tr("Hour", "Heure")}</label>
                                                <select
                                                    id="cron-weekly-hour"
                                                    value={cronHour}
                                                    onChange={(e) => {
                                                        const h = parseInt(e.target.value, 10);
                                                        setCronHour(h);
                                                        updateCronFromPreset("weekly", h, cronMinute, cronIntervalHours, cronDayOfWeek, cronDayOfMonth);
                                                    }}
                                                >
                                                    {Array.from({ length: 24 }, (_, i) => (
                                                        <option key={i} value={i}>{pad2(i)} h</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="admin-config-dialog__field">
                                                <label htmlFor="cron-weekly-min">{tr("Minute", "Minute")}</label>
                                                <select
                                                    id="cron-weekly-min"
                                                    value={cronMinute}
                                                    onChange={(e) => {
                                                        const m = parseInt(e.target.value, 10);
                                                        setCronMinute(m);
                                                        updateCronFromPreset("weekly", cronHour, m, cronIntervalHours, cronDayOfWeek, cronDayOfMonth);
                                                    }}
                                                >
                                                    {Array.from({ length: 60 }, (_, i) => (
                                                        <option key={i} value={i}>{pad2(i)} min</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    )}

                                    {cronMode === "monthly" && (
                                        <div className="admin-config-dialog__visual-row admin-config-dialog__visual-row--three">
                                            <div className="admin-config-dialog__field">
                                                <label htmlFor="cron-dom">{tr("Day of month", "Jour du mois")}</label>
                                                <select
                                                    id="cron-dom"
                                                    value={cronDayOfMonth}
                                                    onChange={(e) => {
                                                        const dom = parseInt(e.target.value, 10);
                                                        setCronDayOfMonth(dom);
                                                        updateCronFromPreset("monthly", cronHour, cronMinute, cronIntervalHours, cronDayOfWeek, dom);
                                                    }}
                                                >
                                                    {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                                                        <option key={d} value={d}>{d}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="admin-config-dialog__field">
                                                <label htmlFor="cron-monthly-hour">{tr("Hour", "Heure")}</label>
                                                <select
                                                    id="cron-monthly-hour"
                                                    value={cronHour}
                                                    onChange={(e) => {
                                                        const h = parseInt(e.target.value, 10);
                                                        setCronHour(h);
                                                        updateCronFromPreset("monthly", h, cronMinute, cronIntervalHours, cronDayOfWeek, cronDayOfMonth);
                                                    }}
                                                >
                                                    {Array.from({ length: 24 }, (_, i) => (
                                                        <option key={i} value={i}>{pad2(i)} h</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="admin-config-dialog__field">
                                                <label htmlFor="cron-monthly-min">{tr("Minute", "Minute")}</label>
                                                <select
                                                    id="cron-monthly-min"
                                                    value={cronMinute}
                                                    onChange={(e) => {
                                                        const m = parseInt(e.target.value, 10);
                                                        setCronMinute(m);
                                                        updateCronFromPreset("monthly", cronHour, m, cronIntervalHours, cronDayOfWeek, cronDayOfMonth);
                                                    }}
                                                >
                                                    {Array.from({ length: 60 }, (_, i) => (
                                                        <option key={i} value={i}>{pad2(i)} min</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    )}

                                    {cronMode === "custom" && (
                                        <div className="admin-config-dialog__field">
                                            <label htmlFor="cron-raw-input">
                                                {tr("CRON Expression (sec min hour day month weekday)", "Expression CRON (sec min heure jour mois jour_semaine)")}
                                            </label>
                                            <input
                                                id="cron-raw-input"
                                                type="text"
                                                className="admin-config-dialog__mono-input"
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                placeholder="0 0 3 * * *"
                                                required
                                            />
                                        </div>
                                    )}

                                    {/* Human-readable preview */}
                                    <div className="admin-config-dialog__preview-box">
                                        <FontAwesomeIcon icon={faClock} />
                                        <div>
                                            <strong>{describeCron(editValue, tr)}</strong>
                                            <span> ({editValue})</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {editingConfig.valueType === "BOOLEAN" && (
                                <div className="admin-config-dialog__field">
                                    <label>{tr("Boolean State", "État booléen")}</label>
                                    <div className="admin-config-dialog__bool-options">
                                        <button
                                            type="button"
                                            className={`admin-config-dialog__bool-card ${editValue.toLowerCase() === "true" ? "is-selected" : ""}`}
                                            onClick={() => setEditValue("true")}
                                        >
                                            <FontAwesomeIcon icon={faCheck} />
                                            <span>true ({tr("Enabled", "Activé")})</span>
                                        </button>
                                        <button
                                            type="button"
                                            className={`admin-config-dialog__bool-card ${editValue.toLowerCase() === "false" ? "is-selected" : ""}`}
                                            onClick={() => setEditValue("false")}
                                        >
                                            <span>false ({tr("Disabled", "Désactivé")})</span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {editingConfig.valueType === "INTEGER" && (
                                <div className="admin-config-dialog__field">
                                    <label htmlFor="config-int-input">{tr("Integer Value", "Valeur entière")}</label>
                                    <input
                                        id="config-int-input"
                                        type="number"
                                        step="1"
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        required
                                        autoFocus
                                    />
                                </div>
                            )}

                            {editingConfig.valueType !== "CRON" &&
                                editingConfig.valueType !== "BOOLEAN" &&
                                editingConfig.valueType !== "INTEGER" && (
                                    <div className="admin-config-dialog__field">
                                        <label htmlFor="config-str-input">{tr("Text Value", "Valeur texte")}</label>
                                        <input
                                            id="config-str-input"
                                            type="text"
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            required
                                            autoFocus
                                        />
                                    </div>
                                )}

                            <div className="admin-config-dialog__actions">
                                <button
                                    type="button"
                                    className="admin-config__btn admin-config__btn--secondary"
                                    onClick={() => setEditingConfig(null)}
                                    disabled={saving}
                                >
                                    {tr("Cancel", "Annuler")}
                                </button>
                                <button
                                    type="submit"
                                    className="admin-config__btn admin-config__btn--primary"
                                    disabled={saving}
                                >
                                    <FontAwesomeIcon icon={saving ? faCircleNotch : faCheck} spin={saving} />
                                    <span>{saving ? tr("Saving...", "Enregistrement...") : tr("Save", "Enregistrer")}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </Dialog>
        </div>
    );
}
