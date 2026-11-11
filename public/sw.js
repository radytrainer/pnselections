const CACHE_NAME = "app-shell-v4";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([
        OFFLINE_URL,
        "/icons/icon-192.png",
        "/icons/icon-512.png",
        "/favicon.ico",
      ]),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Webpack's chunk filenames under /_next/static/ are content-hashed and
  // immutable, so they're the only thing safe to serve cache-first.
  // Everything else — full-page navigations AND the RSC data fetches the
  // App Router makes for client-side <Link> transitions — must go to the
  // network first. Those responses reference the *current* deployment's
  // chunk hashes, so a stale cached copy from before the last deploy can
  // point at chunks the new deployment no longer serves, crashing the page
  // with module-mismatch errors ("X is not a function") on navigation.
  if (!url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request, { ignoreVary: true });
          if (cached) return cached;
          if (request.mode === "navigate") {
            // Field Mode pages take the student as ?studentId=, so the page
            // shell cached for one student serves any other one offline.
            const sameRoute = await caches.match(request, { ignoreSearch: true, ignoreVary: true });
            return sameRoute || caches.match(OFFLINE_URL);
          }
          // e.g. a client-side navigation's data fetch: fail fast so Next.js
          // falls back to a full page load, which the branch above serves.
          return Response.error();
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
