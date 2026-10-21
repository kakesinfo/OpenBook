import {useNavigate} from "react-router";
import useSession from "../hooks/UseSession.tsx";
import {enqueueSnackbar} from "notistack";
import Button from "@mui/material/Button";
import {useState} from "react";

export default function LogoutButton() {
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
            enqueueSnackbar("Une erreur est survenue lors de la déconnexion", {variant: "error"});
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button variant="text" sx={{color: "#fff"}} disabled={loading} onClick={handleLogout}>
            {loading ? "Déconnexion..." : "Logout"}
        </Button>
    );
}
