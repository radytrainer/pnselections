"use client";

import { useEffect } from "react";

// sw.js serves /_next/static/ cache-first, which is only safe when chunk names
// are content-hashed (production). In `next dev` they aren't, so a registered
// worker keeps serving stale code after every edit. Skip it in development
// unless explicitly wanted (NEXT_PUBLIC_ENABLE_SW_IN_DEV=1, e.g. to test Field Mode).
const ENABLED =
  process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_ENABLE_SW_IN_DEV === "1";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (ENABLED) {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.error("Service worker registration failed", error);
      });
      return;
    }

    // Dev: remove a worker left over from an earlier session, plus its app-shell
    // cache (offline student data lives in IndexedDB and is untouched), then
    // reload once so this page stops running stale cached code.
    const wasControlled = !!navigator.serviceWorker.controller;
    (async () => {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.filter((k) => k.startsWith("app-shell")).map((k) => caches.delete(k)));
      }
      if (wasControlled && regs.length > 0) window.location.reload();
    })().catch(() => {});
  }, []);

  return null;
}
