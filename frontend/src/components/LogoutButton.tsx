
import {useNavigate} from "react-router";
import useSession from "../hooks/UseSession.tsx";
import {enqueueSnackbar} from "notistack";
import Button from "@mui/material/Button";

export default function LogoutButton() {
    const auth = useSession();
    const navigate = useNavigate();

    const handleLogout = async () => {
        const status = await auth.logout();

        if (!status) {
            return enqueueSnackbar("Une erreur est survenue", {variant: "error"});
        }

        setTimeout(() => {
            navigate('/');
        }, 100);
    }

    return (
        <Button variant="contained" onClick={handleLogout}>Logout</Button>
    );
}