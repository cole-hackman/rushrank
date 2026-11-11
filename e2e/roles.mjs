/**
 * Every page, as every kind of user.
 *
 * crawl.mjs and visual.mjs load all 26 pages, but only as the admin. This
 * script loads each one signed out, as a member, as an exec and as the admin,
 * and checks the gate that should apply:
 *
 *   signed out -> every dashboard page redirects to /login?next=<path>;
 *                 every public page renders
 *   member     -> admin pages (settings, admin/*, bid-list) bounce to
 *                 /dashboard; everything else renders with no 5xx
 *   exec       -> AdminProtected lets exec in; any 403 the page then gets from
 *                 the API is recorded (the backend treats most of those
 *                 routes as admin-only)
 *   admin      -> everything renders, no 4xx/5xx at load
 *
 * It also checks the navigation each role is offered, and the one flow that
 * is known to be broken for members (the Open Voting tab).
 *
 *   node roles.mjs
 *
 * WRITES: almost nothing. Loading pages is read-only; the Open Voting check
 * as a member issues one POST that the server rejects. It still runs behind
 * the guard because it signs in with fixture tokens.
 * Exit code: 0 = nothing new, 1 = at least one new finding, 2 = guard refused.
 */

import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fixtures, signIn, watch, settle, routes, publicRoutes, APP, ROOT } from "./lib/harness.mjs";
import { guard } from "./guard.mjs";

await guard();

const fx = fixtures();
const users = {
  admin: fx.users.find((u) => u.role === "admin"),
  exec: fx.users.find((u) => u.role === "exec"),
  member: fx.users.find((u) => u.role === "member"),
};

const ADMIN_ONLY = new Set(["settings", "admin-users", "admin-tags", "admin-audit", "admin-duplicates", "bid-list"]);
// Pages a member can open whose load calls an admin-only endpoint.
const EXPECTED_403 = {
  member: { analytics: /voting-patterns/ },
  exec: {
    analytics: /voting-patterns/,
    "admin-users": /memberships/,
    "admin-duplicates": /duplicates/,
  },
};

const findings = [];
const matrix = [];
const note = (severity, title, detail) => {
  findings.push({ severity, title, detail });
  console.log(`  [${severity}] ${title}\n        ${detail}`);
};

const browser = await chromium.launch();
const authed = routes(fx);
const pub = publicRoutes(fx);

async function visit(context, route, role) {
  const sink = [];
  const page = await context.newPage();
  watch(page, sink, `${role}:${route.name}`);
  let navError = null;
  try {
    await page.goto(`${APP}${route.path}`, { waitUntil: "domcontentloaded", timeout: 20000 });
  } catch (e) {
    navError = String(e.message || e).split("\n")[0];
  }
  await settle(page, 1500);
  const url = new URL(page.url());
  const bodyText = ((await page.locator("body").innerText().catch(() => "")) || "").trim();
  const http = sink.filter((e) => /^http\d+/.test(e.kind));
  const row = {
    role,
    route: route.name,
    path: route.path,
    landed: url.pathname + url.search,
    bodyChars: bodyText.length,
    accessDenied: /Access Denied/i.test(bodyText),
    http4xx: http.filter((e) => /^http4/.test(e.kind)).map((e) => e.text.replace(/^\[[^\]]*\]\s*/, "")),
    http5xx: http.filter((e) => /^http5/.test(e.kind)).map((e) => e.text.replace(/^\[[^\]]*\]\s*/, "")),
    pageErrors: sink.filter((e) => e.kind === "pageerror").map((e) => e.text),
    navError,
  };
  await page.close();
  matrix.push(row);
  return row;
}

