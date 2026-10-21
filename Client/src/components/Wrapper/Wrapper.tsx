import './Wrapper.scss';
import LogoutButton from "../LogoutButton.tsx";
import {
    IconDefinition,
    faBookOpen,
    faMagnifyingGlass,
    faNewspaper,
    faBook,
    faHeart,
    faCalendarDays,
    faGear
} from "@fortawesome/free-solid-svg-icons";
import { Link, useLocation } from "react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import useSession from "../../hooks/UseSession.tsx";
import UserAvatar from "../UserAvatar/UserAvatar.tsx";

export function WrapperAction({ children, icon, callback }: {
    children: React.ReactNode;
    icon: IconDefinition;
    callback?: () => void;
}) {
    return (
        <button
            onClick={callback}
            className="wrapper-navigation__action"
            type="button"
        >
            <span className="wrapper-navigation__icon">
                <FontAwesomeIcon icon={icon} />
            </span>
            <span className="wrapper-navigation__text">{children}</span>
            <span className="wrapper-navigation__shortcut">Rechercher</span>
        </button>
    );
}

export function WrapperButton({ children, to, icon }: { children: React.ReactNode; to: string; icon: IconDefinition }) {
    const location = useLocation();
    const isActive = location.pathname === to || (to !== '/app' && location.pathname.startsWith(to));

    return (
        <Link to={to} className={`wrapper-navigation__button ${isActive ? 'active' : ''}`}>
            <span className="wrapper-navigation__icon">
                <FontAwesomeIcon icon={icon} />
            </span>
            <span className="wrapper-navigation__text">{children}</span>
        </Link>
    );
}

export function WrapperNavigation({ title = "Yet Another Library", children, onSearchClick }: {
    title?: string;
    children: React.ReactNode;
    onSearchClick?: () => void;
}) {
    const session = useSession();
    const location = useLocation();
    const isSettingsActive = location.pathname.startsWith('/app/settings');

    return (
        <>
            {/* Desktop Sidebar */}
            <aside className="wrapper-navigation">
                <header className="wrapper-navigation__header">
                    <div className="wrapper-navigation__logo">
                        <FontAwesomeIcon icon={faBookOpen} />
                    </div>
                    <span className="wrapper-navigation__brand">{title}</span>
                </header>

                <nav className="wrapper-navigation__body">
                    {children}
                </nav>

                <footer className="wrapper-navigation__footer">
                    <Link
                        to="/app/settings"
                        className={`wrapper-navigation__user ${isSettingsActive ? 'active' : ''}`}
                        title="Paramètres de votre compte"
                    >
                        <UserAvatar
                            avatar={session.user?.avatar}
                            name={session.user?.username || session.user?.email}
                            size="md"
                        />
                        <div className="wrapper-navigation__user-info">
                            <span className="wrapper-navigation__user-name">
                                {session.user?.username || "Lecteur"}
                            </span>
                            <span className="wrapper-navigation__user-email">
                                {session.user?.email || ""}
                            </span>
                        </div>
                        <span className="wrapper-navigation__user-gear">
                            <FontAwesomeIcon icon={faGear} />
                        </span>
                    </Link>
                    <LogoutButton />
                </footer>
            </aside>

            {/* Mobile Top Header */}
            <header className="wrapper-mobile-header">
                <div className="wrapper-mobile-header__brand">
                    <div className="wrapper-navigation__logo">
                        <FontAwesomeIcon icon={faBookOpen} />
                    </div>
                    <span>{title}</span>
                </div>
                <div className="wrapper-mobile-header__actions">
                    {onSearchClick && (
                        <button
                            type="button"
                            onClick={onSearchClick}
                            className="wrapper-mobile-header__btn"
                            aria-label="Recherche"
                        >
                            <FontAwesomeIcon icon={faMagnifyingGlass} />
                        </button>
                    )}
                    <Link
                        to="/app/settings"
                        className={`wrapper-mobile-header__btn ${isSettingsActive ? 'active' : ''}`}
                        aria-label="Paramètres"
                    >
                        <UserAvatar
                            avatar={session.user?.avatar}
                            name={session.user?.username || session.user?.email}
                            size="sm"
                        />
                    </Link>
                    <LogoutButton compact />
                </div>
            </header>

            {/* Mobile Bottom Navigation */}
            <nav className="wrapper-bottom-nav">
                <Link
                    to="/app/home"
                    className={`wrapper-bottom-nav__item ${location.pathname.includes('/home') ? 'active' : ''}`}
                >
                    <FontAwesomeIcon icon={faNewspaper} />
                    <span>Nouveautés</span>
                </Link>
                <Link
                    to="/app/collection"
                    className={`wrapper-bottom-nav__item ${location.pathname.includes('/collection') ? 'active' : ''}`}
                >
                    <FontAwesomeIcon icon={faBook} />
                    <span>Collection</span>
                </Link>
                <Link
                    to="/app/wishlist"
                    className={`wrapper-bottom-nav__item ${location.pathname.includes('/wishlist') ? 'active' : ''}`}
                >
                    <FontAwesomeIcon icon={faHeart} />
                    <span>Souhaits</span>
                </Link>
                <Link
                    to="/app/planning"
                    className={`wrapper-bottom-nav__item ${location.pathname.includes('/planning') ? 'active' : ''}`}
                >
                    <FontAwesomeIcon icon={faCalendarDays} />
                    <span>Planning</span>
                </Link>
            </nav>
        </>
    );
}

export function WrapperContent({ children }: { children: React.ReactNode }) {
    return (
        <main className="wrapper-content">
            {children}
        </main>
    );
}

export function WrapperHeader({ children }: { children?: React.ReactNode }) {
    return (
        <header className="wrapper-header">
            {children}
        </header>
    );
}

export function Wrapper({ children }: { children: React.ReactNode }) {
    return (
        <div className="wrapper">
            {children}
        </div>
    );
}
