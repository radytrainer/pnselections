"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, CloudOff, CloudUpload, Loader2, RefreshCw, Trash2, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import { discardOutboxItem, retryOutboxItem, syncOutbox } from "@/lib/offline/sync";
import { cn } from "@/lib/utils";

/** Top-bar chip: connection state + offline changes waiting to sync. Hidden when online with nothing pending. */
export function OfflineIndicator() {
  const { online, items, pending, failed } = useOfflineStatus();
  const [syncing, setSyncing] = useState(false);

  if (online && items.length === 0) return null;

  async function syncNow() {
    setSyncing(true);
    try {
      const result = await syncOutbox();
      if (result.remaining === 0 && result.failed === 0) toast.success("Everything is synced");
      else if (result.remaining > 0) toast.message(`${result.remaining} change(s) still waiting for a connection`);
    } finally {
      setSyncing(false);
    }
  }

  const label = !online
    ? `Offline${pending.length ? ` · ${pending.length} waiting` : ""}`
    : failed.length
      ? `${failed.length} failed`
      : `${pending.length} to sync`;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-7 gap-1.5 rounded-full px-2.5 text-xs",
              !online && "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100",
              online && failed.length > 0 && "border-red-300 bg-red-50 text-red-700 hover:bg-red-100",
              online && failed.length === 0 && "border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100",
            )}
          />
        }
      >
        {!online ? (
          <CloudOff className="size-3.5" />
        ) : failed.length ? (
          <AlertTriangle className="size-3.5" />
        ) : (
          <CloudUpload className="size-3.5" />
        )}
        {label}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          {online ? <Wifi className="size-4 text-green-600" /> : <CloudOff className="size-4 text-amber-600" />}
          {online ? "Online" : "Offline — changes are saved on this device"}
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No changes waiting to sync.</p>
        ) : (
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {items.map((item) => (
              <li key={item.id} className="rounded-md border p-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">{item.label}</span>
                  <span className={item.status === "failed" ? "text-red-600" : "text-muted-foreground"}>
                    {item.status === "failed" ? "Failed" : "Waiting"}
                  </span>
                </div>
                <div className="text-muted-foreground">Saved {new Date(item.createdAt).toLocaleString()}</div>
                {item.error && <div className="mt-1 text-red-600">{item.error}</div>}
                {item.status === "failed" && (
                  <div className="mt-1.5 flex gap-1.5">
                    <Button size="xs" variant="outline" onClick={() => retryOutboxItem(item.id)}>
                      <RefreshCw className="size-3" /> Retry
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      className="text-red-600"
                      onClick={() => {
                        if (confirm("Discard this change? It will not be saved to the server.")) discardOutboxItem(item.id);
                      }}
                    >
                      <Trash2 className="size-3" /> Discard
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between gap-2">
          <Button size="sm" disabled={!online || syncing || pending.length === 0} onClick={syncNow}>
            {syncing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            Sync now
          </Button>
          <Link href="/field" className="text-xs text-primary underline-offset-2 hover:underline">
            Open Field Mode
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
