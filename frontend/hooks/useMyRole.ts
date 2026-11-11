import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export type MyRole = {
  /** True once /me has answered (or failed). Until then every flag is false. */
  ready: boolean;
  role: string | null;
  isAdmin: boolean;
  /** Admin or exec: the roles the bid list, GPA waivers and deck export accept. */
  canManage: boolean;
};

const NONE: MyRole = { ready: false, role: null, isAdmin: false, canManage: false };

let pending: Promise<MyRole> | null = null;

async function load(): Promise<MyRole> {
  try {
    const profile = await api<{ memberships: Array<{ role: string }> }>("/me");
    const roles = (profile.memberships || []).map((m) => String(m.role || "").toLowerCase());
    const isAdmin = roles.includes("admin");
    const role = isAdmin ? "admin" : roles.includes("exec") ? "exec" : roles[0] ?? null;
    return { ready: true, role, isAdmin, canManage: isAdmin || roles.includes("exec") };
  } catch {
    // Unknown role: show nothing that needs one. The API still enforces it.
    return { ...NONE, ready: true };
  }
}

/**
 * The signed-in user's role, for hiding controls the API would refuse.
 * One /me request per page load, shared by every component that asks.
 */
export function useMyRole(): MyRole {
  const [state, setState] = useState<MyRole>(NONE);
  useEffect(() => {
    let live = true;
    if (!pending) pending = load();
    pending.then((r) => {
      if (live) setState(r);
    });
    return () => {
      live = false;
    };
  }, []);
  return state;
}

/** Forget the cached role, e.g. after signing out or switching account. */
export function resetMyRole(): void {
  pending = null;
}
