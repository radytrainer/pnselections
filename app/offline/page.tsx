"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ClipboardList, RotateCw, Users, WifiOff } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { Button, buttonVariants } from "@/components/ui/button";
import { getBundleInfo, type BundleInfo } from "@/lib/offline/bundle";
import { cn } from "@/lib/utils";

/**
 * Served by the service worker in place of any page that was never saved on
 * this device. The address bar still shows the page that was asked for, so
 * reloading (by hand or when the connection returns) opens that page.
 *
 * Links are plain <a> on purpose: offline, a full page load is what the
 * service worker can answer from the saved pages; client-side navigation
 * would need the server.
 */
export default function OfflinePage() {
  const [info, setInfo] = useState<BundleInfo | null | undefined>(undefined);
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    getBundleInfo()
      .then((i) => setInfo(i ?? null))
      .catch(() => setInfo(null));
    setCanGoBack(window.history.length > 1);

    // Back online: open the page that was originally asked for.
    const reload = () => window.location.reload();
    window.addEventListener("online", reload);
    return () => window.removeEventListener("online", reload);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-6 text-center">
      <Logo />

      <div className="flex size-14 items-center justify-center rounded-full bg-muted">
        <WifiOff className="size-7 text-muted-foreground" />
      </div>

      <div className="max-w-md space-y-1">
        <h1 className="text-lg font-semibold">This page isn&apos;t available offline</h1>
        <p className="text-sm text-muted-foreground">
          It hasn&apos;t been saved on this device. You can keep working in the pages below — they work
          without internet. This page opens by itself when you&apos;re back online.
        </p>
      </div>

      {/* eslint-disable @next/next/no-html-link-for-pages -- full page loads on purpose (see top comment) */}
      <div className="grid w-full max-w-md gap-2 sm:grid-cols-2">
        <a href="/field" className={cn(buttonVariants({ size: "lg" }), "h-12 justify-center")}>
          <ClipboardList />
          Field Mode
        </a>
        <a href="/students" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-12 justify-center")}>
          <Users />
          Students
        </a>
      </div>
      {/* eslint-enable @next/next/no-html-link-for-pages */}

      <div className="flex flex-wrap items-center justify-center gap-2">
        {canGoBack && (
          <Button variant="ghost" onClick={() => window.history.back()}>
            <ArrowLeft />
            Go back
          </Button>
        )}
        <Button variant="ghost" onClick={() => window.location.reload()}>
          <RotateCw />
          Try again
        </Button>
      </div>

      {info !== undefined && (
        <p className="max-w-md rounded-lg border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
          {info ? (
            <>
              Offline data on this device: <span className="font-medium text-foreground">{info.studentCount} students</span>,
              downloaded {new Date(info.downloadedAt).toLocaleString()}.
            </>
          ) : (
            <>
              No offline data on this device yet. When you&apos;re online, open <span className="font-medium">Field Mode</span>{" "}
              and press <span className="font-medium">Download for offline</span>.
            </>
          )}
        </p>
      )}
    </div>
  );
}
