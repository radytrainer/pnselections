"use client";

import Link from "next/link";
import { WifiOff } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Shown instead of a page's content when it can't work without a connection
 * (live charts, the online map). The page re-loads its data by itself once
 * the browser reports it's back online.
 */
export function OfflineNotice({
  title = "No internet connection",
  message = "This page needs an internet connection. It will load automatically when you're back online.",
  className,
}: {
  title?: string;
  message?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/30 px-6 py-16 text-center",
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <WifiOff className="size-6 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      </div>
      <Link href="/field" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-1")}>
        Open Field Mode (works offline)
      </Link>
    </div>
  );
}
