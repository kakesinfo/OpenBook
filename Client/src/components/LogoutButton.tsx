import { useNavigate } from "react-router";
import useSession from "../hooks/UseSession.tsx";
import { enqueueSnackbar } from "notistack";
import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRightFromBracket } from "@fortawesome/free-solid-svg-icons";

export default function LogoutButton({ compact = false }: { compact?: boolean }) {
    const auth = useSession();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);

    const handleLogout = async () => {
        setLoading(true);

        try {
            await auth.logout();
            navigate('/login');
        } catch (error) {
            console.error(error);
            enqueueSnackbar("Une erreur est survenue lors de la déconnexion", { variant: "error" });
        } finally {
            setLoading(false);
        }
    };

    if (compact) {
        return (
            <button
                type="button"
                className="wrapper-logout-btn wrapper-logout-btn--compact"
                disabled={loading}
                onClick={handleLogout}
                title="Déconnexion"
                aria-label="Déconnexion"
            >
                <FontAwesomeIcon icon={faRightFromBracket} />
            </button>
        );
    }

    return (
        <button
            type="button"
            className="wrapper-logout-btn"
            disabled={loading}
            onClick={handleLogout}
        >
            <FontAwesomeIcon icon={faRightFromBracket} />
            <span>{loading ? "Déconnexion..." : "Déconnexion"}</span>
        </button>
    );
}
