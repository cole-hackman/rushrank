"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";

type Preview = {
  recipients: number;
  without_email: number;
  not_found: number;
  email_configured: boolean;
  emails: string[];
};

// Mail apps refuse very long mailto links; past this the list is copied instead.
const MAILTO_LIMIT = 1800;

/**
 * One message to a set of PNMs: "Sports night, Thursday 7pm".
 *
 * If the server can send email it sends one message per PNM, so nobody sees
 * anybody else's address. If it cannot, the same list is handed to the
 * sender's own mail app as blind copies, which works with no setup at all.
 */
export function EmailPnmsModal({
  chapterId,
  pnmIds,
  onClose,
}: {
  chapterId: string;
  pnmIds: string[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Preview>(`/chapters/${chapterId}/pnm-messages`, {
      method: "POST",
      body: { pnm_ids: pnmIds, dry_run: true },
    })
      .then(setPreview)
      .catch((e: any) => setError(e?.message || "Could not load the recipients"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ready = subject.trim() && message.trim();
  const mailto = preview
    ? `mailto:?bcc=${encodeURIComponent(preview.emails.join(","))}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`
    : "";
  const mailtoFits = mailto.length <= MAILTO_LIMIT;

  const send = async () => {
    setBusy(true);
    try {
      const res = await api<{ sent: number; failed: number }>(`/chapters/${chapterId}/pnm-messages`, {
        method: "POST",
        body: { pnm_ids: pnmIds, subject: subject.trim(), message: message.trim() },
      });
      toast({
        title: `Sent to ${res.sent} PNM${res.sent === 1 ? "" : "s"}`,
        description: res.failed ? `${res.failed} could not be delivered.` : undefined,
      });
      onClose();
    } catch (e: any) {
      toast({ title: "The message was not sent", description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!preview) return;
    try {
      await navigator.clipboard.writeText(preview.emails.join(", "));
      toast({ title: `${preview.emails.length} address${preview.emails.length === 1 ? "" : "es"} copied`, description: "Paste them into the Bcc line." });
    } catch {
      toast({ title: "Could not copy the addresses" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-pnms-title"
        className="flex max-h-[90vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-lg bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 id="email-pnms-title" className="text-heading-2 font-heading-2 text-default-font">
            Email PNMs
          </h2>
          <p className="mt-1 text-body font-body text-subtext-color">
            {error
              ? error
              : !preview
                ? "Finding email addresses…"
                : `${preview.recipients} of the ${pnmIds.length} selected will get this.` +
                  (preview.without_email ? ` ${preview.without_email} have no email on file.` : "")}
          </p>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-caption-bold font-caption-bold text-default-font">Subject</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={200}
            placeholder="Sports night, Thursday 7pm"
            className="h-10 touch:h-11 rounded-md border border-solid border-neutral-border px-3 text-body font-body text-default-font"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-caption-bold font-caption-bold text-default-font">Message</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={5000}
            rows={6}
            className="rounded-md border border-solid border-neutral-border px-3 py-2 text-body font-body text-default-font"
          />
        </label>

        {preview && preview.recipients > 0 && (
          <div className="flex flex-col gap-2">
            {preview.email_configured ? (
              <button
                type="button"
                disabled={busy || !ready}
                onClick={send}
                className="h-10 touch:h-11 rounded-md bg-brand-600 px-4 text-body-bold font-body-bold text-white disabled:opacity-50"
              >
                {busy ? "Sending…" : `Send to ${preview.recipients}`}
              </button>
            ) : (
              <p className="text-caption font-caption text-subtext-color">
                RushRank is not set up to send email from this server, so the message opens in your own
                mail app with everyone as a blind copy.
              </p>
            )}
            {mailtoFits ? (
              <a
                href={mailto}
                className="flex h-10 touch:h-11 items-center justify-center rounded-md border border-solid border-neutral-border px-4 text-body-bold font-body-bold text-default-font"
              >
                Open in my mail app
              </a>
            ) : (
              <p className="text-caption font-caption text-subtext-color">
                That is too many addresses for a mail link. Copy them and paste into the Bcc line.
              </p>
            )}
            <button
              type="button"
              onClick={copy}
              className="h-10 touch:h-11 rounded-md border border-solid border-neutral-border px-4 text-body-bold font-body-bold text-default-font"
            >
              Copy the addresses
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="h-10 touch:h-11 self-end rounded-md px-4 text-body-bold font-body-bold text-subtext-color"
        >
          Close
        </button>
      </div>
    </div>
  );
}
