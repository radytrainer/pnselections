"use client";

import { useRole } from "@/hooks/useRole";
import { can, type Capability } from "@/lib/rbac";

/**
 * UI-only gate — hides children the current role can't act on. Never the
 * security boundary (Postgres RLS, applied by the API, is); see docs/09-security.md §2.2.
 */
export function RoleGate({
  capability,
  children,
}: {
  capability: Capability;
  children: React.ReactNode;
}) {
  const { role } = useRole();

  if (!can(role, capability)) return null;

  return <>{children}</>;
}
