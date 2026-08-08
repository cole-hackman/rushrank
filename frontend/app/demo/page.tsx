"use client";

/**
 * "Try the demo" — sign in to the seeded read-only chapter.
 *
 * The landing page's demo link used to be an anchor to a swipe widget further
 * down the same page. A chapter deciding whether to run rush on this wants to
 * see the results table, the bid list and the PNM dossiers, not a toy.
 *
 * No credentials here: `POST /public/demo-session` holds them server-side and
 * hands back a session. The account is `observer` in one chapter, and the
 * backend rejects every non-GET request from an observer-only user, so a
 * visitor cannot break the demo for the next one.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startDemoSession } from "@/lib/api";
import { supabase } from "@/lib/supabaseClient";
import { clearCachedChapterId } from "@/lib/api";

type State = "starting" | "unavailable" | "failed";

export default function DemoPage() {
  const router = useRouter();
  const [state, setState] = useState<State>("starting");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const session = await startDemoSession();

        if (!supabase) throw new Error("Supabase is not configured");
        const { error } = await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });
        if (error) throw error;

        // The previous visitor's chapter may still be cached in this browser.
        clearCachedChapterId();
        if (!cancelled) router.replace("/dashboard");
      } catch (e: any) {
        if (cancelled) return;
        // 404 is the deployment saying "no demo configured here", which is a
        // different message from "the demo is broken".
        setState(e?.status === 404 || /not enabled/i.test(e?.message ?? "") ? "unavailable" : "failed");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
      {state === "starting" && (
        <>
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-fg/20 border-t-fg" />
          <p className="text-lg text-fg">Setting up your demo chapter…</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            You&apos;ll land in a chapter that has already been through rush — full roster, two
            completed rounds, and a finished bid list.
          </p>
        </>
      )}

      {state !== "starting" && (
        <>
          <h1 className="text-2xl font-semibold text-fg">
            {state === "unavailable" ? "The demo isn't set up here" : "The demo didn't load"}
          </h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            {state === "unavailable"
              ? "This deployment doesn't have a demo chapter configured. Creating your own chapter takes about two minutes."
              : "Something went wrong reaching the demo account. Try again in a moment, or start your own chapter instead."}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/get-started"
              className="rounded-full bg-accent px-6 py-3 text-base font-medium text-accent-foreground"
            >
              Get started free
            </Link>
            <Link
              href="/"
              className="rounded-full border border-fg/15 px-6 py-3 text-base text-fg hover:bg-surface-muted"
            >
              Back to home
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
