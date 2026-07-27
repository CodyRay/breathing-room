/*
 * Service worker for Breathing Room.
 *
 * Its main job is making the app installable and usable without a connection —
 * which suits this app unusually well, since a session needs no network at all
 * once loaded: the audio is synthesised, the patterns are constants, and
 * preferences are local.
 *
 * Three strategies, chosen so a deploy is never served stale:
 *
 *   - `/_next/static/*` is content-hashed, so a URL's contents can never
 *     change. Cache-first, forever.
 *   - Navigations go network-first, falling back to cache when offline. A new
 *     deploy is therefore picked up immediately rather than on a later visit.
 *   - Everything else same-origin (icons, voice clips) is
 *     stale-while-revalidate: instant from cache, refreshed in the background.
 */

const CACHE = "breathing-room-v1";
const OFFLINE_FALLBACK = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.add(OFFLINE_FALLBACK)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached ?? caches.match(OFFLINE_FALLBACK);
        }),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
            return response;
          }),
      ),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached ?? network;
    }),
  );
});
