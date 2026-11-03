import { useNavigate } from "react-router";
import useSession from "../hooks/UseSession.tsx";
import useLanguage from "../hooks/UseLanguage.tsx";
import { enqueueSnackbar } from "notistack";
import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRightFromBracket } from "@fortawesome/free-solid-svg-icons";

export default function LogoutButton({ compact = false }: { compact?: boolean }) {
    const auth = useSession();
    const { t } = useLanguage();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);

    const handleLogout = async () => {
        setLoading(true);

        try {
            await auth.logout();
            navigate('/login');
        } catch (error) {
            console.error(error);
            enqueueSnackbar(t("logout.error"), { variant: "error" });
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
                title={t("logout.label")}
                aria-label={t("logout.label")}
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
            <span>{loading ? t("logout.loading") : t("logout.label")}</span>
        </button>
    );
}
