import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

import Login from "./pages/Login.tsx";

import { Routes, Route, Navigate } from "react-router";
import Register from "./pages/Register.tsx";
import useAuth from "./hooks/UseAuth.tsx";
import Profile from "./pages/Profile.tsx";

function ProtectedRoute({ redirectPath, children }: { redirectPath: string, children: React.ReactNode }) {
    const auth = useAuth();

    if (!auth.isLogged()) {
        return <Navigate replace to={redirectPath} />;
    }

    return children;
}

export default function Routing() {
    const auth = useAuth();

    return (
        <Routes>
            <Route path="/" element={
                auth.isLogged()
                    ? <Navigate replace to="/profile" />
                    : <Navigate replace to="/login" />
            } />

            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route path="/profile" element={
                <ProtectedRoute redirectPath="/">
                    <Profile />
                </ProtectedRoute>
            } />
        </Routes>
    )
}
