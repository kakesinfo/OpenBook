import ReactDOM from "react-dom/client";
import {BrowserRouter} from "react-router";

import './globals.css';

import Routing from './Routing.tsx';
import {SnackbarProvider} from "notistack";
import {SessionProvider} from "./context/SessionProvider.tsx";

ReactDOM.createRoot(document.getElementById('root')!).render(
    <BrowserRouter>
        <SnackbarProvider
            maxSnack={5}
            anchorOrigin={{vertical: 'top', horizontal: 'right'}}
            autoHideDuration={2000}>
            <SessionProvider>
                <Routing />
            </SessionProvider>
        </SnackbarProvider>
    </BrowserRouter>
);
