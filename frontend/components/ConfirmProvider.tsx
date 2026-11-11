"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Button } from "@/ui/components/Button";

/**
 * An in-app replacement for window.confirm().
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: "Delete this event?", destructive: true }))) return;
 *
 * The native dialog looked out of place next to the app's own modals, could not
 * say which button was the dangerous one, and on some phones showed the site's
 * URL as its title. Focus starts on Cancel, so a stray Enter does not delete.
 */
export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button as destructive. */
  destructive?: boolean;
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

const ConfirmCtx = createContext<((o: ConfirmOptions) => Promise<boolean>) | null>(null);

export function useConfirm() {
  const ctx = useContext(ConfirmCtx);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}

export default function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setPending({ ...opts, resolve });
      }),
    [],
  );

  const close = useCallback(
    (ok: boolean) => {
      pending?.resolve(ok);
      setPending(null);
    },
    [pending],
  );

  useEffect(() => {
    if (!pending) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, close]);

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close(false);
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby={pending.description ? "confirm-description" : undefined}
            className="w-full max-w-md rounded-lg border border-solid border-neutral-border bg-default-background p-6 shadow-lg"
          >
            <h2 id="confirm-title" className="text-heading-3 font-heading-3 text-default-font">
              {pending.title}
            </h2>
            {pending.description && (
              <p id="confirm-description" className="mt-2 whitespace-pre-line text-body font-body text-subtext-color">
                {pending.description}
              </p>
            )}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button ref={cancelRef} variant="neutral-secondary" onClick={() => close(false)}>
                {pending.cancelLabel || "Cancel"}
              </Button>
              <Button
                variant={pending.destructive ? "destructive-primary" : "brand-primary"}
                onClick={() => close(true)}
              >
                {pending.confirmLabel || "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}
