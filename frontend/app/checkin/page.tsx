"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_BASE } from "@/lib/api";

/**
 * Public check-in page.
 *
 *   /checkin?e=<event>&c=<code>   a PNM checking himself in from the event's QR
 *   /checkin?p=<pnm>              the QR in a PNM's own email, which a brother
 *                                 scans with the in-app scanner. Opened in a
 *                                 phone camera it used to be a 404.
 */

type EventInfo = { event_name: string; chapter_name: string; chapter_id: string };
type Result =
  | { kind: "done"; firstName: string; already: boolean }
  | { kind: "unknown" }
  | { kind: "error"; message: string };

export default function CheckInPage() {
  const [params, setParams] = useState<{ e: string | null; c: string | null; p: string | null } | null>(null);
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setParams({ e: q.get("e"), c: q.get("c"), p: q.get("p") });
  }, []);

  useEffect(() => {
    if (!params?.e || !params.c) return;
    fetch(`${API_BASE}/public/events/${encodeURIComponent(params.e)}?code=${encodeURIComponent(params.c)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error();
        setEvent(await res.json());
      })
      .catch(() => setInvalid(true));
  }, [params]);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!params?.e || !params.c || !email.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/public/events/${encodeURIComponent(params.e)}/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: params.c, email: email.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setResult({ kind: "done", firstName: body.first_name || "", already: body.status === "already_checked_in" });
      } else if (res.status === 404 && body.detail === "not_on_roster") {
        setResult({ kind: "unknown" });
      } else if (res.status === 429) {
        setResult({ kind: "error", message: "Lots of people are checking in right now. Wait a few seconds and try again." });
      } else if (res.status === 404) {
        setInvalid(true);
      } else {
        setResult({ kind: "error", message: "That did not work. Check your email address and try again." });
      }
    } catch {
      setResult({ kind: "error", message: "No connection. Try again, or ask a brother to check you in." });
    } finally {
      setBusy(false);
    }
  };

  const shell = (children: React.ReactNode) => (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">{children}</div>
    </main>
  );

  if (!params) return shell(<p className="text-center text-neutral-600">Loading…</p>);

  // A PNM opened the QR code from his own email.
  if (params.p && !params.e) {
    return shell(
      <div className="text-center">
        <h1 className="text-2xl font-bold text-neutral-900">This is your check-in code</h1>
        <p className="mt-3 text-neutral-600">
          Show the QR code from your email to a brother at the door and he will scan it. If the event has a
          check-in poster, scan that with your camera instead.
        </p>
      </div>,
    );
  }

  if (!params.e || !params.c || invalid) {
    return shell(
      <div className="text-center">
        <h1 className="text-2xl font-bold text-neutral-900">This check-in link is not valid</h1>
        <p className="mt-3 text-neutral-600">
          Scan the QR code at the event again, or ask a brother to check you in.
        </p>
      </div>,
    );
  }

  if (!event) return shell(<p className="text-center text-neutral-600">Loading…</p>);

  if (result?.kind === "done") {
    return shell(
      <div className="text-center" role="status">
        <h1 className="text-3xl font-bold text-neutral-900">
          {result.already ? "You are already checked in" : "You are checked in"}
          {result.firstName ? `, ${result.firstName}` : ""}
        </h1>
        <p className="mt-3 text-neutral-600">
          {event.event_name} · {event.chapter_name}
        </p>
      </div>,
    );
  }

  return shell(
    <form onSubmit={submit} className="space-y-4">
      <div>
        <p className="text-sm font-medium text-neutral-500">{event.chapter_name}</p>
        <h1 className="text-2xl font-bold text-neutral-900">Check in to {event.event_name}</h1>
      </div>
      <label className="block">
        <span className="text-sm font-medium text-neutral-700">The email you signed up with</span>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 h-12 w-full rounded-lg border border-neutral-300 px-3 text-base text-neutral-900"
        />
      </label>
      <button
        type="submit"
        disabled={busy || !email.trim()}
        className="h-12 w-full rounded-lg bg-neutral-900 text-base font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Checking in…" : "Check in"}
      </button>
      <div aria-live="polite">
        {result?.kind === "unknown" && (
          <p className="text-sm text-neutral-700">
            We could not find that email on the list.{" "}
            <Link className="font-semibold underline" href={`/intake?chapter=${event.chapter_id}`}>
              Sign up here
            </Link>
            , or ask a brother to check you in.
          </p>
        )}
        {result?.kind === "error" && <p className="text-sm text-red-700">{result.message}</p>}
      </div>
    </form>,
  );
}
