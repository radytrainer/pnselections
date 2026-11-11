"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { AppRole } from "@/lib/constants";

const LAST_ROLE_KEY = "pn-last-role";

/**
 * Reads the app_role/ngo_id Firebase custom claims off the current user's ID
 * token (set server-side via api/src/auth.ts#setUserClaims). These are
 * the same claims the database RLS policies evaluate — this hook is for UI gating only.
 */
export function useRole() {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [ngoId, setNgoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setRole(null);
      setNgoId(null);
      setLoading(false);
      return;
    }

    user
      .getIdTokenResult()
      .then((result) => {
        const nextRole = (result.claims.app_role as AppRole | undefined) ?? null;
        const nextNgoId = (result.claims.ngo_id as string | undefined) ?? null;
        setRole(nextRole);
        setNgoId(nextNgoId);
        try {
          localStorage.setItem(LAST_ROLE_KEY, JSON.stringify({ uid: user.uid, role: nextRole, ngoId: nextNgoId }));
        } catch {
          // storage unavailable
        }
      })
      .catch(() => {
        // Offline with an expired token: Firebase can't refresh it, so fall
        // back to the role this same user had last time (UI gating only).
        try {
          const last = JSON.parse(localStorage.getItem(LAST_ROLE_KEY) ?? "null") as
            | { uid: string; role: AppRole | null; ngoId: string | null }
            | null;
          if (last?.uid === user.uid) {
            setRole(last.role);
            setNgoId(last.ngoId);
          }
        } catch {
          // ignore
        }
      })
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  return { role, ngoId, loading };
}