// ------------------------------------------------------------------ signed out
console.log("\n--- signed out ---");
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  for (const r of authed) {
    const row = await visit(ctx, r, "signed-out");
    const bounced = row.landed.startsWith("/login");
    const wantNext = encodeURIComponent(r.path.split("?")[0]);
    if (!bounced) note("blocker", `Signed-out user can open ${r.path}`, `landed on ${row.landed}`);
    else if (!row.landed.includes("next=")) note("medium", `Login redirect from ${r.path} has no next=`, `landed on ${row.landed}`);
    else if (!decodeURIComponent(row.landed).includes(r.path.split("?")[0])) {
      note("medium", `Login redirect from ${r.path} points somewhere else`, `landed on ${row.landed} (wanted next=${wantNext})`);
    }
  }
  for (const r of pub) {
    const row = await visit(ctx, r, "signed-out");
    if (row.landed.startsWith("/login") && r.name !== "login") note("high", `Public page ${r.path} redirects to login`, row.landed);
    // /login is a small card, so the floor here is lower than for app pages.
    if (row.bodyChars < 40) note("high", `Public page ${r.path} rendered almost nothing`, `${row.bodyChars} characters`);
    if (row.http5xx.length) note("high", `Public page ${r.path} got a 5xx`, row.http5xx[0]);
    // /demo returns 404 from the API unless DEMO_USER_* is configured; that is expected here.
    const real4xx = row.http4xx.filter((t) => !(r.name === "demo" && /demo-session/.test(t)));
    if (real4xx.length) note("medium", `Public page ${r.path} got a 4xx at load`, real4xx[0]);
  }
  // The public forms need ?chapter=; without it they should say so, not crash.
  for (const p of ["/intake", "/interest"]) {
    const row = await visit(ctx, { path: p, name: `${p.slice(1)}-no-chapter` }, "signed-out");
    if (row.pageErrors.length) note("high", `${p} without ?chapter= throws`, row.pageErrors[0]);
  }
  await ctx.close();
}

