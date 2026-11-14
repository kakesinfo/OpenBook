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
    faGear,
    faChartPie,
    faRotate,
    faWrench,
    faBoxArchive,
    faTrashCanArrowUp,
    faUsers,
    faSliders
} from "@fortawesome/free-solid-svg-icons";
import { Link, useLocation } from "react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import useSession from "../../hooks/UseSession.tsx";
import useLanguage from "../../hooks/UseLanguage.tsx";
import UserAvatar from "../UserAvatar/UserAvatar.tsx";

export function WrapperAction({ children, icon, callback }: {
    children: React.ReactNode;
    icon: IconDefinition;
    callback?: () => void;
}) {
    const { t } = useLanguage();
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
            <span className="wrapper-navigation__shortcut">{t("nav.searchShortcut")}</span>
        </button>
    );
}

export function WrapperButton({
    children,
    to,
    icon,
    activeRoutes
}: {
    children: React.ReactNode;
    to: string;
    icon: IconDefinition;
    activeRoutes?: string[];
}) {
    const location = useLocation();
    const isActive = location.pathname === to ||
        (to !== '/app' && location.pathname.startsWith(to)) ||
        (activeRoutes && activeRoutes.some(r => location.pathname === r || location.pathname.startsWith(r)));

    return (
        <Link to={to} className={`wrapper-navigation__button ${isActive ? 'active' : ''}`}>
            <span className="wrapper-navigation__icon">
                <FontAwesomeIcon icon={icon} />
            </span>
            <span className="wrapper-navigation__text">{children}</span>
        </Link>
    );
}

export function WrapperSubGroup({ children }: { children: React.ReactNode }) {
    return (
        <div className="wrapper-navigation__sub-group">
            {children}
        </div>
    );
}

export function WrapperSubButton({ children, to, icon }: {
    children: React.ReactNode;
    to: string;
    icon?: IconDefinition;
}) {
    const location = useLocation();
    const isActive = location.pathname === to || location.pathname.startsWith(to + '/');

    return (
        <Link to={to} className={`wrapper-navigation__sub-button ${isActive ? 'active' : ''}`}>
            {icon && (
                <span className="wrapper-navigation__sub-icon">
                    <FontAwesomeIcon icon={icon} />
                </span>
            )}
            <span className="wrapper-navigation__sub-text">{children}</span>
        </Link>
    );
}

