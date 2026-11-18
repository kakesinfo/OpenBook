import { useState, useEffect, useRef } from "react";
import { asyncImageLoader } from "../../utils/asyncImageLoader.ts";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBook } from "@fortawesome/free-solid-svg-icons";
import "./AsyncCoverImage.scss";

interface AsyncCoverImageProps {
    src?: string | null;
    alt: string;
    title?: string;
    className?: string;
}

export default function AsyncCoverImage({
    src,
    alt,
    title,
    className = ""
}: AsyncCoverImageProps) {
    const isInitiallyLoaded = Boolean(src && asyncImageLoader.isLoaded(src));
    const [isLoaded, setIsLoaded] = useState<boolean>(isInitiallyLoaded);
    const [hasError, setHasError] = useState<boolean>(Boolean(src && asyncImageLoader.isError(src)));
    const elementRef = useRef<HTMLDivElement | null>(null);

    // Sync load/error state when src changes (adjust state during render instead of in an effect)
    const [prevSrc, setPrevSrc] = useState(src);
    if (src !== prevSrc) {
        setPrevSrc(src);
        if (!src) {
            setHasError(true);
        } else if (asyncImageLoader.isLoaded(src)) {
            setIsLoaded(true);
            setHasError(false);
        } else if (asyncImageLoader.isError(src)) {
            setHasError(true);
        } else {
            setIsLoaded(false);
            setHasError(false);
        }
    }

    useEffect(() => {
        if (!src || asyncImageLoader.isLoaded(src) || asyncImageLoader.isError(src)) {
            return;
        }

        let unsubscribeQueue: (() => void) | null = null;

        // Load visible images first via IntersectionObserver
        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (entry && entry.isIntersecting) {
                    observer.disconnect();

                    unsubscribeQueue = asyncImageLoader.enqueue(
                        src,
                        () => setIsLoaded(true),
                        () => setHasError(true)
                    );
                }
            },
            {
                rootMargin: "300px 0px"
            }
        );

        if (elementRef.current) {
            observer.observe(elementRef.current);
        }

        return () => {
            observer.disconnect();
            if (unsubscribeQueue) {
                unsubscribeQueue();
            }
        };
    }, [src]);

    if (!src || hasError) {
        return (
            <div className="booklist-card__cover-fallback">
                <FontAwesomeIcon icon={faBook} />
                <span>{title || alt}</span>
            </div>
        );
    }

    return (
        <div ref={elementRef} className={`async-cover ${className}`}>
            {!isLoaded && (
                <div className="async-cover__skeleton">
                    <FontAwesomeIcon icon={faBook} />
                </div>
            )}
            <img
                src={isLoaded ? src : undefined}
                alt={alt}
                decoding="async"
                className={`async-cover__img ${isLoaded ? "is-loaded" : ""}`}
            />
        </div>
    );
}
