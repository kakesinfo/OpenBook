import "./Navigation.scss"
import LogoutButton from "../LogoutButton.tsx";
import Container from "../Container/Container.tsx";

export default function Navigation() {

    return (
       <nav className="navbar">
           <Container style={{maxWidth: "1000px", flexDirection: "row"}}>
                <div className="navbar-left">
                    <h1>Chapter & Chai</h1>
                </div>
                <div className="navbar-right">
                    <LogoutButton />
                </div>
            </Container>
       </nav>
    );
}