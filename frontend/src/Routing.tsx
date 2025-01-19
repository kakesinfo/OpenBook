import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

import { Routes, Route, Navigate } from "react-router";

import Login from "./pages/Login.tsx";

import Register from "./pages/Register.tsx";
import useSession from "./hooks/UseSession.tsx";
import Profile from "./pages/Profile.tsx";

function ProtectedRoute({ redirectPath, children }: { redirectPath: string, children: React.ReactNode }) {
    const auth = useSession();

    if (!auth.token) {
        return <Navigate replace to={redirectPath} />;
    }

    return children;
}

export default function Routing() {
    const session = useSession();

    return (
        <Routes>
            <Route path="/" element={
                session.token
                    ? <Navigate replace to="/profile" />
                    : <Navigate replace to="/login" />
            } />

            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route path="/profile" element={
                <ProtectedRoute redirectPath="/">
                    <Profile />
                </ProtectedRoute>
            }>
                <Route index path="home" element={<h2>Profil</h2>} />
                <Route path="books" element={<h2>Mes livres</h2>} />
                <Route path="wishlist" element={<h2>Ma wishlist</h2>} />
                <Route path="coming-soon" element={<h2>Mes sorties</h2>} />
                <Route path="stats" element={<h2>Mes statistiques</h2>} />
            </Route>
        </Routes>
    )
}
