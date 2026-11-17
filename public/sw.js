const CACHE_NAME = "app-shell-v4";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll([
        OFFLINE_URL,
        "/icons/icon-192.png",
        "/icons/icon-512.png",
        "/favicon.ico",
        // Logos shown on the offline page and app header.
        "/brand/pn-logo.png",
        "/brand/pn-logo-white.png",
        "/brand/pn-mark.png",
      ]);
      // Also keep the offline page's own scripts/styles, so its buttons (Go
      // back, Try again, auto-reload when back online) work on a device that
      // never opened it while online. Best effort — the page's plain links
      // work without them.
      try {
        const html = await (await cache.match(OFFLINE_URL)).text();
        const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s)]+\.(?:js|css|woff2)/g) || [])];
        await Promise.all(assets.map((a) => cache.add(a).catch(() => {})));
      } catch {
        // ignore
      }
    }),
  );
  self.skipWaiting();
});

// App Router data requests ("RSC payloads"): the same page URL, but asking for
// React's wire format instead of HTML. They must never be cached or served as
// a page — opened directly, they show as raw text ("1:"$Sreact.fragment"...").
function isRscRequest(request, url) {
  return (
    request.headers.get("RSC") === "1" ||
    request.headers.has("Next-Router-Prefetch") ||
    url.searchParams.has("_rsc")
  );
}

function isHtml(response) {
  return (response.headers.get("Content-Type") || "").includes("text/html");
}

function isRscResponse(response) {
  return (response.headers.get("Content-Type") || "").includes("text/x-component");
}

/** Best cached HTML page for a navigation: exact URL first, then same path with any query (Field Mode ?studentId=). */
async function cachedPageFor(request) {
  const cache = await caches.open(CACHE_NAME);
  const exact = await cache.matchAll(request, { ignoreVary: true });
  const exactHtml = exact.find(isHtml);
  if (exactHtml) return exactHtml;
  const sameRoute = await cache.matchAll(request, { ignoreSearch: true, ignoreVary: true });
  return sameRoute.find(isHtml);
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      // Earlier versions cached RSC payloads under page URLs; drop them so they
      // can't be served as a page offline. Downloaded HTML pages are kept.
      .then(() => caches.open(CACHE_NAME))
      .then(async (cache) => {
        const requests = await cache.keys();
        await Promise.all(
          requests.map(async (req) => {
            const res = await cache.match(req);
            if (res && isRscResponse(res)) await cache.delete(req);
          }),
        );
      })
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
    const rsc = isRscRequest(request, url);
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Keep pages and plain files; never RSC payloads (see isRscRequest).
          if (response.ok && !rsc && !isRscResponse(response)) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          // A client-side navigation's data fetch: fail fast so Next.js falls
          // back to a full page load, which the navigate branch below serves.
          if (rsc) return Response.error();
          if (request.mode === "navigate") {
            // Only ever answer a page load with HTML. Field Mode pages take
            // the student as ?studentId=, so the page cached for one student
            // serves any other one offline.
            return (await cachedPageFor(request)) || caches.match(OFFLINE_URL);
          }
          const cached = await caches.match(request, { ignoreVary: true });
          return cached && !isRscResponse(cached) ? cached : Response.error();
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
