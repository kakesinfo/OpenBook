import Navigation from "../components/Navigation/Navigation.tsx";
import ProfileHeader from "../components/ProfileHeader/ProfileHeader.tsx";
import {Outlet} from "react-router";
import Container from "../components/Container/Container.tsx";
import LogBook from "../components/LogBook.tsx";

export default function Profile(){

    return (
        <>
            <Navigation />
            <ProfileHeader />

            <Container style={{maxWidth: "1000px", flexDirection: "row"}}>
                <Outlet />
            </Container>

            <LogBook />
        </>
    );
}