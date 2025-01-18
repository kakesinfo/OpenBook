import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router";

import './globals.css'

import Routing from './Routing.tsx'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <BrowserRouter>
        <Routing />
    </BrowserRouter>
)
