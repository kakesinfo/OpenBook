/**
 * Service Worker for Client-Side Book Cover Image Caching
 *
 * Implements a Cache-First strategy for all album / comic covers:
 * - Serves cached covers immediately from the browser's CacheStorage (0ms)
 * - Automatically caches downloaded covers (supports standard & cross-origin opaque responses)
 * - Persists covers across sessions and page navigations
 * - Automatically manages cache size with LRU eviction
 */

const CACHE_NAME = 'book-covers-cache-v1';
const MAX_COVERS = 3000;

const COVER_HOSTS = [
  'bdi.dlpdomain.com',
  'label619.com',
  'panini.fr',
  'mangetsu-manga.fr',
  'cdn.prod.website-files.com',
  'i0.wp.com',
  'medias.edl.li',
  'monsieurtoussaintlouverture.com'
];

function isCoverImageRequest(request) {
  if (request.method !== 'GET') return false;

  const urlStr = request.url;
  if (!urlStr.startsWith('http')) return false;

  // Explicit image destination
  if (request.destination === 'image') return true;

  try {
    const url = new URL(urlStr);

    // Known cover CDNs & publishers
    if (COVER_HOSTS.some(host => url.hostname.includes(host))) {
      return true;
    }

    // Common image file extensions
    if (/\.(jpe?g|png|webp|gif|svg|avif)(\?.*)?$/i.test(url.pathname)) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

async function trimCache(cache, maxItems) {
  try {
    const keys = await cache.keys();
    if (keys.length > maxItems) {
      const deleteCount = keys.length - maxItems;
      for (let i = 0; i < deleteCount; i++) {
        await cache.delete(keys[i]);
      }
    }
  } catch {
    // Non-critical cache trim error
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (!isCoverImageRequest(request)) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      // 1. Check local cache first
      const cachedResponse = await cache.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }

      // 2. Fetch from network and cache
      try {
        const networkResponse = await fetch(request);

        // Opaque responses (status 0) are valid for cross-origin images loaded via <img>
        const isOpaque = networkResponse.type === 'opaque';
        const isOk = networkResponse.status === 200;

        if (networkResponse && (isOk || isOpaque)) {
          cache.put(request, networkResponse.clone());
          trimCache(cache, MAX_COVERS);
        }

        return networkResponse;
      } catch (error) {
        if (cachedResponse) {
          return cachedResponse;
        }
        throw error;
      }
    })
  );
});

self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'CLEAR_COVER_CACHE') {
    event.waitUntil(
      caches.delete(CACHE_NAME).then(() => {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ success: true });
        }
      })
    );
  }

  if (event.data.type === 'GET_COVER_CACHE_COUNT') {
    event.waitUntil(
      caches.open(CACHE_NAME).then(async (cache) => {
        const keys = await cache.keys();
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ count: keys.length });
        }
      })
    );
  }
});
