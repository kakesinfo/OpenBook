import { useSessionContext, SessionContextType, SessionUser } from "../context/SessionContext.tsx";

export type { SessionContextType, SessionUser };

export default function useSession(): SessionContextType {
    return useSessionContext();
}
