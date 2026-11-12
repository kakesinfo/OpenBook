import type { Preview } from "@storybook/react";
import { MemoryRouter } from "react-router";
import { SnackbarProvider } from "notistack";
import { LanguageProvider } from "../src/context/LanguageContext.tsx";
import { ThemeProvider } from "../src/context/ThemeContext.tsx";
import "../src/globals.css";

const preview: Preview = {
    parameters: {
        controls: {
            matchers: {
                color: /(background|color)$/i,
                date: /Date$/i
            }
        }
    },
    decorators: [
        (Story) => (
            <MemoryRouter>
                <LanguageProvider>
                    <ThemeProvider>
                        <SnackbarProvider maxSnack={3}>
                            <div style={{ padding: "1rem" }}>
                                <Story />
                            </div>
                        </SnackbarProvider>
                    </ThemeProvider>
                </LanguageProvider>
            </MemoryRouter>
        )
    ]
};

export default preview;
