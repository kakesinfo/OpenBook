import Navigation from "../components/Navigation/Navigation.tsx";
import ProfileHeader from "../components/ProfileHeader/ProfileHeader.tsx";
import {Outlet} from "react-router";
import {Fab} from "@mui/material";
import AddIcon from '@mui/icons-material/Add';

export default function Profile(){

    return (
        <>
            <Navigation />
            <ProfileHeader />

            <Outlet />

            <Fab color="primary" sx={{position: "fixed", right: "20px", bottom: "20px"}}>
                <AddIcon />
            </Fab>
        </>
    );
}