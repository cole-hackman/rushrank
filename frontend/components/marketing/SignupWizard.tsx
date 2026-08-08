"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    const verified = search?.get("verified");
    if (!verified) return;
    if (!supabase) {
      setError("Supabase not configured");
      return;
    }
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return;

    let done = false;
    const provision = async () => {
      if (done) return;
      done = true;
      try {
        const pending: PendingSignup = JSON.parse(raw);
        await provisionChapter(pending);
        localStorage.removeItem(PENDING_KEY);
        clearCachedChapterId();
        router.replace("/dashboard?welcome=1");
      } catch (e: any) {
        done = false;
        setError(e?.message ?? "Provisioning failed");
      }
    };

    // Driven by the auth-state callback rather than a bare getSession(): on
    // return from a magic link, getSession() can resolve before supabase-js has
    // finished parsing the token out of the URL hash. The old code returned
    // silently in that case, leaving the user on this screen with no chapter
    // and no error -- one of the two reasons self-serve signup never completed.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) void provision();
    });

    // Covers the case where the session was already established before mount.
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) void provision();
    });

    return () => data.subscription.unsubscribe();
  }, [search, router]);

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
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2"
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
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2"
              placeholder="Boston College"
            />
          </label>
          <label className="block">
            <span className="text-sm text-muted-foreground">Chapter name</span>
            <input
              value={chapterName}
              onChange={(e) => setChapterName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2"
            />
          </label>
          <button
            disabled={!fraternity || !school || !chapterName}
            onClick={() => setStep(2)}
            className="rounded-full bg-accent px-6 py-2 text-accent-fg disabled:opacity-50"
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
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-sm text-muted-foreground">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2"
            />
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="text-muted-foreground underline">Back</button>
            <button
              disabled={!adminName || !email || sending}
              onClick={sendMagicLink}
              className="rounded-full bg-accent px-6 py-2 text-accent-fg disabled:opacity-50"
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
