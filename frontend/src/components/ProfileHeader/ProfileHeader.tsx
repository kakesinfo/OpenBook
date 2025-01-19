import "./ProfileHeader.scss"
import useSession from "../../hooks/UseSession.tsx";
import Container from "../Container/Container.tsx";
import {Link} from "react-router";

const CustomLink = ({ to, children }: { to: string, children: React.ReactNode }) => {
    const className = window.location.href.includes(to) ? "active" : "";

    return (
        <Link to={to} className={className}>
            {children}
        </Link>
    );
}

export default function ProfileHeader() {
    const session = useSession();

    return (
        <header className="profile-header">
            <Container style={{maxWidth: "1000px", flexDirection: "column"}}>
                <div className="profile-header-info">
                    <h1>{session?.data?.username}</h1>
                </div>
                <nav className="profile-header-nav">
                    <CustomLink to="/profile/home">Profil</CustomLink>
                    <CustomLink to="/profile/books">Mes livres</CustomLink>
                    <CustomLink to="/profile/wishlist">Ma wishlist</CustomLink>
                    <CustomLink to="/profile/coming-soon">Mes sorties</CustomLink>
                    <CustomLink to="/profile/stats">Mes statistiques</CustomLink>
                </nav>
            </Container>
        </header>
    );
}