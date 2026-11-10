"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { AppRole } from "@/lib/constants";

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

    user.getIdTokenResult().then((result) => {
      setRole((result.claims.app_role as AppRole | undefined) ?? null);
      setNgoId((result.claims.ngo_id as string | undefined) ?? null);
      setLoading(false);
    });
  }, [user, authLoading]);

  return { role, ngoId, loading };
}
