"use client";

import { useAuth } from "@/hooks/useAuth";

/**
 * Mounted once in the root layout so the Firebase ID token listener (and the
 * server-session cookie sync it triggers) stays active across the whole app,
 * not just on pages that happen to call useAuth() themselves.
 */
export function AuthSync() {
  useAuth();
  return null;
}