// ------------------------------------------------------------ signed-in roles
for (const role of ["member", "exec", "admin"]) {
  console.log(`\n--- ${role} (${users[role].email}) ---`);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await signIn(ctx, users[role], { chapterId: fx.chapter.id });

  for (const r of authed) {
    const row = await visit(ctx, r, role);
    const here = row.landed.split("?")[0];
    const stayed = here === r.path.split("?")[0];

    if (row.landed.startsWith("/login")) {
      note("blocker", `${role} was bounced to login from ${r.path}`, row.landed);
      continue;
    }
    if (row.pageErrors.length) note("high", `${role}: ${r.path} threw in the browser`, row.pageErrors[0]);
    if (row.http5xx.length) note("high", `${role}: ${r.path} got a 5xx at load`, row.http5xx[0]);

    if (ADMIN_ONLY.has(r.name)) {
      if (role === "member") {
        if (stayed) note("blocker", `A member can open admin page ${r.path}`, "expected a redirect to /dashboard");
        else if (here !== "/dashboard") note("medium", `Member redirect from ${r.path} went to ${row.landed}`, "expected /dashboard");
      } else if (!stayed) {
        note("high", `${role} was redirected away from ${r.path}`, `landed on ${row.landed}`);
      }
    } else if (!stayed) {
      note("high", `${role} was redirected away from ${r.path}`, `landed on ${row.landed}`);
    } else if (row.bodyChars < 120) {
      note("high", `${role}: ${r.path} rendered almost nothing`, `${row.bodyChars} characters`);
    }

    // 4xx at load. A member being refused on an admin page they are being
    // redirected away from is fine; anything else is worth reading.
    const allowed = EXPECTED_403[role]?.[r.name];
    const unexpected = row.http4xx.filter((t) => {
      if (role === "member" && ADMIN_ONLY.has(r.name)) return false;
      if (allowed && allowed.test(t) && /-> 403/.test(t)) return false;
      if (/pnm-card|share-card|\/qr/.test(t)) return false; // Supabase Storage, not reachable locally
      return true;
    });
    if (role === "exec" && ADMIN_ONLY.has(r.name) && row.http4xx.some((t) => /-> 403/.test(t))) {
      note("medium", `exec can open ${r.path} but its API refuses them (known)`,
        row.http4xx.filter((t) => /-> 403/.test(t)).slice(0, 2).join(" | "));
    } else if (unexpected.length) {
      note(role === "admin" ? "high" : "medium", `${role}: ${r.path} got a 4xx at load`, unexpected.slice(0, 2).join(" | "));
    }
  }

  // Navigation offered to this role (desktop top bar).
  const page = await ctx.newPage();
  await page.goto(`${APP}/dashboard`, { waitUntil: "domcontentloaded" });
  await settle(page, 1500);
  const adminMenu = await page.getByText("Admin", { exact: true }).first().isVisible().catch(() => false);
  if (role === "admin" && !adminMenu) note("high", "Admin does not see the Admin menu", "");
  if (role === "member" && adminMenu) note("high", "A member sees the Admin menu", "");
  if (role === "exec" && !adminMenu) {
    note("medium", "exec has no Admin menu, so no link to the bid list they are allowed to use (known)",
      "layout.tsx shows the menu for role admin only; AdminProtected and the bid-list API both admit exec.");
  }
  await page.close();

  // Roster: Compare is reachable from the multi-select, and the PowerPoint
  // export is offered only to the roles the backend allows (admin, exec).
  {
    const p = await ctx.newPage();
    await p.goto(`${APP}/pnms`, { waitUntil: "domcontentloaded" });
    await settle(p, 1500);
    const deck = await p.getByRole("button", { name: /Export → PowerPoint/ }).isVisible().catch(() => false);
    if (role === "member" && deck) note("medium", "A member is offered the PowerPoint export, which the API refuses", "");
    if (role !== "member" && !deck) note("medium", `${role} is not offered the PowerPoint export`, "the API allows admin and exec");

    const boxes = p.locator('table tbody input[type="checkbox"]');
    if ((await boxes.count()) >= 2) {
      await boxes.nth(0).check().catch(() => {});
      await boxes.nth(1).check().catch(() => {});
      const compare = p.getByRole("button", { name: /^Compare \(2\)$/ });
      if (await compare.isEnabled().catch(() => false)) {
        await compare.click();
        await p.waitForURL(/\/compare\?ids=/, { timeout: 8000 }).catch(() => {});
        if (!/\/compare\?ids=[^,]+,[^,]+/.test(p.url())) {
          note("high", `${role}: Compare did not open /compare with the two ticked PNMs`, p.url());
        }
      } else {
        note("high", `${role}: no enabled Compare button after ticking two rows`, "");
      }
    }
    await p.close();
  }

  // Mobile: is Results reachable?
  if (role === "member") {
    const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await signIn(m, users[role], { chapterId: fx.chapter.id });
    const mp = await m.newPage();
    await mp.goto(`${APP}/dashboard`, { waitUntil: "domcontentloaded" });
    await settle(mp, 1500);
    const visibleResults = await mp.locator('a[href="/results"]:visible').count().catch(() => 0);
    if (visibleResults === 0) {
      note("medium", "No visible link to Results on a phone (known)",
        "bottom nav has Home, Rush, PNMs, Voting, Events; the hamburger list omits Results too.");
    }
    await m.close();
  }

  // Open Voting as a member. The tab used to call the admin-only
  // POST /rounds/open on load and fail; it now only reads.
  if (role === "member") {
    const p = await ctx.newPage();
    const sink = watch(p, [], "member:open-voting");
    await p.goto(`${APP}/voting`, { waitUntil: "domcontentloaded" });
    await settle(p, 1200);
    const startVisible = await p.getByRole("button", { name: /^Start Session$/i }).isVisible().catch(() => false);
    if (startVisible) {
      note("low", "Members are shown Start Session, which the API refuses (known)", "voting/page.tsx renders the form for everyone.");
    }
    await p.getByText("Open Voting", { exact: true }).first().click().catch(() => {});
    await settle(p, 2000);
    const refused = sink.some((e) => e.kind === "http403" && /rounds\/open/.test(e.text));
    const body = (await p.locator("body").innerText().catch(() => "")) || "";
    const usable = /No open round right now|All caught up/.test(body) ||
      (await p.getByRole("button", { name: "Yes", exact: true }).first().isVisible().catch(() => false));
    if (refused) {
      note("high", "Open Voting still calls an admin-only endpoint for members", "a 403 from /rounds/open on the Open Voting tab");
    } else if (!usable) {
      note("high", "Open Voting shows a member neither a card nor a no-round message", body.slice(0, 160).replace(/\s+/g, " "));
    }
    await p.close();
  }

  await ctx.close();
}

await browser.close();

writeFileSync(join(ROOT, "report-roles.json"), JSON.stringify({ script: "roles", findings, matrix }, null, 2));

const fresh = findings.filter((f) => !/\(known\)$/.test(f.title) && f.severity !== "low");
console.log(`\n=== ${matrix.length} page loads, ${findings.length} finding(s), ${fresh.length} new ===`);
console.log("report: e2e/report-roles.json");
process.exit(fresh.length ? 1 : 0);
