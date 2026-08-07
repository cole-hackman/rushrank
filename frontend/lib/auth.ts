/**
 * The single place the app gets an access token.
 *
 * Previously the token was snapshotted into `localStorage.access_token` at
 * login and read from there forever. That had two consequences:
 *
 *  1. Supabase access tokens expire after about an hour and nothing refreshed
 *     the copy, so every request started 401ing and the only recovery offered
 *     was "log out and back in". In the middle of a chapter meeting that is
 *     the difference between a working demo and a dead one.
 *
 *  2. Only the password login form ever wrote that key. The magic-link signup
 *     flow never did -- so chapter provisioning 401'd, and the redirect to the
 *     dashboard bounced to a login the user had no password for. Self-serve
 *     signup could not complete.
 *
 * supabase-js already persists the session and refreshes it in the background;
 * the copy was throwing that away. Reading from the live session fixes both.
 */

import { supabase } from "@/lib/supabaseClient";

/** Emitted when the session goes away, so guards can react without polling. */
export const SIGNED_OUT_EVENT = "rushrank:signed-out";

export async function getAccessToken(): Promise<string | null> {
  // Dev mode: no Supabase configured. Exactly one function in the codebase
  // knows about this, rather than every call site checking.
  if (!supabase) return "dev-token";

  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Force a refresh after a 401, in case the cached session is merely stale. */
export async function refreshAccessToken(): Promise<string | null> {
  if (!supabase) return "dev-token";
  const { data, error } = await supabase.auth.refreshSession();
  if (error) return null;
  return data.session?.access_token ?? null;
}

export async function getSessionUser(): Promise<{ id: string; email?: string } | null> {
  if (!supabase) return { id: "dev", email: "dev@rushrank.local" };
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  return user ? { id: user.id, email: user.email ?? undefined } : null;
}

/**
 * Subscribe to auth changes. Returns an unsubscribe function.
 * Guards use this so signing out in one tab takes effect in all of them.
 */
export function onAuthChange(cb: (signedIn: boolean) => void): () => void {
  if (!supabase) {
    cb(true);
    return () => {};
  }
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    cb(Boolean(session));
  });
  return () => data.subscription.unsubscribe();
}

export async function signOut(): Promise<void> {
  // Chapter and admin caches are per-user; leaving them behind means the next
  // person to sign in on a shared laptop inherits the previous user's chapter.
  try {
    localStorage.removeItem("rushapp_chapter_id");
    localStorage.removeItem("rushapp_admin_status");
    localStorage.removeItem("user_email");
    localStorage.removeItem("user_name");
    // Legacy key from the snapshot-token era; clear it so it cannot be picked
    // up by anything that has not been migrated yet.
    localStorage.removeItem("access_token");
  } catch {
    // ignore storage failures
  }
  if (supabase) await supabase.auth.signOut();
}