export function WrapperNavigation({ title = "OpenBook", badge, children, onSearchClick }: {
    title?: string;
    badge?: React.ReactNode;
    children: React.ReactNode;
    onSearchClick?: () => void;
}) {
    const session = useSession();
    const { t } = useLanguage();
    const location = useLocation();
    const isSettingsActive = location.pathname.startsWith('/app/settings');

    const adminBadge = badge !== undefined ? badge : (session.isAdmin ? t("nav.adminBadge") : null);
    const defaultReaderName = t("nav.roleReader");

    return (
        <>
            {/* Desktop Sidebar */}
            <aside className="wrapper-navigation">
                <header className="wrapper-navigation__header">
                    <div className="wrapper-navigation__logo">
                        <FontAwesomeIcon icon={faBookOpen} />
                    </div>
                    <div className="wrapper-navigation__brand-group">
                        <span className="wrapper-navigation__brand">{title}</span>
                        {adminBadge && (
                            <span className="wrapper-navigation__admin-badge">{adminBadge}</span>
                        )}
                    </div>
                </header>

                <nav className="wrapper-navigation__body">
                    {children}
                </nav>

                <footer className="wrapper-navigation__footer">
                    <Link
                        to="/app/settings"
                        className={`wrapper-navigation__user ${isSettingsActive ? 'active' : ''}`}
                        title={t("nav.accountSettings")}
                    >
                        <UserAvatar
                            avatar={session.user?.avatar}
                            name={session.user?.username || defaultReaderName}
                            size="md"
                        />
                        <div className="wrapper-navigation__user-info">
                            <span className="wrapper-navigation__user-name">
                                {session.user?.username || defaultReaderName}
                            </span>
                            <span className="wrapper-navigation__user-role">
                                {session.isAdmin ? t("nav.roleAdmin") : defaultReaderName}
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
                    <div className="wrapper-mobile-header__brand-group">
                        <span className="wrapper-mobile-header__title">{title}</span>
                        {adminBadge && (
                            <span className="wrapper-navigation__admin-badge">{adminBadge}</span>
                        )}
                    </div>
                </div>
                <div className="wrapper-mobile-header__actions">
                    {onSearchClick && (
                        <button
                            type="button"
                            onClick={onSearchClick}
                            className="wrapper-mobile-header__btn"
                            aria-label={t("nav.search")}
                        >
                            <FontAwesomeIcon icon={faMagnifyingGlass} />
                        </button>
                    )}
                    <Link
                        to="/app/settings"
                        className={`wrapper-mobile-header__btn ${isSettingsActive ? 'active' : ''}`}
                        aria-label={t("nav.settings")}
                    >
                        <UserAvatar
                            avatar={session.user?.avatar}
                            name={session.user?.username || defaultReaderName}
                            size="sm"
                        />
                    </Link>
                    <LogoutButton compact />
                </div>
            </header>

            {/* Mobile Bottom Navigation */}
            <nav className="wrapper-bottom-nav">
                {!session.isAdmin ? (
                    <>
                        <Link
                            to="/app/home"
                            className={`wrapper-bottom-nav__item ${location.pathname.includes('/home') ? 'active' : ''}`}
                        >
                            <FontAwesomeIcon icon={faNewspaper} />
                            <span>{t("nav.news")}</span>
                        </Link>
                        <Link
                            to="/app/collection"
                            className={`wrapper-bottom-nav__item ${location.pathname.includes('/collection') || location.pathname.includes('/bibliotheque') ? 'active' : ''}`}
                        >
                            <FontAwesomeIcon icon={faBook} />
                            <span>{t("nav.library")}</span>
                        </Link>
                        <Link
                            to="/app/wishlist"
                            className={`wrapper-bottom-nav__item ${location.pathname.includes('/wishlist') ? 'active' : ''}`}
                        >
                            <FontAwesomeIcon icon={faHeart} />
                            <span>{t("nav.wishlist")}</span>
                        </Link>
                        <Link
                            to="/app/planning"
                            className={`wrapper-bottom-nav__item ${location.pathname.includes('/planning') ? 'active' : ''}`}
                        >
                            <FontAwesomeIcon icon={faCalendarDays} />
                            <span>{t("nav.planning")}</span>
                        </Link>
                        <Link
                            to="/app/statistics"
                            className={`wrapper-bottom-nav__item ${location.pathname.includes('/statistics') ? 'active' : ''}`}
                        >
                            <FontAwesomeIcon icon={faChartPie} />
                            <span>{t("nav.statsShort")}</span>
                        </Link>
                    </>
                ) : (
                    <>
                        <Link
                            to="/app/admin/indexation"
                            className={`wrapper-bottom-nav__item ${location.pathname.includes('/admin/indexation') ? 'active' : ''}`}
                        >
                            <FontAwesomeIcon icon={faRotate} />
                            <span>{t("nav.indexation")}</span>
                        </Link>
                        <Link
                            to="/app/admin/maintenance"
                            className={`wrapper-bottom-nav__item ${location.pathname.includes('/admin/maintenance') ? 'active' : ''}`}
                        >
                            <FontAwesomeIcon icon={faWrench} />
                            <span>{t("nav.maintenance")}</span>
                        </Link>
                        <Link
                            to="/app/admin/backups"
                            className={`wrapper-bottom-nav__item ${location.pathname.includes('/admin/backups') ? 'active' : ''}`}
                        >
                            <FontAwesomeIcon icon={faBoxArchive} />
                            <span>{t("nav.backupsShort")}</span>
                        </Link>
                        <Link
                            to="/app/admin/deleted-books"
                            className={`wrapper-bottom-nav__item ${location.pathname.includes('/admin/deleted-books') ? 'active' : ''}`}
                        >
                            <FontAwesomeIcon icon={faTrashCanArrowUp} />
                            <span>{t("nav.deletedShort")}</span>
                        </Link>
                        <Link
                            to="/app/admin/users"
                            className={`wrapper-bottom-nav__item ${location.pathname.includes('/admin/users') ? 'active' : ''}`}
                        >
                            <FontAwesomeIcon icon={faUsers} />
                            <span>{t("nav.usersShort")}</span>
                        </Link>
                        <Link
                            to="/app/admin/config"
                            className={`wrapper-bottom-nav__item ${location.pathname.includes('/admin/config') ? 'active' : ''}`}
                        >
                            <FontAwesomeIcon icon={faSliders} />
                            <span>{t("nav.configShort")}</span>
                        </Link>
                    </>
                )}
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
