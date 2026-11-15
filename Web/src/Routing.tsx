import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

import {Routes, Route, Navigate, useLocation} from "react-router";

import Login from "./pages/Login.tsx";
import ChangePassword from "./pages/ChangePassword.tsx";
import SetupPage from "./pages/SetupPage.tsx";
import useSession from "./hooks/UseSession.tsx";
import App from "./pages/App.tsx";
import BookPage from "./pages/app/BookPage.tsx";
import HomePage from "./pages/app/HomePage.tsx";
import CollectionPage from "./pages/app/CollectionPage.tsx";
import SalesPage from "./pages/app/SalesPage.tsx";
import SeriesPage from "./pages/app/SeriesPage.tsx";
import SeriesDetailPage from "./pages/app/SeriesDetailPage.tsx";
import AuthorDetailPage from "./pages/app/AuthorDetailPage.tsx";
import EditorDetailPage from "./pages/app/EditorDetailPage.tsx";
import WishlistPage from "./pages/app/WishlistPage.tsx";
import PlanningPage from "./pages/app/PlanningPage.tsx";
import SettingsPage from "./pages/app/SettingsPage.tsx";
import AdminIndexationPage from "./pages/app/AdminIndexationPage.tsx";
import AdminMaintenancePage from "./pages/app/AdminMaintenancePage.tsx";
import AdminBackupsPage from "./pages/app/AdminBackupsPage.tsx";
import AdminDeletedBooksPage from "./pages/app/AdminDeletedBooksPage.tsx";
import AdminUsersPage from "./pages/app/AdminUsersPage.tsx";
import AdminConfigPage from "./pages/app/AdminConfigPage.tsx";
import AdminLogsPage from "./pages/app/AdminLogsPage.tsx";
import StatisticsPage from "./pages/app/StatisticsPage.tsx";
import NotesPage from "./pages/app/NotesPage.tsx";
import GlossaryPage from "./pages/app/GlossaryPage.tsx";

function ProtectedRoute({ redirectPath = "/login", children }: { redirectPath?: string, children: React.ReactNode }) {
    const session = useSession();

    if (session.setupRequired === true) {
        return <Navigate replace to="/setup" />;
    }

    if (!session.token) {
        return <Navigate replace to={redirectPath} />;
    }

    if (session.user?.mustChangePassword) {
        return <Navigate replace to="/change-password" />;
    }

    return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
    const session = useSession();

    if (session.setupRequired === true) {
        return <Navigate replace to="/setup" />;
    }

    if (session.token) {
        if (session.user?.mustChangePassword) {
            return <Navigate replace to="/change-password" />;
        }
        return <Navigate replace to={session.isAdmin ? "/app/admin/indexation" : "/app/home"} />;
    }

    return <>{children}</>;
}

function ChangePasswordRoute({ children }: { children: React.ReactNode }) {
    const session = useSession();

    if (session.setupRequired === true) {
        return <Navigate replace to="/setup" />;
    }

    if (!session.token) {
        return <Navigate replace to="/login" />;
    }

    if (!session.user?.mustChangePassword) {
        return <Navigate replace to={session.isAdmin ? "/app/admin/indexation" : "/app/home"} />;
    }

    return <>{children}</>;
}

function AdminOnlyRoute({ children }: { children: React.ReactNode }) {
    const session = useSession();

    if (!session.isAdmin) {
        return <Navigate replace to="/app/home" />;
    }

    return <>{children}</>;
}

function UserOnlyRoute({ children }: { children: React.ReactNode }) {
    const session = useSession();

    if (session.isAdmin) {
        return <Navigate replace to="/app/admin/indexation" />;
    }

    return <>{children}</>;
}

