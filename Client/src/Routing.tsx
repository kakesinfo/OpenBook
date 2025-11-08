import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

import {Routes, Route, Navigate, useLocation} from "react-router";

import Login from "./pages/Login.tsx";

import Register from "./pages/Register.tsx";
import useSession from "./hooks/UseSession.tsx";
import App from "./pages/App.tsx";
import BookPage from "./pages/app/BookPage.tsx";
import HomePage from "./pages/app/HomePage.tsx";
import CollectionPage from "./pages/app/CollectionPage.tsx";
import WishlistPage from "./pages/app/WishlistPage.tsx";
import PlanningPage from "./pages/app/PlanningPage.tsx";

function ProtectedRoute({ redirectPath, children }: { redirectPath: string, children: React.ReactNode }) {
    const session = useSession();

    if (!session.token) {
        return <Navigate replace to={redirectPath} />;
    }

    return children;
}

export default function Routing() {
    const session = useSession();
	const location = useLocation();

    return (
        <Routes>
            <Route path="/" element={
                session.token
                    ? <Navigate replace to="/app" />
                    : <Navigate replace to="/login" />
            } />

            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route path="/app" element={
                <ProtectedRoute redirectPath="/">
                    <App />
                </ProtectedRoute>
            }>
                <Route index element={<Navigate replace to="home" />} />
                <Route path="home" element={<HomePage key={location.pathname}/>} />
                <Route path="collection" element={<CollectionPage key={location.pathname}/>} />
                <Route path="wishlist" element={<WishlistPage key={location.pathname}/>} />
                <Route path="planning" element={<PlanningPage key={location.pathname}/>} />
				
                <Route path="book/:id" element={ <BookPage key={location.pathname} /> } />
            </Route>

        </Routes>
    )
}
