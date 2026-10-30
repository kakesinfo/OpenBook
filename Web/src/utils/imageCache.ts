/**
 * Utility for client-side book cover caching via Service Worker & CacheStorage API.
 */

export function registerImageCacheWorker() {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
        return;
    }

    // Only register on secure contexts (HTTPS or localhost)
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        console.info('[ImageCache] Service Worker requires HTTPS or localhost.');
        return;
    }

    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('/sw.js', { scope: '/' })
            .then((registration) => {
                // Ensure update check on page reload
                registration.update().catch(() => {});
            })
            .catch((error) => {
                console.warn('[ImageCache] Service Worker registration failed:', error);
            });
    });
}

/**
 * Returns the count of cached cover images in browser storage.
 */
export async function getCachedCoverCount(): Promise<number> {
    if (typeof window === 'undefined' || !('caches' in window)) {
        return 0;
    }

    try {
        const cache = await caches.open('book-covers-cache-v1');
        const keys = await cache.keys();
        return keys.length;
    } catch {
        return 0;
    }
}

/**
 * Clears all cached album covers from browser storage.
 */
export async function clearCoverImageCache(): Promise<boolean> {
    if (typeof window === 'undefined' || !('caches' in window)) {
        return false;
    }

    try {
        return await caches.delete('book-covers-cache-v1');
    } catch {
        return false;
    }
}
