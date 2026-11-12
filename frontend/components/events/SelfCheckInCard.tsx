"use client";

import { useEffect, useState } from "react";
import { api, API_BASE } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { useToast } from "@/components/ToastProvider";

/**
 * The event's self check-in code: a QR to put on a poster or a screen at the
 * door. A PNM scans it, types the email he signed up with, and is checked in,
 * so one brother with a scanner is no longer the queue.
 */
export function SelfCheckInCard({ eventId }: { eventId: string }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<{ url: string; code: string } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [big, setBig] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open || link) return;
    let objectUrl: string | null = null;
    let live = true;
    (async () => {
      try {
        const info = await api<{ url: string; code: string }>(`/events/${eventId}/self-check-in`);
        const token = await getAccessToken();
        const res = await fetch(`${API_BASE}/events/${eventId}/self-check-in/qr.png`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`QR ${res.status}`);
        objectUrl = URL.createObjectURL(await res.blob());
        if (!live) return;
        setLink(info);
        setQr(objectUrl);
      } catch {
        if (live) setFailed(true);
      }
    })();
    return () => {
      live = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, eventId]);

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      toast({ title: "Link copied" });
    } catch {
      toast({ title: "Could not copy", description: link.url });
    }
  };

  return (
    <div className="rounded-xl border border-beta-gray/30 bg-white p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-left touch:min-h-[44px]"
      >
        <span>
          <span className="block text-sm font-semibold text-beta-navy">Let PNMs check themselves in</span>
          <span className="block text-xs text-beta-gray">
            Show this QR code at the door. They scan it and enter their email.
          </span>
        </span>
        <span className="text-sm font-medium text-beta-navy">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="mt-4 flex flex-col items-center gap-3">
          {failed ? (
            <p className="text-sm text-red-700">Could not load the check-in code. Reload the page to try again.</p>
          ) : !qr || !link ? (
            <p className="text-sm text-beta-gray">Loading…</p>
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="QR code PNMs scan to check themselves in" className="h-56 w-56" />
              <p className="break-all text-center text-xs text-beta-gray">{link.url}</p>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setBig(true)}
                  className="h-10 touch:h-11 rounded-lg bg-beta-navy px-4 text-sm font-medium text-white"
                >
                  Show full screen
                </button>
                <button
                  type="button"
                  onClick={copy}
                  className="h-10 touch:h-11 rounded-lg border border-beta-gray/60 px-4 text-sm font-medium text-beta-navy"
                >
                  Copy link
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {big && qr && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Self check-in QR code"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-white p-6"
        >
          <p className="text-center text-3xl font-bold text-beta-navy">Scan to check in</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR code PNMs scan to check themselves in" className="h-[60vmin] w-[60vmin]" />
          <button
            type="button"
            onClick={() => setBig(false)}
            className="h-11 rounded-lg border border-beta-gray/60 px-6 text-sm font-medium text-beta-navy"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
