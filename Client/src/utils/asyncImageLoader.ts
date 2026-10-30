/**
 * Asynchronous Sequential Image Loader
 * Manages client-side progressive loading of images with controlled concurrency ("une par une").
 */

type QueueItem = {
    src: string;
    onLoad: () => void;
    onError: () => void;
};

class AsyncImageLoaderService {
    private queue: QueueItem[] = [];
    private activeCount = 0;
    private maxConcurrency = 2; // Controlled concurrency: progressive loading without network flooding
    private loadedCache = new Set<string>();
    private errorCache = new Set<string>();

    public isLoaded(src: string): boolean {
        return this.loadedCache.has(src);
    }

    public isError(src: string): boolean {
        return this.errorCache.has(src);
    }

    /**
     * Enqueue an image to be loaded asynchronously in order.
     * Returns a cancellation function.
     */
    public enqueue(src: string, onLoad: () => void, onError: () => void): () => void {
        if (!src) {
            onError();
            return () => {};
        }

        if (this.loadedCache.has(src)) {
            onLoad();
            return () => {};
        }

        if (this.errorCache.has(src)) {
            onError();
            return () => {};
        }

        const item: QueueItem = { src, onLoad, onError };
        this.queue.push(item);
        this.processQueue();

        return () => {
            const idx = this.queue.indexOf(item);
            if (idx !== -1) {
                this.queue.splice(idx, 1);
            }
        };
    }

    private processQueue() {
        while (this.activeCount < this.maxConcurrency && this.queue.length > 0) {
            const item = this.queue.shift();
            if (!item) break;

            if (this.loadedCache.has(item.src)) {
                item.onLoad();
                continue;
            }

            if (this.errorCache.has(item.src)) {
                item.onError();
                continue;
            }

            this.activeCount++;

            const img = new Image();
            img.decoding = "async";

            let finished = false;
            const finish = (success: boolean) => {
                if (finished) return;
                finished = true;
                this.activeCount--;

                if (success) {
                    this.loadedCache.add(item.src);
                    item.onLoad();
                } else {
                    this.errorCache.add(item.src);
                    item.onError();
                }

                // Process next item on next microtask
                setTimeout(() => {
                    this.processQueue();
                }, 10);
            };

            img.onload = () => finish(true);
            img.onerror = () => finish(false);
            img.src = item.src;
        }
    }

    public setConcurrency(limit: number) {
        if (limit > 0) {
            this.maxConcurrency = limit;
            this.processQueue();
        }
    }
}

export const asyncImageLoader = new AsyncImageLoaderService();
