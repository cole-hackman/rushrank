"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useFraternityColors } from "@/lib/queries";
import { api, provisionChapter, clearCachedChapterId } from "@/lib/api";

const PENDING_KEY = "rushrank.pendingSignup.v1";

interface PendingSignup {
  fraternity_name: string;
  school: string;
  chapter_name: string;
  admin_name: string;
}

export function SignupWizard() {
  const router = useRouter();
  const search = useSearchParams();
  const { data: fraternities = [] } = useFraternityColors();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fraternity, setFraternity] = useState("");
  const [school, setSchool] = useState("");
  const [chapterName, setChapterName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // What happens after the magic link brings the user back. Before this, the
  // return was invisible: provisioning ran with nothing on screen, an error was
  // stored but only rendered on step 2, and a link opened in another browser
  // simply did nothing.
  const [returnState, setReturnState] = useState<"idle" | "provisioning" | "error" | "missing">("idle");
  const provisioningRef = useRef(false);

  // Check if user is already a member of a chapter, redirect to dashboard
  useEffect(() => {
    (async () => {
      if (!supabase) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      try {
        // Hand-built as `${BASE}/api/v1/...`, this produced `/api/api/v1/...`
        // whenever the env var already carried the suffix.
        await api("/chapters/me/theme");
        router.replace("/dashboard");
      } catch {
        // No chapter yet -- stay on the wizard.
      }
    })();
  }, [router]);

  useEffect(() => {
    if (fraternity && school && !chapterName) {
      setChapterName(`${fraternity} at ${school}`);
    }
  }, [fraternity, school, chapterName]);

  const provision = useCallback(async () => {
    if (provisioningRef.current) return;
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) {
      setReturnState("missing");
      return;
    }
    provisioningRef.current = true;
    setError(null);
    setReturnState("provisioning");
    try {
      const pending: PendingSignup = JSON.parse(raw);
      await provisionChapter(pending);
      localStorage.removeItem(PENDING_KEY);
      clearCachedChapterId();
      router.replace("/dashboard?welcome=1");
    } catch (e: any) {
      provisioningRef.current = false;
      setError(e?.message ?? "We could not set up your chapter.");
      setReturnState("error");
    }
  }, [router]);

  useEffect(() => {
    const verified = search?.get("verified");
    if (!verified) return;
    if (!supabase) {
      setError("Sign-in is not configured on this site.");
      setReturnState("error");
      return;
    }
    if (!localStorage.getItem(PENDING_KEY)) {
      // The signup details live in the browser that started the signup. A
      // link opened anywhere else signs the user in but cannot create the
      // chapter. Say so instead of showing an empty step 1. (If this user
      // already has a chapter, the effect above sends them to the dashboard.)
      setReturnState("missing");
      return;
    }
    setReturnState("provisioning");

    // Driven by the auth-state callback rather than a bare getSession(): on
    // return from a magic link, getSession() can resolve before supabase-js has
    // finished parsing the token out of the URL hash.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) void provision();
    });

    // Covers the case where the session was already established before mount.
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) void provision();
    });

    return () => data.subscription.unsubscribe();
  }, [search, provision]);

  function startOver() {
    localStorage.removeItem(PENDING_KEY);
    provisioningRef.current = false;
    setError(null);
    setReturnState("idle");
    setStep(1);
    router.replace("/get-started");
  }

  async function sendMagicLink() {
    if (!supabase) {
      setError("Supabase not configured");
      return;
    }
    setError(null);
    setSending(true);
    try {
      const pending: PendingSignup = {
        fraternity_name: fraternity,
        school,
        chapter_name: chapterName,
        admin_name: adminName,
      };
      localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/get-started?verified=1`,
        },
      });
      if (error) throw error;
      setStep(3);
    } catch (e: any) {
      setError(e?.message ?? "Failed to send magic link");
    } finally {
      setSending(false);
    }
  }

  if (returnState === "provisioning") {
    return (
      <section className="mx-auto max-w-2xl px-6 py-24 text-center" aria-live="polite">
        <div className="mx-auto mb-6 h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
        <h1 className="font-serif text-3xl text-fg">Setting up your chapter</h1>
        <p className="mt-3 text-muted-foreground">
          This usually takes a few seconds. You will land on your dashboard when it is ready.
        </p>
      </section>
    );
  }

  if (returnState === "error") {
    return (
      <section className="mx-auto max-w-2xl px-6 py-24" role="alert">
        <h1 className="font-serif text-3xl text-fg">We could not finish setting up your chapter</h1>
        <p className="mt-4 rounded-lg border border-danger px-4 py-3 text-sm text-fg">
          {error}
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Your email is confirmed, so trying again will not send another link.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={() => void provision()}
            className="rounded-full bg-accent px-6 py-2 text-accent-fg"
          >
            Try again
          </button>
          <button onClick={startOver} className="rounded-full border border-border px-6 py-2 text-fg">
            Change chapter details
          </button>
        </div>
      </section>
    );
  }

  if (returnState === "missing") {
    return (
      <section className="mx-auto max-w-2xl px-6 py-24">
        <h1 className="font-serif text-3xl text-fg">Open the link in the browser you signed up in</h1>
        <p className="mt-4 text-muted-foreground">
          You are signed in, but your chapter details were saved in the browser where you started
          signing up, and this looks like a different one. Open the email link there to finish, or
          enter your chapter details again here.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button onClick={startOver} className="rounded-full bg-accent px-6 py-2 text-accent-fg">
            Enter details here
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-2xl px-6 py-24">
      <div className="mb-8 flex items-center justify-center gap-3">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={`h-2 w-12 rounded-full ${step >= n ? "bg-accent" : "bg-border"}`}
          />
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-5">
          <h1 className="font-serif text-3xl text-fg">Your chapter</h1>
          <label className="block">
            <span className="text-sm text-muted-foreground">Fraternity</span>
            <input
              list="fraternities"
              value={fraternity}
              onChange={(e) => setFraternity(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 touch:min-h-[44px]"
              placeholder="Sigma Chi"
            />
            <datalist id="fraternities">
              {fraternities.map((f) => <option key={f.key} value={f.name} />)}
            </datalist>
          </label>
          <label className="block">
            <span className="text-sm text-muted-foreground">School</span>
            <input
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 touch:min-h-[44px]"
              placeholder="Boston College"
            />
          </label>
          <label className="block">
            <span className="text-sm text-muted-foreground">Chapter name</span>
            <input
              value={chapterName}
              onChange={(e) => setChapterName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 touch:min-h-[44px]"
            />
          </label>
          <button
            disabled={!fraternity || !school || !chapterName}
            onClick={() => setStep(2)}
            className="rounded-full bg-accent px-6 py-2 text-accent-fg disabled:opacity-50 touch:min-h-[44px]"
          >
            Continue
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <h1 className="font-serif text-3xl text-fg">You</h1>
          <label className="block">
            <span className="text-sm text-muted-foreground">Your name</span>
            <input
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 touch:min-h-[44px]"
            />
          </label>
          <label className="block">
            <span className="text-sm text-muted-foreground">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 touch:min-h-[44px]"
            />
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="text-muted-foreground underline">Back</button>
            <button
              disabled={!adminName || !email || sending}
              onClick={sendMagicLink}
              className="rounded-full bg-accent px-6 py-2 text-accent-fg disabled:opacity-50 touch:min-h-[44px]"
            >
              {sending ? "Sending…" : "Send magic link"}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5 text-center">
          <h1 className="font-serif text-3xl text-fg">Check your email</h1>
          <p className="text-muted-foreground">
            We sent a sign-in link to <strong>{email}</strong>. Click it to finish setting up
            your chapter.
          </p>
          <button onClick={sendMagicLink} className="text-sm text-muted-foreground underline">
            Resend
          </button>
        </div>
      )}
    </section>
  );
}
