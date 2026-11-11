/**
 * On-device storage for offline use (IndexedDB, no extra dependency).
 *   responses  last successful JSON response per API GET URL (read fallback)
 *   outbox     writes made while offline, waiting to be sent
 *   meta       small values: downloaded student list, download time, ...
 * All of it is personal data, so it's wiped on sign-out (clearOfflineData).
 */

const DB_NAME = "pn-offline";
const DB_VERSION = 1;
const STORES = ["responses", "outbox", "meta"] as const;
type StoreName = (typeof STORES)[number];

export const OUTBOX_EVENT = "pn-offline-outbox-changed";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB unavailable"));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        for (const name of STORES) {
          if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        dbPromise = null;
        reject(request.error);
      };
    });
  }
  return dbPromise;
}

function tx<T>(store: StoreName, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(store, mode);
        const request = run(transaction.objectStore(store));
        transaction.oncomplete = () => resolve(request ? (request.result as T) : (undefined as T));
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      }),
  );
}

export const idbGet = <T>(store: StoreName, key: string) => tx<T | undefined>(store, "readonly", (s) => s.get(key));
export const idbPut = (store: StoreName, key: string, value: unknown) => tx(store, "readwrite", (s) => void s.put(value, key));
export const idbDelete = (store: StoreName, key: string) => tx(store, "readwrite", (s) => void s.delete(key));
export const idbAll = <T>(store: StoreName) => tx<T[]>(store, "readonly", (s) => s.getAll());

/** Writes many keys in one transaction (used by the bundle download). */
export function idbPutMany(store: StoreName, entries: [string, unknown][]) {
  return tx(store, "readwrite", (s) => {
    for (const [key, value] of entries) s.put(value, key);
  });
}

// ---------------------------------------------------------------------------
// Response cache
// ---------------------------------------------------------------------------
export type CachedResponse = { data: unknown; savedAt: number };

export async function getCachedResponse(url: string): Promise<unknown | undefined> {
  try {
    const hit = await idbGet<CachedResponse>("responses", url);
    return hit?.data;
  } catch {
    return undefined;
  }
}

export function cacheResponse(url: string, data: unknown) {
  return idbPut("responses", url, { data, savedAt: Date.now() } satisfies CachedResponse).catch(() => {});
}

// ---------------------------------------------------------------------------
// Outbox
// ---------------------------------------------------------------------------
export type OutboxItem = {
  /** Also sent as the Idempotency-Key, so a retried write is saved only once. */
  id: string;
  method: string;
  path: string;
  body: unknown;
  /** Writes to the same target replace each other while still pending. */
  target: string;
  label: string;
  studentId?: string;
  createdAt: number;
  attempts: number;
  status: "pending" | "failed";
  error?: string;
};

function notifyOutbox() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OUTBOX_EVENT));
}

export async function listOutbox(): Promise<OutboxItem[]> {
  try {
    return (await idbAll<OutboxItem>("outbox")).sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

export async function putOutboxItem(item: OutboxItem) {
  await idbPut("outbox", item.id, item);
  notifyOutbox();
}

export async function removeOutboxItem(id: string) {
  await idbDelete("outbox", id);
  notifyOutbox();
}

// ---------------------------------------------------------------------------
// Meta + cleanup
// ---------------------------------------------------------------------------
export const getMeta = <T>(key: string) => idbGet<T>("meta", key).catch(() => undefined);
export const setMeta = (key: string, value: unknown) => idbPut("meta", key, value);

/**
 * A one-time message shown on the next page. Offline, navigating after a save
 * becomes a full page load (no server to fetch the next page's data from),
 * which would otherwise wipe the "saved on this device" toast.
 */
const FLASH_KEY = "pn-flash";
export function setFlash(message: string) {
  try {
    sessionStorage.setItem(FLASH_KEY, message);
  } catch {
    // ignore
  }
}
export function takeFlash(): string | null {
  try {
    const message = sessionStorage.getItem(FLASH_KEY);
    sessionStorage.removeItem(FLASH_KEY);
    return message;
  } catch {
    return null;
  }
}

export async function clearOfflineData() {
  try {
    await Promise.all(STORES.map((store) => tx(store, "readwrite", (s) => void s.clear())));
  } catch {
    // nothing stored
  }
  try {
    localStorage.removeItem("pn-last-role");
  } catch {
    // ignore
  }
  notifyOutbox();
}
