import "./ProfileHeader.scss"
import Container from "../Container/Container.tsx";
import {Link, useLocation} from "react-router";

const CustomLink = ({ to, children }: { to: string, children: React.ReactNode }) => {
    const location = useLocation();
    const className = location.pathname === to ? "active" : "";

    return (
        <Link to={to} className={className}>
            {children}
        </Link>
    );
}

export default function ProfileHeader() {
    return (
        <header className="profile-header">
            <Container style={{maxWidth: "1000px", flexDirection: "column"}}>
                <div className="profile-header-info">
                    <h1>Bienvenue!</h1>
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