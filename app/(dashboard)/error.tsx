"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OfflineNotice } from "@/components/offline/OfflineNotice";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";

/**
 * Error boundary for every page inside the app shell: a page that throws
 * while rendering shows this inside the normal layout (sidebar, top bar)
 * instead of Next.js's blank "Application error" screen.
 *
 * Offline, the usual cause is a part of the page that was never downloaded
 * to this device (e.g. chart or map code), so say that plainly — and retry
 * on our own once the connection comes back.
 */
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { online } = useOfflineStatus();

  useEffect(() => {
    console.error(error);
  }, [error]);

  // A failed code download (ChunkLoadError) can't be retried in place —
  // reset() would reuse the failed import — so reload the page instead.
  const isChunkError = /ChunkLoadError|Loading chunk|dynamically imported module|Failed to fetch/i.test(
    `${error.name} ${error.message}`,
  );
  const retry = () => (isChunkError ? window.location.reload() : reset());

  useEffect(() => {
    if (!online) {
      const backOnline = () => retry();
      window.addEventListener("online", backOnline, { once: true });
      return () => window.removeEventListener("online", backOnline);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- retry is stable for this error
  }, [online]);

  if (!online) return <OfflineNotice />;

  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center"
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-6 text-destructive" />
      </div>
      <div className="space-y-1">
        <p className="font-medium">This page couldn&apos;t be loaded</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Something went wrong while showing this page. Try again — if it keeps happening, reload the app.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={retry}>
        <RotateCw />
        Try again
      </Button>
    </div>
  );
}
