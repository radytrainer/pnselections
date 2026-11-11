"use client";

import { useCallback, useEffect, useState } from "react";
import { listOutbox, OUTBOX_EVENT, type OutboxItem } from "@/lib/offline/store";

/** Live connection state + the offline outbox, for the status chip and Field Mode. */
export function useOfflineStatus() {
  const [online, setOnline] = useState(true);
  const [items, setItems] = useState<OutboxItem[]>([]);

  const refresh = useCallback(() => {
    listOutbox().then(setItems);
  }, []);

  useEffect(() => {
    setOnline(navigator.onLine);
    refresh();
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    window.addEventListener(OUTBOX_EVENT, refresh);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener(OUTBOX_EVENT, refresh);
    };
  }, [refresh]);

  return {
    online,
    items,
    pending: items.filter((i) => i.status === "pending"),
    failed: items.filter((i) => i.status === "failed"),
  };
}
