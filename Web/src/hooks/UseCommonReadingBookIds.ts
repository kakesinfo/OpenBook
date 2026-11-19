import { useEffect, useState } from "react";
import useSession from "./UseSession.tsx";
import ReadingSessionDTO from "../dto/ReadingSession.dto.ts";
import { computeCommonReadingBookIds } from "../components/HomeWidgets/readingUtils.ts";

// One fetch of /user/readingSessions shared between every hook consumer of the session
const promiseCache = new WeakMap<object, Promise<Set<string>>>();

/**
 * Returns the set of book ids (BookSummaryDTO.id strings) whose current reading
 * cycle is a common (group) reading. The underlying request is cached per session.
 */
export default function useCommonReadingBookIds(): Set<string> {
    const session = useSession();
    const [ids, setIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        let cancelled = false;
        let promise = promiseCache.get(session);
        if (!promise) {
            promise = session
                .customFetch("/user/readingSessions", { method: "GET" })
                .then(async (res) => {
                    if (!res.ok) return new Set<string>();
                    const data: ReadingSessionDTO[] = await res.json();
                    return Array.isArray(data) ? computeCommonReadingBookIds(data) : new Set<string>();
                })
                .catch(() => new Set<string>());
            promiseCache.set(session, promise);
        }
        promise.then((result) => {
            if (!cancelled) setIds(result);
        });
        return () => {
            cancelled = true;
        };
    }, [session]);

    return ids;
}
