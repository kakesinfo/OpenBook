import './Wrapper.scss'
import LogoutButton from "../LogoutButton.tsx";
import {IconDefinition} from "@fortawesome/free-solid-svg-icons";
import {Link, useLocation} from "react-router";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";

export function WrapperAction({ children, icon, callback }: {
    children: React.ReactNode,
    icon: IconDefinition,
    callback?: () => void
}) {

    return (
        <button
            onClick={callback}
            className="wrapper-navigation__button"
        >
            <FontAwesomeIcon icon={icon} className="font-light" />
            {children}
        </button>
    );
}

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

export function WrapperHeader({ children }: { children?: React.ReactNode }) {
	return (
		<header className="wrapper-header">
			{children}
		</header>
	)
}

export function Wrapper({ children }: { children: React.ReactNode }) {
    return (
        <div className="wrapper">
            {children}
        </div>
    )
}