export default function Routing() {
    const session = useSession();
    const location = useLocation();

    // If setup is required, redirect anywhere to /setup
    if (session.setupRequired === true && location.pathname !== "/setup") {
        return (
            <Routes>
                <Route path="/setup" element={<SetupPage />} />
                <Route path="*" element={<Navigate replace to="/setup" />} />
            </Routes>
        );
    }

    return (
        <Routes>
            <Route path="/" element={
                session.setupRequired === true
                    ? <Navigate replace to="/setup" />
                    : (session.token
                        ? (session.user?.mustChangePassword
                            ? <Navigate replace to="/change-password" />
                            : <Navigate replace to={session.isAdmin ? "/app/admin/indexation" : "/app/home"} />)
                        : <Navigate replace to="/login" />)
            } />

            <Route path="/setup" element={
                session.setupRequired === false
                    ? <Navigate replace to={session.token ? (session.user?.mustChangePassword ? "/change-password" : (session.isAdmin ? "/app/admin/indexation" : "/app/home")) : "/login"} />
                    : <SetupPage />
            } />

            <Route path="/login" element={
                <PublicOnlyRoute>
                    <Login />
                </PublicOnlyRoute>
            } />
            <Route path="/register" element={<Navigate replace to="/login" />} />
            <Route path="/change-password" element={
                <ChangePasswordRoute>
                    <ChangePassword />
                </ChangePasswordRoute>
            } />

            <Route path="/app" element={
                <ProtectedRoute redirectPath="/login">
                    <App />
                </ProtectedRoute>
            }>
                <Route index element={
                    <Navigate replace to={session.isAdmin ? "admin/indexation" : "home"} />
                } />

                {/* Routes Utilisateur (bibliothèque, lecture, etc.) - non accessibles par l'admin */}
                <Route path="home" element={<UserOnlyRoute><HomePage key={location.pathname}/></UserOnlyRoute>} />
                <Route path="collection" element={<UserOnlyRoute><CollectionPage key={location.pathname}/></UserOnlyRoute>} />
                <Route path="sales" element={<UserOnlyRoute><SalesPage key={location.pathname}/></UserOnlyRoute>} />
                <Route path="ventes" element={<UserOnlyRoute><SalesPage key={location.pathname}/></UserOnlyRoute>} />
                <Route path="collection/series" element={<UserOnlyRoute><SeriesPage key={location.pathname}/></UserOnlyRoute>} />
                <Route path="series" element={<UserOnlyRoute><SeriesPage key={location.pathname}/></UserOnlyRoute>} />
                <Route path="series/:id" element={<UserOnlyRoute><SeriesDetailPage key={location.pathname}/></UserOnlyRoute>} />
                <Route path="author/:id" element={<UserOnlyRoute><AuthorDetailPage key={location.pathname}/></UserOnlyRoute>} />
                <Route path="authors/:id" element={<UserOnlyRoute><AuthorDetailPage key={location.pathname}/></UserOnlyRoute>} />
                <Route path="editor/:id" element={<UserOnlyRoute><EditorDetailPage key={location.pathname}/></UserOnlyRoute>} />
                <Route path="editors/:id" element={<UserOnlyRoute><EditorDetailPage key={location.pathname}/></UserOnlyRoute>} />
                <Route path="bibliotheque" element={<UserOnlyRoute><CollectionPage key={location.pathname}/></UserOnlyRoute>} />
                <Route path="wishlist" element={<UserOnlyRoute><WishlistPage key={location.pathname}/></UserOnlyRoute>} />
                <Route path="planning" element={<UserOnlyRoute><PlanningPage key={location.pathname}/></UserOnlyRoute>} />
                <Route path="notes" element={<UserOnlyRoute><NotesPage key={location.pathname}/></UserOnlyRoute>} />
                <Route path="glossary" element={<UserOnlyRoute><GlossaryPage key={location.pathname}/></UserOnlyRoute>} />
                <Route path="glossaire" element={<UserOnlyRoute><GlossaryPage key={location.pathname}/></UserOnlyRoute>} />
                <Route path="statistics" element={<UserOnlyRoute><StatisticsPage key={location.pathname}/></UserOnlyRoute>} />
                <Route path="book/:id" element={<UserOnlyRoute><BookPage key={location.pathname}/></UserOnlyRoute>} />

                {/* Routes Admin (Indexation, Maintenance, Sauvegardes, Livres supprimés, Utilisateurs) - accessibles uniquement par l'admin */}
                <Route path="admin" element={<AdminOnlyRoute><Navigate replace to="/app/admin/indexation" /></AdminOnlyRoute>} />
                <Route path="admin/indexation" element={<AdminOnlyRoute><AdminIndexationPage key={location.pathname}/></AdminOnlyRoute>} />
                <Route path="admin/maintenance" element={<AdminOnlyRoute><AdminMaintenancePage key={location.pathname}/></AdminOnlyRoute>} />
                <Route path="admin/backups" element={<AdminOnlyRoute><AdminBackupsPage key={location.pathname}/></AdminOnlyRoute>} />
                <Route path="admin/deleted-books" element={<AdminOnlyRoute><AdminDeletedBooksPage key={location.pathname}/></AdminOnlyRoute>} />
                <Route path="admin/users" element={<AdminOnlyRoute><AdminUsersPage key={location.pathname}/></AdminOnlyRoute>} />
                <Route path="admin/config" element={<AdminOnlyRoute><AdminConfigPage key={location.pathname}/></AdminOnlyRoute>} />
                <Route path="admin/configuration" element={<AdminOnlyRoute><AdminConfigPage key={location.pathname}/></AdminOnlyRoute>} />
                <Route path="admin/logs" element={<AdminOnlyRoute><AdminLogsPage key={location.pathname}/></AdminOnlyRoute>} />

                {/* Routes communes */}
                <Route path="settings" element={<SettingsPage key={location.pathname}/>} />
            </Route>

            <Route path="*" element={<Navigate replace to="/" />} />
        </Routes>
    );
}
