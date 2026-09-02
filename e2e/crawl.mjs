/**
 * Visit every page and press every control.
 *
 * Each control is clicked from a freshly loaded page, so one click cannot
 * poison the next, and the page is re-enumerated each time because a click may
 * have opened a dialog or swapped a tab. That costs a page load per control and
 * is slow, but the alternative -- clicking down a stale element list -- reports
 * failures that are really just detached nodes.
 *
 * Destructive controls are catalogued and skipped rather than pressed blind;
 * they get their own deliberate pass so a delete cannot empty the fixture
 * halfway through and make every later page look "empty" for the wrong reason.
 *
 *   node crawl.mjs
 */

import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fixtures, signIn, watch, settle, sleep, routes, publicRoutes, APP, ROOT } from "./lib/harness.mjs";

const DESTRUCTIVE = /delete|remove|archive|revoke|end session|sign out|log out|reset|clear all|merge|finalize|unlink|discard/i;
const NAV_AWAY = /sign out|log out/i;
const MAX_PER_PAGE = 45;

const fx = fixtures();
const chair = fx.users.find((u) => u.role === "admin");

const errors = [];
const findings = [];
const pageReports = [];
const note = (severity, page, title, detail) => {
  findings.push({ severity, page, title, detail });
  console.log(`   [${severity}] ${title} :: ${detail}`);
};

const browser = await chromium.launch();

/** Stable, human-readable description of a control. */
async function inventory(page) {
  return page.evaluate((max) => {
    const sel = 'button, a[href], [role="button"], [role="tab"], input[type="checkbox"], input[type="radio"], select, summary';
    const seen = [];
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width === 0 || r.height === 0) continue;
      if (cs.visibility === "hidden" || cs.display === "none" || cs.opacity === "0") continue;
      const label =
        (el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || el.getAttribute("name") || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 60);
      seen.push({
        tag: el.tagName.toLowerCase(),
        label: label || `(${el.tagName.toLowerCase()} no label)`,
        href: el.getAttribute("href") || null,
        disabled: !!el.disabled,
      });
      if (seen.length >= max) break;
    }
    return seen;
  }, MAX_PER_PAGE);
}

async function clickNth(page, n) {
  return page.evaluate((idx) => {
    const sel = 'button, a[href], [role="button"], [role="tab"], input[type="checkbox"], input[type="radio"], select, summary';
    const vis = [];
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width === 0 || r.height === 0) continue;
      if (cs.visibility === "hidden" || cs.display === "none" || cs.opacity === "0") continue;
      vis.push(el);
    }
    const el = vis[idx];
    if (!el) return "gone";
    el.scrollIntoView({ block: "center" });
    el.click();
    return "clicked";
  }, n);
}

async function toastText(page) {
  return page
    .evaluate(() => {
      const nodes = [...document.querySelectorAll('[role="status"], [role="alert"], [class*="toast" i], [data-sonner-toast]')];
      return nodes.map((n) => (n.innerText || "").replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 3);
    })
    .catch(() => []);
}

async function crawlRoute(ctx, route, { signedIn }) {
  const page = await ctx.newPage();
  const before = errors.length;
  watch(page, errors, route.name);

  await page.goto(`${APP}${route.path}`, { waitUntil: "domcontentloaded" }).catch(() => {});
  await settle(page, 900);

  const landedOn = new URL(page.url()).pathname;
  const bodyLen = ((await page.textContent("body").catch(() => "")) || "").trim().length;

  if (signedIn && landedOn === "/login") {
    note("high", route.name, "Signed-in user bounced to login", `${route.path} redirected to /login`);
  }
  if (bodyLen < 120) {
    note("high", route.name, "Page rendered essentially empty", `${route.path} produced ${bodyLen} chars of text`);
  }

  const controls = await inventory(page);
  const pressed = [];
  const skipped = [];

  for (let i = 0; i < controls.length; i++) {
    const c = controls[i];
    if (c.disabled) continue;
    if (DESTRUCTIVE.test(c.label) || (c.href && NAV_AWAY.test(c.label))) {
      skipped.push(c.label);
      continue;
    }
    // External / mailto links: nothing to learn by following them.
    if (c.href && /^(https?:|mailto:|tel:)/.test(c.href) && !c.href.startsWith(APP)) {
      skipped.push(`${c.label} (external)`);
      continue;
    }

    const mark = errors.length;
    await page.goto(`${APP}${route.path}`, { waitUntil: "domcontentloaded" }).catch(() => {});
    await settle(page, 500);
    const res = await clickNth(page, i).catch((e) => `error: ${e.message.slice(0, 60)}`);
    if (res !== "clicked") {
      skipped.push(`${c.label} (${res})`);
      continue;
    }
    await sleep(900);

    const toasts = await toastText(page);
    const bad = toasts.filter((t) => /fail|error|could not|unable|denied|went wrong/i.test(t));
    if (bad.length) {
      note("medium", route.name, `Control shows an error: "${c.label}"`, bad.join(" | ").slice(0, 220));
    }
    const newErrors = errors.slice(mark);
    const server = newErrors.filter((e) => /^http5/.test(e.kind));
    if (server.length) {
      note("high", route.name, `Control caused a server error: "${c.label}"`, server[0].text.slice(0, 200));
    }
    pressed.push({ label: c.label, toasts: toasts.slice(0, 1) });
  }

  pageReports.push({
    route: route.path,
    name: route.name,
    landedOn,
    bodyChars: bodyLen,
    controls: controls.length,
    pressed: pressed.length,
    skipped,
    newErrors: errors.length - before,
  });
  console.log(
    `  ${route.name.padEnd(18)} ${String(controls.length).padStart(3)} controls, ` +
      `${String(pressed.length).padStart(3)} pressed, ${String(skipped.length).padStart(2)} skipped, ` +
      `${errors.length - before} error(s)`
  );

  await page.close();
}

// ------------------------------------------------------------------ signed in
console.log("\n=== authenticated pages ===");
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await signIn(ctx, chair, { chapterId: fx.chapter.id });
for (const r of routes(fx)) await crawlRoute(ctx, r, { signedIn: true });

// --------------------------------------------------------------- signed out
console.log("\n=== public pages (signed out) ===");
const anon = await browser.newContext({ viewport: { width: 1440, height: 900 } });
for (const r of publicRoutes(fx)) await crawlRoute(anon, r, { signedIn: false });

const byKind = errors.reduce((a, e) => ((a[e.kind] = (a[e.kind] || 0) + 1), a), {});
writeFileSync(
  join(ROOT, "report-crawl.json"),
  JSON.stringify({ pageReports, findings, errorsByKind: byKind, errors: errors.slice(0, 400) }, null, 2)
);

console.log(`\n=== ${findings.length} finding(s) ===`);
console.log("errors by kind:", byKind);
const grouped = {};
for (const e of errors) {
  const k = `${e.kind} :: ${e.text.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, "<id>").slice(0, 130)}`;
  grouped[k] = (grouped[k] || 0) + 1;
}
console.log("\ntop distinct errors:");
for (const [k, n] of Object.entries(grouped).sort((a, b) => b[1] - a[1]).slice(0, 25)) {
  console.log(`  ${String(n).padStart(3)}x ${k}`);
}

await browser.close();
