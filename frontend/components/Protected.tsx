"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getAccessToken, onAuthChange, SIGNED_OUT_EVENT } from "@/lib/auth";

/**
 * Client-side auth gate.
 *
 * Two things this has to get right that the previous version did not:
 *
 *  - It must not redirect while it is still resolving. The old version read
 *    localStorage synchronously and bounced immediately, which is why returning
 *    from a magic link kicked you back to /login before supabase-js had
 *    finished parsing the token out of the URL hash.
 *  - It must react to the session going away, so signing out in one tab or
 *    hitting an unrecoverable 401 does not leave a dead UI on screen.
 */
export default function Protected({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<"loading" | "authed" | "anon">("loading");

  useEffect(() => {
    let active = true;

    (async () => {
      const token = await getAccessToken();
      if (!active) return;
      setState(token ? "authed" : "anon");
    })();

    const unsubscribe = onAuthChange((signedIn) => {
      if (active) setState(signedIn ? "authed" : "anon");
    });

    const onSignedOut = () => active && setState("anon");
    window.addEventListener(SIGNED_OUT_EVENT, onSignedOut);

    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener(SIGNED_OUT_EVENT, onSignedOut);
    };
  }, []);

  useEffect(() => {
    if (state !== "anon") return;
    // Preserve where they were headed so sign-in can return them there.
    const next = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
    router.replace(`/login${next}`);
  }, [state, pathname, router]);

  if (state === "loading") {
    return <div className="h-screen flex items-center justify-center">Loading...</div>;
  }
  if (state === "anon") return null;
  return <>{children}</>;
}
