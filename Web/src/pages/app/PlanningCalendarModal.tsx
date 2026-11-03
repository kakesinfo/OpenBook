import { useState, useEffect } from "react";
import { Dialog } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faCalendarPlus,
    faXmark,
    faCopy,
    faCheck,
    faRotateRight,
    faDownload,
    faInfoCircle
} from "@fortawesome/free-solid-svg-icons";
import { useSnackbar } from "notistack";
import useSession from "../../hooks/UseSession.tsx";
import useLanguage from "../../hooks/UseLanguage.tsx";
import { API_URL } from "../../config/api.ts";
import "./PlanningCalendarModal.scss";

interface Props {
    open: boolean;
    onClose: () => void;
}

interface CalendarFeedData {
    token: string;
    icsUrl: string;
    webcalUrl: string;
    googleCalendarUrl: string;
}

export default function PlanningCalendarModal({ open, onClose }: Props) {
    const session = useSession();
    const { tr } = useLanguage();
    const { enqueueSnackbar } = useSnackbar();

    const [feedData, setFeedData] = useState<CalendarFeedData | null>(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [regenerating, setRegenerating] = useState(false);

    const buildFullUrls = (token: string, backendData?: Partial<CalendarFeedData>): CalendarFeedData => {
        let base = API_URL;
        if (!base.startsWith("http://") && !base.startsWith("https://")) {
            base = `${window.location.origin}${base.startsWith("/") ? "" : "/"}${base}`;
        }
        base = base.replace(/\/+$/, "");

        const icsUrl = `${base}/books/planning/calendar.ics?token=${token}`;
        const webcalUrl = icsUrl.replace(/^https?:\/\//i, "webcal://");
        const googleCalendarUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl)}`;

        return {
            token,
            icsUrl,
            webcalUrl,
            googleCalendarUrl: backendData?.googleCalendarUrl || googleCalendarUrl
        };
    };

    const fetchCalendarFeed = async () => {
        setLoading(true);
        try {
            const res = await session.customFetch("/books/planning/calendar-feed", { method: "GET" });
            if (res.ok) {
                const data = await res.json();
                setFeedData(buildFullUrls(data.token, data));
            } else {
                enqueueSnackbar(
                    tr("Unable to load calendar feed information", "Impossible de charger les informations du flux agenda"),
                    { variant: "error" }
                );
            }
        } catch (err) {
            console.error("Calendar feed fetch error:", err);
            enqueueSnackbar(
                tr("Error fetching calendar feed", "Erreur lors de la récupération du flux agenda"),
                { variant: "error" }
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            setCopied(false);
            fetchCalendarFeed();
        }
    }, [open]);

    const handleCopy = async () => {
        if (!feedData) return;
        try {
            await navigator.clipboard.writeText(feedData.icsUrl);
            setCopied(true);
            enqueueSnackbar(
                tr("Feed link copied to clipboard!", "Lien du flux copié dans le presse-papier !"),
                { variant: "success" }
            );
            setTimeout(() => setCopied(false), 2500);
        } catch {
            enqueueSnackbar(
                tr("Error copying link", "Erreur lors de la copie du lien"),
                { variant: "error" }
            );
        }
    };

    const handleDownloadIcs = () => {
        if (!feedData) return;
        const link = document.createElement("a");
        link.href = feedData.icsUrl;
        link.setAttribute("download", "planning.ics");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleRegenerateToken = async () => {
        const confirmed = window.confirm(
            tr(
                "Are you sure you want to regenerate your token?\n\nThe old link will immediately become inactive in Google Calendar or any other app.",
                "Voulez-vous vraiment régénérer votre jeton ?\n\nL'ancien lien deviendra immédiatement inactif dans Google Agenda ou toute autre application."
            )
        );
        if (!confirmed) return;

        setRegenerating(true);
        try {
            const res = await session.customFetch("/books/planning/calendar-feed/regenerate", { method: "POST" });
            if (res.ok) {
                const data = await res.json();
                setFeedData(buildFullUrls(data.token, data));
                enqueueSnackbar(
                    tr("New token generated successfully!", "Nouveau jeton généré avec succès !"),
                    { variant: "success" }
                );
            } else {
                enqueueSnackbar(
                    tr("Failed to regenerate token", "Échec de la régénération du jeton"),
                    { variant: "error" }
                );
            }
        } catch (err) {
            console.error("Regenerate token error:", err);
            enqueueSnackbar(
                tr("Error regenerating token", "Erreur lors de la régénération du jeton"),
                { variant: "error" }
            );
        } finally {
            setRegenerating(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            PaperProps={{
                style: {
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                    boxShadow: "var(--shadow-lg)",
                    color: "var(--text-primary)",
                    borderRadius: "16px",
                    maxWidth: "580px",
                    width: "100%",
                    padding: "24px",
                    margin: "16px"
                }
            }}
        >
            <div className="planning-calendar-modal">
                <div className="planning-calendar-modal__header">
                    <div className="planning-calendar-modal__header-title">
                        <div className="modal-icon">
                            <FontAwesomeIcon icon={faCalendarPlus} />
                        </div>
                        <h3>{tr("Sync / Export", "Synchroniser / Exporter")}</h3>
                    </div>
                    <button
                        type="button"
                        className="planning-calendar-modal__header-close"
                        onClick={onClose}
                        aria-label={tr("Close", "Fermer")}
                    >
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>

                <div className="planning-calendar-modal__body">
                    <p className="planning-calendar-modal__intro">
                        {tr(
                            "Automatically sync upcoming releases from your followed series, authors, and publishers in ",
                            "Synchronisez automatiquement les prochaines parutions de vos séries, auteurs et éditeurs suivis dans "
                        )}
                        <strong>{tr("Google Calendar", "Google Agenda")}</strong>,{" "}
                        <strong>{tr("Apple Calendar", "Apple Calendrier")}</strong>{" "}
                        {tr("or", "ou")} <strong>Outlook</strong>.
                    </p>

                    {loading ? (
                        <div style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                            {tr("Loading calendar link...", "Chargement du lien du calendrier...")}
                        </div>
                    ) : feedData ? (
                        <>
                            {/* Link input with copy button */}
                            <div className="planning-calendar-modal__link-section">
                                <div className="link-row">
                                    <input
                                        type="text"
                                        readOnly
                                        value={feedData.icsUrl}
                                        onClick={(e) => (e.target as HTMLInputElement).select()}
                                    />
                                    <button
                                        type="button"
                                        className={`copy-btn ${copied ? "copy-btn--copied" : ""}`}
                                        onClick={handleCopy}
                                    >
                                        <FontAwesomeIcon icon={copied ? faCheck : faCopy} />
                                        <span>{copied ? tr("Copied!", "Copié !") : tr("Copy", "Copier")}</span>
                                    </button>
                                </div>
                            </div>

                            {/* Secondary Actions: Download ICS & Regenerate */}
                            <div className="planning-calendar-modal__secondary-actions">
                                <button
                                    type="button"
                                    className="secondary-btn"
                                    onClick={handleDownloadIcs}
                                    title={tr("Download .ics file to import manually", "Télécharger le fichier .ics pour l'importer manuellement")}
                                >
                                    <FontAwesomeIcon icon={faDownload} />
                                    <span>{tr("Download .ics file", "Télécharger le fichier .ics")}</span>
                                </button>

                                <button
                                    type="button"
                                    className="secondary-btn secondary-btn--danger"
                                    onClick={handleRegenerateToken}
                                    disabled={regenerating}
                                    title={tr("Revoke old link and generate a new token", "Révoquer l'ancien lien et générer un nouveau jeton")}
                                >
                                    <FontAwesomeIcon icon={faRotateRight} spin={regenerating} />
                                    <span>{regenerating ? tr("Regenerating...", "Régénération...") : tr("Regenerate link", "Régénérer le lien")}</span>
                                </button>
                            </div>

                            {/* Instructions Box */}
                            <div className="planning-calendar-modal__instructions">
                                <div className="planning-calendar-modal__instructions-title">
                                    <FontAwesomeIcon icon={faInfoCircle} style={{ color: "var(--accent-primary)" }} />
                                    <span>{tr("How to add it to Google Calendar?", "Comment l'ajouter dans Google Agenda ?")}</span>
                                </div>
                                <ol>
                                    <li>
                                        {tr("On your computer, open ", "Sur votre ordinateur, ouvrez ")}
                                        <strong>{tr("Google Calendar", "Google Agenda")}</strong>.
                                    </li>
                                    <li>
                                        {tr("On the left, next to ", "À gauche, à côté de ")}
                                        <strong>{tr('"Other calendars"', "« Autres agendas »")}</strong>
                                        {tr(", click the ", ", cliquez sur le bouton ")}
                                        <strong>« + »</strong> {tr("then ", "puis ")}
                                        <strong>{tr('"From URL"', "« À partir de l'URL »")}</strong>.
                                    </li>
                                    <li>
                                        {tr("Paste the link above and confirm with ", "Collez le lien ci-dessus puis validez avec ")}
                                        <strong>{tr('"Add calendar"', "« Ajouter un agenda »")}</strong>.
                                    </li>
                                </ol>
                            </div>
                        </>
                    ) : null}
                </div>
            </div>
        </Dialog>
    );
}
