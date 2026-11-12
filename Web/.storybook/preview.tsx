import type { Preview } from "@storybook/react";
import { MemoryRouter } from "react-router";
import { SnackbarProvider } from "notistack";
import { LanguageProvider } from "../src/context/LanguageContext.tsx";
import { ThemeProvider } from "../src/context/ThemeContext.tsx";
import { SessionContext, type SessionContextType } from "../src/context/SessionContext.tsx";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import "../src/globals.css";

const mockSession: SessionContextType = {
    token: "storybook-mock-token",
    user: {
        username: "StorybookUser",
        role: "USER"
    },
    isAuthenticated: true,
    isAdmin: false,
    setupRequired: false,
    checkSetupStatus: async () => false,
    login: async () => ({ success: true }),
    register: async () => ({ success: true }),
    logout: async () => true,
    customFetch: async () => new Response(JSON.stringify({}), { status: 200 }),
    updateToken: () => {},
    updateUser: () => {}
};

const preview: Preview = {
    parameters: {
        layout: "padded",
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
                            <SessionContext.Provider value={mockSession}>
                                <div
                                    style={{
                                        padding: "24px",
                                        background: "var(--bg-primary)",
                                        color: "var(--text-primary)",
                                        borderRadius: "12px",
                                        minHeight: "120px"
                                    }}
                                >
                                    <Story />
                                </div>
                            </SessionContext.Provider>
                        </SnackbarProvider>
                    </ThemeProvider>
                </LanguageProvider>
            </MemoryRouter>
        )
    ]
};

export default preview;
