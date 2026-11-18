import {useEffect, useRef, useState} from "react";

export function useDebounce<T>(
    value: T,
    delay: number,
    callback?: (debouncedValue: T) => void
): T {
    const [debouncedValue, setDebouncedValue] = useState(value);
    const callbackRef = useRef(callback);

    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
            if (callbackRef.current) {
                callbackRef.current(value);
            }
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}