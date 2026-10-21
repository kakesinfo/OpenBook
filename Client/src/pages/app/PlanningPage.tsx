import { WrapperHeader } from "../../components/Wrapper/Wrapper.tsx";
import { Link } from "react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendarDays, faCompass } from "@fortawesome/free-solid-svg-icons";

export default function PlanningPage() {
    return (
        <div className="planning-wrapper" style={{ width: "100%", display: "flex", flexDirection: "column" }}>
            <WrapperHeader>
                <h2>Planning des sorties</h2>
            </WrapperHeader>

            <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "80px 20px",
                textAlign: "center",
                color: "var(--text-muted)"
            }}>
                <div style={{
                    width: "72px",
                    height: "72px",
                    borderRadius: "50%",
                    backgroundColor: "rgba(99, 102, 241, 0.1)",
                    border: "1px solid rgba(99, 102, 241, 0.2)",
                    color: "var(--accent-secondary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "28px",
                    marginBottom: "20px"
                }}>
                    <FontAwesomeIcon icon={faCalendarDays} />
                </div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>
                    Planning à venir
                </h3>
                <p style={{ fontSize: "0.9375rem", maxWidth: "380px", marginBottom: "24px", lineHeight: 1.6 }}>
                    Le calendrier des prochaines sorties et parutions sera bientôt disponible.
                </p>
                <Link
                    to="/app/home"
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        height: "42px",
                        padding: "0 22px",
                        borderRadius: "var(--radius-full)",
                        background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                        color: "#fff",
                        fontWeight: 600,
                        fontSize: "0.875rem",
                        boxShadow: "0 4px 14px 0 rgba(16, 185, 129, 0.35)"
                    }}
                >
                    <FontAwesomeIcon icon={faCompass} />
                    <span>Découvrir les nouveautés</span>
                </Link>
            </div>
        </div>
    );
}
