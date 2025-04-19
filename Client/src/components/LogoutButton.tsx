
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

        const status = await auth.logout();

        if (!status) {
            setLoading(false);
            return enqueueSnackbar("Une erreur est survenue", {variant: "error"});
        }

        setLoading(false);
        navigate('/');
    }

    return (
        <Button variant="text" sx={{color: "#fff"}} loading={loading} onClick={handleLogout}>Logout</Button>
    );
}