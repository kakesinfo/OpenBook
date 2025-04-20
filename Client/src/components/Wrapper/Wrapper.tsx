import './Wrapper.scss'
import LogoutButton from "../LogoutButton.tsx";
import {IconDefinition} from "@fortawesome/free-solid-svg-icons";
import {Link, useLocation} from "react-router";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";

export function WrapperButton({ children, to, icon }: { children: React.ReactNode, to: string, icon: IconDefinition }) {
    const location = useLocation();
    const isActive = location.pathname === to || location.pathname.endsWith(to);

    return (
        <Link to={to} className={`wrapper-navigation__button ${isActive ? 'active' : ''}`}>
            <FontAwesomeIcon icon={icon} className={isActive ? 'font-regular' : 'font-light'} />
            {children}
        </Link>
    );
}

export function WrapperNavigation({ title, children }: { title?: string, children: React.ReactNode }) {
    return (
        <div className="wrapper-navigation">
            <header className="wrapper-navigation__header">{ title }</header>
            <section className="wrapper-navigation__body">
                { children }
            </section>
            <footer className="wrapper-navigation__footer">
                <LogoutButton />
            </footer>
        </div>
    )
}

export function WrapperContent({ children }: { children: React.ReactNode }) {
    return (
        <div className="wrapper-content">
            {children}
        </div>
    )
}

export function Wrapper({ children }: { children: React.ReactNode }) {
    return (
        <div className="wrapper">
            {children}
        </div>
    )
}