"use client";

/**
 * The link in the chapter's Instagram bio.
 *
 * Someone DMs the chapter account in July asking about rush. Today that
 * conversation lives in an inbox one person has the password to, and by August
 * nobody remembers the name. A brother replies with this link instead, and the
 * person lands in the pipeline with a source and a timestamp.
 *
 * Deliberately not `/intake`. That form is two steps with a photo upload and a
 * questionnaire, which is right when a brother hands over a phone at a rush
 * table and wrong for a stranger tapping a bio link — they will not finish it.
 * Name plus one way to reach them is the whole ask; everything else is
 * optional and can be filled in later by whoever picks them up.
 */

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, submitInterest, SOURCE_LABELS } from "@/lib/api";

function InterestForm() {
  const searchParams = useSearchParams();
  const chapterId = searchParams?.get("chapter") ?? null;
  const source = searchParams?.get("source") ?? "interest_form";

  const [chapterName, setChapterName] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [name, setName] = useState("");
  const [instagram, setInstagram] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [year, setYear] = useState("");
  const [major, setMajor] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!chapterId) {
      setNotFound(true);
      return;
    }
    (async () => {
      try {
        const chapter = await api<{ id: string; name: string }>(`/public/chapters/${chapterId}`);
        setChapterName(chapter.name);
      } catch {
        setNotFound(true);
      }
    })();
  }, [chapterId]);

  // One contact method is the real requirement. Which one is up to them — a lot
  // of people will give a handle and not an email, and that is fine.
  const reachable = Boolean(instagram.trim() || email.trim() || phone.trim());
  const canSubmit = Boolean(name.trim()) && reachable && !submitting;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chapterId || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitInterest(chapterId, source, {
        name: name.trim(),
        instagram_handle: instagram.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        year: year.trim() || undefined,
        major: major.trim() || undefined,
      });
      setDone(true);
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  };

  if (notFound) {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold text-fg">This link isn&apos;t valid</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ask the chapter for a new one — links are specific to each chapter.
        </p>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-100 text-3xl">
          👊
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-fg">You&apos;re on the list</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {chapterName ? `Someone from ${chapterName}` : "Someone from the chapter"} will reach out
          before rush starts. Keep an eye on your DMs.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {chapterName ?? "Loading…"}
      </p>
      <h1 className="mt-1 text-2xl font-semibold text-fg">Interested in rush?</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Drop your info and someone will get in touch. Takes about fifteen seconds.
      </p>

      <form onSubmit={submit} className="mt-6 flex flex-col gap-4 text-left">
        <Field label="Your name" required>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            placeholder="Jordan Miller"
          />
        </Field>

        <Field label="Instagram" hint="However you found us is usually the easiest way to reply">
          <div className="flex items-center rounded-lg border border-border bg-surface focus-within:ring-2 focus-within:ring-accent-hex">
            <span className="pl-3 text-muted-foreground">@</span>
            <input
              className="h-11 w-full bg-transparent px-2 text-base text-fg outline-none"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="jordanmiller"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Email">
            <input
              className={inputClass}
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="jordan@school.edu"
            />
          </Field>
          <Field label="Phone">
            <input
              className={inputClass}
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              placeholder="(555) 010-0000"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Year">
            <select className={inputClass} value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="">Select…</option>
              {["Freshman", "Sophomore", "Junior", "Senior"].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </Field>
          <Field label="Major">
            <input
              className={inputClass}
              value={major}
              onChange={(e) => setMajor(e.target.value)}
              placeholder="Undeclared is fine"
            />
          </Field>
        </div>

        {!reachable && name.trim() && (
          <p className="text-sm text-muted-foreground">
            Add at least one of Instagram, email or phone so we can reach you.
          </p>
        )}

        {error && (
          <p className="rounded-lg border border-error-200 bg-error-50 p-3 text-sm text-error-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-2 h-12 rounded-full bg-accent text-base font-medium text-accent-foreground disabled:opacity-40"
        >
          {submitting ? "Sending…" : "Count me in"}
        </button>

        <p className="text-center text-xs text-muted-foreground">
          Shared with {chapterName ?? "this chapter"} only.
          {source !== "interest_form" && ` · via ${SOURCE_LABELS[source] ?? source}`}
        </p>
      </form>
    </Shell>
  );
}

const inputClass =
  "h-11 w-full rounded-lg border border-border bg-surface px-3 text-base text-fg outline-none focus:ring-2 focus:ring-accent-hex";

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-fg">
        {label}
        {required && <span className="text-danger"> *</span>}
      </span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-5 py-10">
      <div className="w-full max-w-md text-center">{children}</div>
    </main>
  );
}

export default function InterestPage() {
  // useSearchParams needs a Suspense boundary for static prerendering, the same
  // pattern as app/login and app/intake.
  return (
    <Suspense fallback={<Shell><p className="text-sm text-muted-foreground">Loading…</p></Shell>}>
      <InterestForm />
    </Suspense>
  );
}
