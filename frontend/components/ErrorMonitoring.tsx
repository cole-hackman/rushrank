"use client";

import { useEffect } from "react";

/**
 * Sends uncaught browser errors to Sentry when NEXT_PUBLIC_SENTRY_DSN is set.
 *
 * The SDK is imported only when a DSN exists, and only after the page has
 * hydrated, so a deployment without monitoring ships none of it and one with
 * monitoring does not delay first paint.
 *
 * No personal data is attached: no IP address, no request bodies, no user
 * identity. A crash report says which page broke and why, not who was on it.
 */
const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

let started = false;

export function ErrorMonitoring() {
  useEffect(() => {
    if (!DSN || started) return;
    started = true;
    import("@sentry/react")
      .then((Sentry) => {
        Sentry.init({
          dsn: DSN,
          environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || "production",
          sendDefaultPii: false,
          // Errors only. Tracing and replay are separate decisions.
          tracesSampleRate: 0,
        });
      })
      .catch(() => {
        // Monitoring must never break the app.
      });
  }, []);
  return null;
}
