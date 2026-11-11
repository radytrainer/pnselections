import { api, ApiError, buildUrl, isOffline, OfflineError, sendRequest } from "@/lib/api/client";
import { listOutbox, putOutboxItem, removeOutboxItem } from "@/lib/offline/store";

export type SyncResult = { sent: number; failed: number; remaining: number };

let running: Promise<SyncResult> | null = null;

/** Temporary problems: keep the item pending and try again later. */
function isTemporary(error: unknown) {
  if (error instanceof OfflineError || error instanceof TypeError) return true;
  if ((error as { code?: unknown } | null)?.code === "auth/network-request-failed") return true;
  if (error instanceof ApiError) return error.status >= 500 || error.status === 401 || error.status === 429 || error.status === 408;
  return false;
}

/**
 * Sends queued offline writes, oldest first. Each is sent with its own id as
 * the Idempotency-Key, so a write the server already received is not saved
 * twice. Rejected writes (e.g. permission or validation errors) are kept as
 * "failed" for the user to retry or discard rather than silently dropped.
 */
export function syncOutbox(): Promise<SyncResult> {
  if (running) return running;
  running = (async () => {
    let sent = 0;
    let failed = 0;
    const touchedStudents = new Set<string>();
    try {
      for (const item of await listOutbox()) {
        if (item.status !== "pending") continue;
        if (isOffline()) break;
        try {
          await sendRequest(item.method, buildUrl(item.path), {
            body: item.body,
            headers: { "Idempotency-Key": item.id },
          });
          await removeOutboxItem(item.id);
          if (item.studentId) touchedStudents.add(item.studentId);
          sent++;
        } catch (error) {
          if (isTemporary(error)) {
            await putOutboxItem({ ...item, attempts: item.attempts + 1 });
            break; // connection trouble: stop and retry the whole queue later, in order
          }
          await putOutboxItem({
            ...item,
            attempts: item.attempts + 1,
            status: "failed",
            error: error instanceof Error ? error.message : "Rejected by the server",
          });
          failed++;
        }
      }
      // Replace the optimistic offline copies with the server's real data.
      await Promise.allSettled(Array.from(touchedStudents).map((id) => api.get(`/api/v1/students/${id}`)));
    } finally {
      running = null;
    }
    const remaining = (await listOutbox()).filter((i) => i.status === "pending").length;
    return { sent, failed, remaining };
  })();
  return running;
}

export async function retryOutboxItem(id: string) {
  const item = (await listOutbox()).find((i) => i.id === id);
  // A fresh key: the server already answered the old one with the rejection.
  if (item) {
    await removeOutboxItem(id);
    await putOutboxItem({ ...item, id: crypto.randomUUID(), status: "pending", error: undefined });
  }
  return syncOutbox();
}

export function discardOutboxItem(id: string) {
  return removeOutboxItem(id);
}
