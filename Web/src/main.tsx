import ReactDOM from "react-dom/client";
import {BrowserRouter} from "react-router";

import './globals.css';

import Routing from './Routing.tsx';
import {SnackbarProvider} from "notistack";
import {SessionProvider} from "./context/SessionProvider.tsx";
import {ThemeProvider} from "./context/ThemeContext.tsx";
import {LanguageProvider} from "./context/LanguageContext.tsx";
import {registerImageCacheWorker} from "./utils/imageCache.ts";

// Register client-side image cache Service Worker
registerImageCacheWorker();

ReactDOM.createRoot(document.getElementById('root')!).render(
    <BrowserRouter>
        <LanguageProvider>
            <ThemeProvider>
                <SnackbarProvider
                    maxSnack={5}
                    anchorOrigin={{vertical: 'top', horizontal: 'right'}}
                    autoHideDuration={2000}>
                    <SessionProvider>
                        <Routing />
                    </SessionProvider>
                </SnackbarProvider>
            </ThemeProvider>
        </LanguageProvider>
    </BrowserRouter>
);
