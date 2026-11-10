"use client";

import { useEffect, useState } from "react";
import { onIdTokenChanged, type User } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";

/**
 * Tracks the current Firebase user and keeps the server-side session cookie
 * (set by /api/auth/session) in sync on every sign-in/sign-out/token refresh.
 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getFirebaseAuth();

    const unsubscribe = onIdTokenChanged(auth, async (current) => {
      // Firebase mutates the same User instance in place (e.g. updateProfile
      // after an /account edit), so cloning it here is what makes React
      // actually re-render — setUser(current) alone would be a same-reference
      // no-op. Object.create + property descriptors preserves the prototype
      // (so methods like getIdToken still work) while forcing a new identity.
      setUser(
        current
          ? (Object.create(
              Object.getPrototypeOf(current),
              Object.getOwnPropertyDescriptors(current),
            ) as User)
          : null,
      );
      setLoading(false);

      if (current) {
        const idToken = await current.getIdToken();
        fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        }).catch(() => {});
      } else {
        fetch("/api/auth/session", { method: "DELETE" }).catch(() => {});
      }
    });

    return unsubscribe;
  }, []);

  return { user, loading };
}
