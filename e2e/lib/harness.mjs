/**
 * Shared Playwright harness for the local end-to-end run.
 *
 * The one non-obvious piece is authentication. lib/auth.ts reads the access
 * token from `supabase.auth.getSession()`, not from a localStorage key of our
 * own, so the harness writes a session into the key supabase-js reads
 * (`sb-<ref>-auth-token`, derived from the project URL's first hostname label)
 * before any page script runs. The token itself is HS256, signed with the same
 * SUPABASE_JWT_SECRET the backend verifies against, so no Supabase round trip
 * happens anywhere -- which is what makes it safe to run thirty of these at
 * once against a local database.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, "..");
export const APP = process.env.E2E_APP_URL || "http://localhost:3000";
export const API = process.env.E2E_API_URL || "http://localhost:8000";

// Matches lib/supabaseClient.ts's URL, whose first hostname label is the ref.
const SUPABASE_REF = "e2elocal";
const STORAGE_KEY = `sb-${SUPABASE_REF}-auth-token`;

export function fixtures() {
  return JSON.parse(readFileSync(join(ROOT, "fixtures.json"), "utf8"));
}

/**
 * Make every page in this context load already signed in as `user`.
 * addInitScript runs before the page's own scripts, so the Supabase client
 * finds the session on construction rather than racing it.
 */
export async function signIn(context, user, { chapterId } = {}) {
  const session = {
    access_token: user.token,
    token_type: "bearer",
    expires_in: 43200,
    expires_at: Math.floor(Date.now() / 1000) + 43200,
    refresh_token: `e2e-refresh-${user.id}`,
    user: {
      id: user.id,
      aud: "authenticated",
      role: "authenticated",
      email: user.email,
      app_metadata: { provider: "email" },
      user_metadata: { name: user.name },
      created_at: new Date().toISOString(),
    },
  };

  await context.addInitScript(
    ([key, value, chapter, name, email]) => {
      try {
        window.localStorage.setItem(key, value);
        // api.ts caches the chapter id with a 24h TTL; seeding it skips a
        // lookup on every page and keeps the crawler off the chapter picker.
        if (chapter) {
          window.localStorage.setItem(
            "rushapp_chapter_id",
            JSON.stringify({ chapterId: chapter, timestamp: Date.now() })
          );
        }
        if (name) window.localStorage.setItem("user_name", name);
        if (email) window.localStorage.setItem("user_email", email);
      } catch {
        /* storage unavailable */
      }
    },
    [STORAGE_KEY, JSON.stringify(session), chapterId || null, user.name, user.email]
  );
}

/**
 * Attach console / pageerror / failed-response collectors to a page.
 * Returns the array they append to, so a test can assert on it directly.
 */
export function watch(page, sink = [], label = "") {
  const tag = label ? `[${label}] ` : "";
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const t = msg.text();
      // Chrome logs a generic console error for every failed request; the
      // response handler below already records those with real detail.
      if (/Failed to load resource/i.test(t)) return;
      sink.push({ kind: "console", where: page.url(), text: tag + t });
    }
  });
  page.on("pageerror", (err) =>
    sink.push({ kind: "pageerror", where: page.url(), text: tag + (err?.message || String(err)) })
  );
  page.on("requestfailed", (req) => {
    const f = req.failure()?.errorText || "";
    if (/ERR_ABORTED|NS_BINDING_ABORTED/i.test(f)) return; // navigation cancels
    sink.push({ kind: "requestfailed", where: page.url(), text: `${tag}${req.method()} ${req.url()} :: ${f}` });
  });
  page.on("response", (res) => {
    if (res.status() >= 400) {
      sink.push({
        kind: `http${res.status()}`,
        where: page.url(),
        text: `${tag}${res.request().method()} ${res.url()} -> ${res.status()}`,
      });
    }
  });
  return sink;
}

/** Routes worth visiting, with the ones needing an id filled in by the caller. */
export function routes(fx) {
  const pnm = fx.roster[0]?.id;
  const ev = fx.event?.id;
  const round = fx.endedRound?.id;
  return [
    { path: "/dashboard", name: "dashboard" },
    { path: "/pnms", name: "pnms" },
    { path: pnm ? `/pnms/${pnm}` : null, name: "pnm-detail" },
    { path: "/pnms/import", name: "pnms-import" },
    { path: "/voting", name: "voting" },
    { path: round ? `/results?roundId=${round}` : "/results", name: "results" },
    { path: "/compare", name: "compare" },
    { path: "/analytics", name: "analytics" },
    { path: "/events", name: "events" },
    { path: ev ? `/events/${ev}/checkin` : null, name: "event-checkin" },
    { path: "/exports", name: "exports" },
    { path: "/bid-list", name: "bid-list" },
    { path: "/rush", name: "rush" },
    { path: "/pipeline", name: "pipeline" },
    { path: "/admin/users", name: "admin-users" },
    { path: "/admin/tags", name: "admin-tags" },
    { path: "/admin/audit", name: "admin-audit" },
    { path: "/admin/duplicates", name: "admin-duplicates" },
    { path: "/settings", name: "settings" },
    { path: "/profile", name: "profile" },
  ].filter((r) => r.path);
}

/** Public routes, visited signed-out. */
export function publicRoutes(fx) {
  return [
    { path: "/", name: "landing" },
    { path: "/login", name: "login" },
    { path: `/intake?chapter=${fx.chapter.id}`, name: "intake" },
    { path: `/interest?chapter=${fx.chapter.id}`, name: "interest" },
    { path: "/get-started", name: "get-started" },
    { path: "/demo", name: "demo" },
  ];
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Wait for the app shell to settle without failing the run on a slow network. */
export async function settle(page, ms = 1200) {
  try {
    await page.waitForLoadState("networkidle", { timeout: 8000 });
  } catch {
    /* some pages poll, so networkidle never arrives */
  }
  await sleep(ms);
}
