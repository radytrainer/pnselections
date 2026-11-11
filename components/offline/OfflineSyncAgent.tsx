"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { syncOutbox } from "@/lib/offline/sync";
import { listOutbox } from "@/lib/offline/store";

const RETRY_INTERVAL_MS = 30_000;

/** Sends offline changes automatically: on load, when the connection returns, and every 30s while any are waiting. */
export function OfflineSyncAgent() {
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (cancelled || !navigator.onLine) return;
      const result = await syncOutbox().catch(() => null);
      if (!result || cancelled) return;
      if (result.sent > 0) {
        toast.success(`Synced ${result.sent} offline change${result.sent === 1 ? "" : "s"} to the server`);
      }
      if (result.failed > 0) {
        toast.error(`${result.failed} offline change${result.failed === 1 ? " was" : "s were"} rejected — open the sync menu to review`);
      }
    }

    run();
    window.addEventListener("online", run);
    const timer = window.setInterval(async () => {
      if ((await listOutbox()).some((i) => i.status === "pending")) run();
    }, RETRY_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.removeEventListener("online", run);
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
