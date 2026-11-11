/**
 * API contract sweep: every endpoint, once per role.
 *
 * No browser. It reads the running backend's /openapi.json so the list of
 * endpoints is the real one, then for each operation checks three things:
 *
 *   1. signed out      -> 401/403 (or 2xx/404 for the handful that are public)
 *   2. as a member     -> 403 on everything that should be admin-only
 *   3. as the admin    -> the happy path returns what the frontend expects
 *
 * Any operation in /openapi.json that this file has no case for is reported
 * as "uncovered", so a new route cannot slip in untested.
 *
 *   node api-contract.mjs
 *
 * WRITES AND DELETES: creates and removes PNMs, events, tags, rounds, a
 * session, a merge, role changes, and finalizes the bid list. Reseed after
 * (`python3 e2e/guard.py --seed`). Runs only against the local e2e database;
 * guard.mjs enforces that.
 *
 * Endpoints that call Supabase Auth/Storage or MailerLite cannot succeed
 * locally (e2e/env.sh points Supabase at a hostname that does not resolve).
 * For those only the auth and role checks are asserted, and the admin call is
 * recorded as "external".
 *
 * Exit code: 0 = no unexpected results, 1 = at least one, 2 = guard refused.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fixtures, ROOT } from "./lib/harness.mjs";
import { guard, sql, API, TEMP_CHAPTER_PREFIX } from "./guard.mjs";

await guard();

const fx = fixtures();
const C = fx.chapter.id;
const admin = fx.users.find((u) => u.role === "admin");
const exec = fx.users.find((u) => u.role === "exec");
const membersAll = fx.users.filter((u) => u.role === "member");
const member = membersAll[0];
const target = membersAll[membersAll.length - 1]; // the member whose role gets changed and restored
const WHO = { admin, exec, member, none: null };
const NOBODY = "00000000-0000-4000-8000-000000000000";

const results = [];
const covered = new Set();
const known = [];

async function raw(user, method, path, { body, form, headers } = {}) {
  const init = { method, headers: { ...(headers || {}) } };
  if (user) init.headers.Authorization = `Bearer ${user.token}`;
  if (form) {
    init.body = form;
  } else if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const started = Date.now();
  let res;
  try {
    res = await fetch(`${API}${path}`, init);
  } catch (e) {
    return { status: 0, json: null, text: String(e.message || e), ms: Date.now() - started };
  }
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* csv, pdf, png, html */
  }
  return { status: res.status, json, text, ms: Date.now() - started, type: res.headers.get("content-type") || "" };
}

/**
 * One assertion. `op` is "METHOD /template" exactly as it appears in
 * openapi.json minus the /api/v1 prefix, which is how coverage is tracked.
 */
async function t(op, as, path, { expect, body, form, external = false, knownIf, note = "", prefix = "/api/v1" } = {}) {
  const [method] = op.split(" ");
  covered.add(op);
  const r = await raw(WHO[as], method, `${prefix}${path}`, { body, form });
  const want = Array.isArray(expect) ? expect : [expect];
  let outcome = want.includes(r.status) ? "pass" : "FAIL";
  if (external && outcome === "FAIL") outcome = "external";
  if (knownIf && knownIf(r)) {
    outcome = "known";
    known.push({ op, as, status: r.status, note });
  }
  results.push({ op, as, path, status: r.status, expect: want, outcome, ms: r.ms, note, detail: outcome === "FAIL" ? r.text.slice(0, 200) : undefined });
  const flag = outcome === "pass" ? "ok  " : outcome === "FAIL" ? "FAIL" : outcome === "known" ? "known" : "ext ";
  if (outcome !== "pass") {
    console.log(`  ${flag} ${as.padEnd(6)} ${op} -> ${r.status} (wanted ${want.join("/")}) ${note}${outcome === "FAIL" ? "\n         " + r.text.slice(0, 160) : ""}`);
  }
  return r;
}

const DENIED = [401, 403];
const OK = [200, 201];
const ANY_EXTERNAL = [200, 201, 400, 404, 500, 502, 503];

console.log(`\n=== api-contract against ${API} ===\n`);

// ------------------------------------------------------------ ids to work with
const stamp = Date.now().toString(36);
const roster = fx.roster;
const P = roster[5].id; // a seeded formal-rush PNM, read-only use
const R = fx.endedRound.id;
const EV = fx.event.id;

// ------------------------------------------------------------------- identity
await t("GET /me", "none", "/me", { expect: DENIED });
const me = await t("GET /me", "member", "/me", { expect: 200 });
await t("GET /me", "admin", "/me", { expect: 200 });
await t("GET /me", "admin", "/me", { expect: 200, prefix: "/api", note: "legacy /api mount" });
await t("PATCH /me", "none", "/me", { body: { name: "Nobody" }, expect: DENIED });
await t("PATCH /me", "member", "/me", { body: { name: "   " }, expect: [400, 422], note: "blank name" });
{
  const renamed = await t("PATCH /me", "member", "/me", { body: { name: `  ${member.name}  ` }, expect: 200 });
  if (renamed.json?.name !== member.name) {
    results.push({ op: "PATCH /me", as: "member", outcome: "FAIL", detail: `name came back as ${JSON.stringify(renamed.json?.name)}` });
    console.log("  FAIL PATCH /me did not return the saved name");
  }
}
await t("GET /chapters/{chapter_id}/min-gpa", "none", `/chapters/${C}/min-gpa`, { expect: DENIED });
await t("GET /chapters/{chapter_id}/min-gpa", "member", `/chapters/${C}/min-gpa`, { expect: 200 });
{
  // The check-in page's search: every word must match the name or the email.
  const hit = await raw(member, "GET", `/api/v1/pnms?chapter_id=${C}&search=${encodeURIComponent(fx.roster[0].name)}`);
  const miss = await raw(member, "GET", `/api/v1/pnms?chapter_id=${C}&search=zzzz-nobody`);
  const okHit = Array.isArray(hit.json) && hit.json.length >= 1 && hit.json.every((p) => p.name === fx.roster[0].name);
  const okMiss = Array.isArray(miss.json) && miss.json.length === 0;
  results.push({ op: "GET /pnms?search", as: "member", status: hit.status, outcome: okHit && okMiss ? "pass" : "FAIL", detail: `hit=${hit.json?.length} miss=${miss.json?.length}` });
  if (!(okHit && okMiss)) console.log(`  FAIL GET /pnms?search did not narrow the list (hit=${hit.json?.length}, miss=${miss.json?.length})`);
}

await t("GET /chapters", "none", "/chapters", { expect: DENIED });
await t("GET /chapters", "member", "/chapters", { expect: 200 });

// ---------------------------------------------------------------- memberships
await t("GET /memberships", "none", `/memberships?chapter_id=${C}`, { expect: DENIED });
await t("GET /memberships", "member", `/memberships?chapter_id=${C}`, { expect: 403 });
const ms = await t("GET /memberships", "admin", `/memberships?chapter_id=${C}`, { expect: 200 });
const msList = Array.isArray(ms.json) ? ms.json : ms.json?.memberships || ms.json?.data || [];
const targetMs = msList.find((m) => (m.user_id || m.user?.id) === target.id || m.email === target.email || m.user?.email === target.email);
const MS = targetMs?.id || targetMs?.membership_id;

await t("POST /memberships/invite", "none", `/memberships/invite?chapter_id=${C}`, { body: { email: `x-${stamp}@example.com` }, expect: DENIED });
await t("POST /memberships/invite", "member", `/memberships/invite?chapter_id=${C}`, { body: { email: `x-${stamp}@example.com` }, expect: 403 });
await t("POST /memberships/invite", "admin", `/memberships/invite?chapter_id=${C}`, { body: { email: `x-${stamp}@example.com` }, expect: OK, external: true, note: "creates a Supabase Auth user" });

if (MS) {
  await t("PUT /memberships/{membership_id}", "none", `/memberships/${MS}?chapter_id=${C}`, { body: { role: "observer" }, expect: DENIED });
  await t("PUT /memberships/{membership_id}", "member", `/memberships/${MS}?chapter_id=${C}`, { body: { role: "admin" }, expect: 403 });
  await t("PUT /memberships/{membership_id}", "admin", `/memberships/${MS}?chapter_id=${C}`, { body: { role: "observer" }, expect: 200 });
  await t("PUT /memberships/{membership_id}", "admin", `/memberships/${MS}?chapter_id=${C}`, {
    body: { role: "exec" }, expect: 200, knownIf: (r) => r.status === 400, note: "exec cannot be assigned through the API",
  });
  await t("PUT /memberships/{membership_id}", "admin", `/memberships/${MS}?chapter_id=${C}`, { body: { role: "member" }, expect: 200, note: "restore" });
} else {
  results.push({ op: "PUT /memberships/{membership_id}", outcome: "FAIL", detail: "could not find the target membership id in GET /memberships" });
  console.log("  FAIL could not find the target membership id in GET /memberships");
}

// ---------------------------------------------------------------------- theme
await t("GET /chapters/me/theme", "none", "/chapters/me/theme", { expect: DENIED });
await t("GET /chapters/me/theme", "member", "/chapters/me/theme", { expect: 200 });
const theme = { enabled: true, accent_hex: "#0F2B5B", source: "manual" };
await t("PATCH /chapters/me/theme", "none", "/chapters/me/theme", { body: theme, expect: DENIED });
await t("PATCH /chapters/me/theme", "member", "/chapters/me/theme", { body: theme, expect: 403 });
await t("PATCH /chapters/me/theme", "admin", "/chapters/me/theme", { body: theme, expect: 200 });
await t("GET /fraternity-colors", "none", "/fraternity-colors", { expect: 200 });

// --------------------------------------------------------------------- public
await t("GET /public/chapters/{chapter_id}", "none", `/public/chapters/${C}`, { expect: 200 });
await t("GET /public/chapters/{chapter_id}", "none", `/public/chapters/${NOBODY}`, { expect: 404, note: "unknown chapter" });
const intake = await t("POST /public/chapters/{chapter_id}/intake", "none", `/public/chapters/${C}/intake?source=instagram`, {
  body: { name: `E2E Prospect ${stamp}`, instagram_handle: `e2e_${stamp}`, stage: "prospect" }, expect: OK,
});
const PROSPECT = intake.json?.id || intake.json?.pnm?.id || intake.json?.data?.id ||
  sql(`select id::text from pnms where name='E2E Prospect ${stamp}' limit 1`)[0]?.[0];
await t("POST /public/chapters/{chapter_id}/intake", "none", `/public/chapters/${NOBODY}/intake`, { body: { name: "Nobody" }, expect: 404, note: "unknown chapter" });
await t("POST /public/demo-session", "none", "/public/demo-session", { expect: [200, 404], note: "404 unless DEMO_USER_* is configured" });
await t("GET /health", "none", "/health", { expect: 200 });
await t("GET /qr.png", "none", `/qr.png?email=${encodeURIComponent("nobody-" + stamp + "@example.com")}`, { expect: [200, 404] });
await t("GET /qr", "none", `/qr?email=${encodeURIComponent("nobody-" + stamp + "@example.com")}`, { expect: [200, 404] });

// main.py routes (not under /api)
await t("GET /", "none", "/", { expect: 200, prefix: "" });
await t("GET /health", "none", "/health", { expect: 200, prefix: "", note: "main.py /health" });
await t("GET /health/db", "none", "/health/db", { expect: 200, prefix: "" });
await t("GET /health/storage", "none", "/health/storage", { expect: 200, prefix: "", external: true, note: "calls Supabase Storage" });
{
  covered.add("OPTIONS /{full_path}");
  const good = await raw(null, "OPTIONS", "/api/v1/me", { headers: { Origin: "http://localhost:3000", "Access-Control-Request-Method": "GET" } });
  const bad = await raw(null, "OPTIONS", "/api/v1/me", { headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "GET" } });
  const ok = good.status === 200 && [400, 403].includes(bad.status);
  results.push({ op: "OPTIONS /{full_path}", as: "none", status: `${good.status}/${bad.status}`, expect: ["200 allowed", "400/403 other"], outcome: ok ? "pass" : "FAIL" });
  if (!ok) console.log(`  FAIL none   OPTIONS preflight -> allowed origin ${good.status}, foreign origin ${bad.status}`);
}

// ----------------------------------------------------------------------- PNMs
await t("GET /pnms", "none", `/pnms?chapter_id=${C}`, { expect: DENIED });
await t("GET /pnms", "member", `/pnms?chapter_id=${C}`, { expect: 200 });
await t("GET /pnms", "member", "/pnms", { expect: 422, note: "chapter_id is required" });
await t("GET /pnms", "member", `/pnms?chapter_id=${NOBODY}`, { expect: [403, 404], note: "another chapter" });

await t("POST /pnms", "none", `/pnms?chapter_id=${C}`, { body: { name: "x" }, expect: DENIED });
const mk = async (label) => {
  const r = await t("POST /pnms", "member", `/pnms?chapter_id=${C}`, {
    body: { name: `E2E ${label} ${stamp}`, email: `e2e-${label}-${stamp}@example.com`, major: "Testing", year: "2nd Year", hometown: "Localhost" },
    expect: OK,
  });
  return r.json?.id || sql(`select id::text from pnms where email='e2e-${label}-${stamp}@example.com' limit 1`)[0]?.[0];
};
const P2 = await mk("alpha"); // edited, tagged, archived, deleted
const W = await mk("winner"); // merge winner
const L = await mk("loser"); // merge loser

await t("GET /pnms/{pnm_id}", "none", `/pnms/${P}`, { expect: DENIED });
await t("GET /pnms/{pnm_id}", "member", `/pnms/${P}`, { expect: 200 });
await t("GET /pnms/{pnm_id}", "member", `/pnms/${NOBODY}`, { expect: 404, note: "unknown PNM" });
await t("PUT /pnms/{pnm_id}", "none", `/pnms/${P2}`, { body: { name: "x" }, expect: DENIED });
await t("PUT /pnms/{pnm_id}", "member", `/pnms/${P2}`, { body: { name: `E2E alpha ${stamp} edited`, major: "Edited" }, expect: 200 });
await t("GET /pnms/{pnm_id}/qr", "none", `/pnms/${P}/qr`, { expect: DENIED });
await t("GET /pnms/{pnm_id}/qr", "member", `/pnms/${P2}/qr`, { expect: 200, external: true, note: "may upload to Supabase Storage" });
await t("GET /pnms/{pnm_id}/share-card", "none", `/pnms/${P}/share-card`, { expect: DENIED });
await t("GET /pnms/{pnm_id}/share-card", "member", `/pnms/${P}/share-card`, { expect: 200, external: true, note: "Supabase Storage; 502 expected locally" });
await t("GET /pnms/{pnm_id}/attendance", "none", `/pnms/${P}/attendance`, { expect: DENIED });
await t("GET /pnms/{pnm_id}/attendance", "member", `/pnms/${P}/attendance`, { expect: 200 });

// GPA
await t("PATCH /pnms/{pnm_id}/gpa", "none", `/pnms/${P2}/gpa`, { body: { gpa: 2.1 }, expect: DENIED });
await t("PATCH /pnms/{pnm_id}/gpa", "member", `/pnms/${P2}/gpa`, { body: { gpa: 2.1 }, expect: 200 });
await t("PATCH /pnms/{pnm_id}/gpa", "member", `/pnms/${P2}/gpa`, { body: { gpa: 9 }, expect: [400, 422], note: "out of range" });
await t("PUT /chapters/{chapter_id}/min-gpa", "none", `/chapters/${C}/min-gpa`, { body: { gpa: 2.5 }, expect: DENIED });
await t("PUT /chapters/{chapter_id}/min-gpa", "member", `/chapters/${C}/min-gpa`, { body: { gpa: 2.5 }, expect: 403 });
await t("PUT /chapters/{chapter_id}/min-gpa", "admin", `/chapters/${C}/min-gpa`, { body: { gpa: 2.5 }, expect: 200 });
await t("POST /pnms/{pnm_id}/gpa-waiver", "none", `/pnms/${P2}/gpa-waiver`, { body: { waived: true, reason: "e2e" }, expect: DENIED });
await t("POST /pnms/{pnm_id}/gpa-waiver", "member", `/pnms/${P2}/gpa-waiver`, { body: { waived: true, reason: "e2e" }, expect: 403 });
await t("POST /pnms/{pnm_id}/gpa-waiver", "exec", `/pnms/${P2}/gpa-waiver`, { body: { waived: true, reason: "e2e exec waiver" }, expect: 200 });

// Pipeline
await t("GET /chapters/{chapter_id}/pipeline", "none", `/chapters/${C}/pipeline`, { expect: DENIED });
await t("GET /chapters/{chapter_id}/pipeline", "member", `/chapters/${C}/pipeline`, { expect: 200 });
await t("PATCH /pnms/{pnm_id}/pipeline", "none", `/pnms/${PROSPECT}/pipeline`, { body: { contact_status: "contacted" }, expect: DENIED });
await t("PATCH /pnms/{pnm_id}/pipeline", "member", `/pnms/${PROSPECT}/pipeline`, { body: { contact_status: "contacted", owner_user_id: member.id }, expect: 200 });
await t("GET /chapters/{chapter_id}/interest-qr", "none", `/chapters/${C}/interest-qr`, { expect: DENIED });
await t("GET /chapters/{chapter_id}/interest-qr", "member", `/chapters/${C}/interest-qr?source=tabling`, { expect: 200 });
await t("GET /chapters/{chapter_id}/pipeline/duplicates", "none", `/chapters/${C}/pipeline/duplicates?name=x`, { expect: DENIED });
await t("GET /chapters/{chapter_id}/pipeline/duplicates", "member", `/chapters/${C}/pipeline/duplicates?name=${encodeURIComponent(roster[3].name)}`, { expect: 200 });

// Contact coverage
await t("POST /pnms/{pnm_id}/contacts", "none", `/pnms/${P2}/contacts`, { body: {}, expect: DENIED });
await t("POST /pnms/{pnm_id}/contacts", "member", `/pnms/${P2}/contacts`, { body: {}, expect: OK });
await t("POST /pnms/{pnm_id}/contacts", "member", `/pnms/${P2}/contacts`, { body: {}, expect: OK, note: "idempotent" });
await t("GET /pnms/{pnm_id}/contacts", "none", `/pnms/${P2}/contacts`, { expect: DENIED });
await t("GET /pnms/{pnm_id}/contacts", "member", `/pnms/${P2}/contacts`, { expect: 200 });
await t("DELETE /pnms/{pnm_id}/contacts", "none", `/pnms/${P2}/contacts`, { expect: DENIED });
await t("DELETE /pnms/{pnm_id}/contacts", "member", `/pnms/${P2}/contacts`, { expect: [200, 204] });

// Notes
await t("GET /pnms/{pnm_id}/notes", "none", `/pnms/${P}/notes`, { expect: DENIED });
await t("GET /pnms/{pnm_id}/notes", "member", `/pnms/${P}/notes`, { expect: 200 });
await t("POST /pnms/{pnm_id}/notes", "none", `/pnms/${P2}/notes`, { body: { pnm_id: P2, body: "x" }, expect: DENIED });
const noteRes = await t("POST /pnms/{pnm_id}/notes", "member", `/pnms/${P2}/notes`, { body: { pnm_id: P2, body: `e2e note ${stamp}`, anonymous: true }, expect: OK });
const NOTE = noteRes.json?.id || sql(`select id::text from pnm_notes where pnm_id='${P2}' order by created_at desc limit 1`)[0]?.[0];
{
  // An anonymous note should not reveal its author to other members.
  const list = await raw(exec, "GET", `/api/v1/pnms/${P2}/notes`);
  const mine = (Array.isArray(list.json) ? list.json : list.json?.notes || []).find((n) => n.id === NOTE);
  if (mine && (mine.author_id === member.id || mine.author_user_id === member.id)) {
    results.push({ op: "GET /pnms/{pnm_id}/notes", as: "exec", status: 200, outcome: "FAIL", detail: "anonymous note returns the author's id" });
    console.log("  FAIL exec   GET /pnms/{pnm_id}/notes -> anonymous note returns the author's id");
  }
}
await t("DELETE /notes/{note_id}", "none", `/notes/${NOTE}`, { expect: DENIED });
await t("DELETE /notes/{note_id}", "member", `/notes/${NOTE}`, { expect: 403 });
await t("DELETE /notes/{note_id}", "admin", `/notes/${NOTE}`, { expect: [200, 204] });

// Import (dry run only writes nothing)
const csv = () => {
  const f = new FormData();
  f.append("file", new Blob([`name,email,major\nE2E Import ${stamp},e2e-import-${stamp}@example.com,Testing\n${roster[0].name},,\n`], { type: "text/csv" }), "e2e.csv");
  return f;
};
await t("POST /pnms/import", "none", `/pnms/import?chapter_id=${C}&dry_run=true`, { form: csv(), expect: DENIED });
await t("POST /pnms/import", "member", `/pnms/import?chapter_id=${C}&dry_run=true`, { form: csv(), expect: 403 });
{
  const before = Number(sql(`select count(*) from pnms where chapter_id='${C}'`)[0][0]);
  await t("POST /pnms/import", "admin", `/pnms/import?chapter_id=${C}&dry_run=true`, { form: csv(), expect: 200 });
  const after = Number(sql(`select count(*) from pnms where chapter_id='${C}'`)[0][0]);
  if (before !== after) {
    results.push({ op: "POST /pnms/import", as: "admin", outcome: "FAIL", detail: `dry run wrote rows: ${before} -> ${after}` });
    console.log(`  FAIL admin  POST /pnms/import dry_run=true changed the PNM count ${before} -> ${after}`);
  }
}

// Uploads and cards: Supabase Storage, so only the gates are checked.
await t("POST /pnms/upload-url", "none", "/pnms/upload-url", { body: { pnm_id: P2, filename: "a.jpg" }, expect: DENIED });
await t("POST /pnms/upload-url", "member", "/pnms/upload-url", { body: { pnm_id: P2, filename: "a.jpg" }, expect: 200, external: true, note: "Supabase Storage" });
const photo = () => {
  const f = new FormData();
  f.append("file", new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" }), "a.jpg");
  return f;
};
await t("POST /pnms/{pnm_id}/upload-photo", "none", `/pnms/${P2}/upload-photo`, { form: photo(), expect: DENIED });
await t("POST /pnms/{pnm_id}/upload-photo", "member", `/pnms/${P2}/upload-photo`, { form: photo(), expect: 200, external: true, note: "Supabase Storage" });
await t("POST /exports/pnm-card/{pnm_id}", "none", `/exports/pnm-card/${P}`, { expect: DENIED });
await t("POST /exports/pnm-card/{pnm_id}", "member", `/exports/pnm-card/${P}`, { expect: 200, external: true, note: "Supabase Storage; 502 expected locally" });
await t("POST /exports/pnm-cards/bulk", "none", "/exports/pnm-cards/bulk", { body: { chapter_id: C, pnm_ids: [P] }, expect: DENIED });
await t("POST /exports/pnm-cards/bulk", "member", "/exports/pnm-cards/bulk", { body: { chapter_id: C, pnm_ids: [P] }, expect: 200, external: true, note: "Supabase Storage" });

// Exports that do run locally
await t("POST /pnms/export/pptx", "none", "/pnms/export/pptx", { body: { filters: {}, sort: null }, expect: DENIED });
await t("POST /pnms/export/pptx", "member", "/pnms/export/pptx", { body: { filters: {}, sort: null }, expect: 403 });
await t("POST /pnms/export/pptx", "exec", "/pnms/export/pptx", { body: { filters: {}, sort: null }, expect: 200, note: "seed photos are remote; slow without network" });
await t("GET /export/csv", "none", `/export/csv?entity=pnms&chapter_id=${C}`, { expect: DENIED });
await t("GET /export/csv", "member", `/export/csv?entity=pnms&chapter_id=${C}`, { expect: 200 });
await t("GET /export/csv", "member", `/export/csv?entity=results&roundId=${R}`, { expect: 200 });
await t("GET /exports/pnms.csv", "none", `/exports/pnms.csv?chapter_id=${C}`, { expect: DENIED });
await t("GET /exports/pnms.csv", "member", `/exports/pnms.csv?chapter_id=${C}`, { expect: 200 });
await t("GET /exports/rounds/{round_id}.csv", "none", `/exports/rounds/${R}.csv`, { expect: DENIED });
await t("GET /exports/rounds/{round_id}.csv", "member", `/exports/rounds/${R}.csv`, { expect: 200 });
await t("GET /rounds/{round_id}/export", "none", `/rounds/${R}/export`, { expect: DENIED });
await t("GET /rounds/{round_id}/export", "member", `/rounds/${R}/export`, { expect: 200 });

// ----------------------------------------------------------------------- tags
await t("GET /tags", "none", `/tags?chapter_id=${C}`, { expect: DENIED });
await t("GET /tags", "member", `/tags?chapter_id=${C}`, { expect: 200 });
await t("GET /tags/stats", "none", `/tags/stats?chapter_id=${C}`, { expect: DENIED });
await t("GET /tags/stats", "member", `/tags/stats?chapter_id=${C}`, { expect: 200 });
await t("POST /tags", "none", `/tags?chapter_id=${C}`, { body: { label: "x", color: "#111111" }, expect: DENIED });
await t("POST /tags", "member", `/tags?chapter_id=${C}`, { body: { label: "x", color: "#111111" }, expect: 403 });
const tagRes = await t("POST /tags", "admin", `/tags?chapter_id=${C}`, { body: { label: `E2E ${stamp}`, color: "#336699" }, expect: OK });
const T = tagRes.json?.id || sql(`select id::text from tags where label='E2E ${stamp}' limit 1`)[0]?.[0];
await t("PUT /tags/{tag_id}", "none", `/tags/${T}?chapter_id=${C}`, { body: { label: "y", color: "#111111" }, expect: DENIED });
await t("PUT /tags/{tag_id}", "member", `/tags/${T}?chapter_id=${C}`, { body: { label: "y", color: "#111111" }, expect: 403 });
await t("PUT /tags/{tag_id}", "admin", `/tags/${T}?chapter_id=${C}`, { body: { label: `E2E ${stamp} renamed`, color: "#996633" }, expect: 200 });
await t("POST /pnms/{pnm_id}/tags/{tag_id}", "none", `/pnms/${P2}/tags/${T}`, { expect: DENIED });
await t("POST /pnms/{pnm_id}/tags/{tag_id}", "member", `/pnms/${P2}/tags/${T}`, { expect: 403 });
await t("POST /pnms/{pnm_id}/tags/{tag_id}", "admin", `/pnms/${P2}/tags/${T}`, { expect: OK });
await t("DELETE /pnms/{pnm_id}/tags/{tag_id}", "none", `/pnms/${P2}/tags/${T}`, { expect: DENIED });
await t("DELETE /pnms/{pnm_id}/tags/{tag_id}", "member", `/pnms/${P2}/tags/${T}`, { expect: 403 });
await t("DELETE /pnms/{pnm_id}/tags/{tag_id}", "admin", `/pnms/${P2}/tags/${T}`, { expect: [200, 204] });
await t("DELETE /tags/{tag_id}", "none", `/tags/${T}?chapter_id=${C}`, { expect: DENIED });
await t("DELETE /tags/{tag_id}", "member", `/tags/${T}?chapter_id=${C}`, { expect: 403 });
await t("DELETE /tags/{tag_id}", "admin", `/tags/${T}?chapter_id=${C}`, { expect: [200, 204] });

// ------------------------------------------------------------- questionnaires
await t("GET /questionnaires", "none", `/questionnaires?chapter_id=${C}`, { expect: DENIED });
await t("GET /questionnaires", "member", `/questionnaires?chapter_id=${C}`, { expect: 200 });
const qBody = { name: `E2E ${stamp}`, schema: { questions: [{ id: "q1", text: "Favourite test?", type: "text", required: false }] }, active: true };
await t("POST /questionnaires", "none", `/questionnaires?chapter_id=${C}`, { body: qBody, expect: DENIED });
await t("POST /questionnaires", "member", `/questionnaires?chapter_id=${C}`, { body: qBody, expect: 403 });
// The Settings page sends exactly this shape ({questions: [...]}); the service
// hands the dict to asyncpg for a jsonb column without encoding it.
const qRes = await t("POST /questionnaires", "admin", `/questionnaires?chapter_id=${C}`, {
  body: qBody, expect: OK, knownIf: (r) => r.status === 500, note: "questionnaire save fails: schema dict is not JSON-encoded for the jsonb column",
});
let Q = qRes.json?.id || sql(`select id::text from questionnaires where name='E2E ${stamp}' limit 1`)[0]?.[0];
if (!Q) {
  // Keep going with a row inserted directly so the remaining cases still run.
  Q = sql(`insert into questionnaires (chapter_id, name, schema, active) values ('${C}', 'E2E ${stamp}', '{"questions":[]}'::jsonb, true) returning id::text`)[0][0];
}
await t("PUT /questionnaires/{questionnaire_id}", "none", `/questionnaires/${Q}?chapter_id=${C}`, { body: qBody, expect: DENIED });
await t("PUT /questionnaires/{questionnaire_id}", "member", `/questionnaires/${Q}?chapter_id=${C}`, { body: qBody, expect: 403 });
await t("PUT /questionnaires/{questionnaire_id}", "admin", `/questionnaires/${Q}?chapter_id=${C}`, {
  body: { ...qBody, active: false }, expect: 200, knownIf: (r) => r.status === 500, note: "questionnaire update fails the same way",
});
await t("POST /pnms/{pnm_id}/answers", "none", `/pnms/${P2}/answers`, { body: { questionnaire_id: Q, answers: { q1: "x" } }, expect: DENIED });
await t("POST /pnms/{pnm_id}/answers", "member", `/pnms/${P2}/answers`, {
  body: { questionnaire_id: Q, answers: { q1: "this one" } }, expect: OK,
  knownIf: (r) => r.status === 500, note: "answers are never saved: dict is not JSON-encoded; the frontend swallows the error",
});
await t("GET /pnms/{pnm_id}/questionnaire", "none", `/pnms/${P2}/questionnaire`, { expect: DENIED });
{
  // Answers come back with the question text beside them.
  const r = await raw(member, "GET", `/api/v1/pnms/${P2}/questionnaire`);
  const item = Array.isArray(r.json) ? r.json[0]?.items?.[0] : null;
  if (r.status === 200 && !(item && item.question && item.answer === "this one")) {
    results.push({ op: "GET /pnms/{pnm_id}/questionnaire", as: "member", outcome: "FAIL", detail: `unexpected body ${JSON.stringify(r.json).slice(0, 160)}` });
    console.log("  FAIL member questionnaire answers missing or unlabelled");
  }
}
await t("GET /pnms/{pnm_id}/questionnaire", "member", `/pnms/${P2}/questionnaire`, {
  expect: 200, knownIf: (r) => r.status === 500, note: "calls QuestionnaireService.get_pnm_answers, which does not exist",
});

// --------------------------------------------------------------------- events
await t("GET /events", "none", `/events?chapter_id=${C}`, { expect: DENIED });
await t("GET /events", "member", `/events?chapter_id=${C}`, { expect: 200 });
const evBody = { name: `E2E Event ${stamp}`, date: new Date(Date.now() + 86400000).toISOString(), location: "Localhost", type: "optional" };
await t("POST /events", "none", `/events?chapter_id=${C}`, { body: evBody, expect: DENIED });
await t("POST /events", "member", `/events?chapter_id=${C}`, { body: evBody, expect: 403 });
const evRes = await t("POST /events", "admin", `/events?chapter_id=${C}`, { body: evBody, expect: OK });
const EV2 = evRes.json?.id || sql(`select id::text from events where name='E2E Event ${stamp}' limit 1`)[0]?.[0];
await t("PATCH /events/{event_id}", "none", `/events/${EV2}`, { body: evBody, expect: DENIED });
await t("PATCH /events/{event_id}", "member", `/events/${EV2}`, { body: evBody, expect: 403 });
await t("PATCH /events/{event_id}", "admin", `/events/${EV2}`, { body: { ...evBody, location: "Edited" }, expect: 200 });
await t("GET /events/{event_id}/attendance", "none", `/events/${EV}/attendance`, { expect: DENIED });
await t("GET /events/{event_id}/attendance", "member", `/events/${EV}/attendance`, { expect: 200 });
await t("POST /events/{event_id}/attendance", "none", `/events/${EV2}/attendance`, { body: { event_id: EV2, pnm_id: P2 }, expect: DENIED });
await t("POST /events/{event_id}/attendance", "member", `/events/${EV2}/attendance`, { body: { event_id: EV2, pnm_id: P2 }, expect: OK });
await t("POST /events/{event_id}/attendance", "member", `/events/${EV2}/attendance`, { body: { event_id: EV2, pnm_id: P2 }, expect: 400, note: "already checked in" });
await t("POST /events/export", "none", `/events/export?chapter_id=${C}`, { expect: DENIED });
await t("POST /events/export", "member", `/events/export?chapter_id=${C}`, { expect: 403 });
await t("POST /events/export", "admin", `/events/export?chapter_id=${C}`, { expect: 200 });
await t("DELETE /events/{event_id}", "none", `/events/${EV2}`, { expect: DENIED });
await t("DELETE /events/{event_id}", "member", `/events/${EV2}`, { expect: 403 });
await t("DELETE /events/{event_id}", "admin", `/events/${EV2}`, { expect: [200, 204] });

// ------------------------------------------------------------- rounds + votes
sql(`update sessions set ended_at = now() where ended_at is null and round_id in (select id from voting_rounds where chapter_id='${C}')`);
sql(`update voting_rounds set status='ENDED', ended_at=now() where status='ACTIVE' and chapter_id='${C}'`);

await t("GET /rounds", "none", `/rounds?chapter_id=${C}`, { expect: DENIED });
await t("GET /rounds", "member", `/rounds?chapter_id=${C}`, { expect: 200 });
await t("GET /rounds", "member", `/rounds?chapter_id=${NOBODY}`, {
  expect: 403, note: "not a member of that chapter",
});
await t("GET /rounds/active", "none", `/rounds/active?chapter_id=${C}`, { expect: DENIED });
await t("GET /rounds/active", "member", `/rounds/active?chapter_id=${C}`, { expect: [200, 404] });
await t("GET /rounds/{round_id}/results", "none", `/rounds/${R}/results`, { expect: DENIED });
const res = await t("GET /rounds/{round_id}/results", "member", `/rounds/${R}/results`, { expect: 200 });
{
  const rows = Array.isArray(res.json) ? res.json : res.json?.results || [];
  const first = rows[0] || {};
  const need = ["vote_count", "yes_count", "no_count", "dont_know_count", "favorite_count", "yes_percentage", "controversy_score"];
  const missing = need.filter((k) => !(k in first));
  if (!rows.length || missing.length) {
    results.push({ op: "GET /rounds/{round_id}/results", as: "member", outcome: "FAIL", detail: `rows=${rows.length}, missing fields: ${missing.join(",")}` });
    console.log(`  FAIL member results shape: rows=${rows.length}, missing ${missing.join(",")}`);
  }
}
await t("GET /rounds/{round_id}/status", "none", `/rounds/${R}/status`, { expect: DENIED });
await t("GET /rounds/{round_id}/status", "member", `/rounds/${R}/status`, { expect: 200 });
await t("GET /chapters/{chapter_id}/voting-patterns", "none", `/chapters/${C}/voting-patterns`, { expect: DENIED });
await t("GET /chapters/{chapter_id}/voting-patterns", "member", `/chapters/${C}/voting-patterns`, { expect: 403 });
await t("GET /chapters/{chapter_id}/voting-patterns", "admin", `/chapters/${C}/voting-patterns`, { expect: 200 });
await t("GET /chapters/{chapter_id}/round-summary", "none", `/chapters/${C}/round-summary`, { expect: DENIED });
await t("GET /chapters/{chapter_id}/round-summary", "member", `/chapters/${NOBODY}/round-summary`, { expect: [403, 404], note: "another chapter" });
{
  // One request in place of the analytics page's per-round fan-out. Its
  // figures must match the per-round endpoint it replaces.
  const summary = await t("GET /chapters/{chapter_id}/round-summary", "member", `/chapters/${C}/round-summary`, { expect: 200 });
  const round = summary.json?.rounds?.find((r) => r.id === R);
  const detail = (await raw(member, "GET", `/api/v1/rounds/${R}/results`)).json || [];
  const mismatched = detail.filter((d) => {
    const s = round?.results?.find((x) => x.pnm_id === d.id);
    return !s || s.vote_count !== d.vote_count || Math.abs(s.yes_percentage - Number(d.yes_percentage)) > 0.01;
  });
  const votesInDb = Number(sql(`select count(*) from votes v join voting_rounds r on r.id=v.round_id where r.chapter_id='${C}'`)[0][0]);
  if (!round || mismatched.length || summary.json?.total_votes !== votesInDb) {
    results.push({ op: "GET /chapters/{chapter_id}/round-summary", as: "member", outcome: "FAIL",
      detail: `round found=${!!round}, ${mismatched.length} PNM(s) disagree with /rounds/{id}/results, total_votes=${summary.json?.total_votes} vs ${votesInDb} in the database` });
    console.log("  FAIL member round-summary disagrees with per-round results or the votes table");
  }
}

const cut = { mode: "top_n", value: 5, dry_run: true };
await t("POST /rounds/{round_id}/cutoff", "none", `/rounds/${R}/cutoff`, { body: cut, expect: DENIED });
await t("POST /rounds/{round_id}/cutoff", "member", `/rounds/${R}/cutoff`, { body: cut, expect: 403 });
{
  const before = Number(sql(`select count(*) from voting_rounds where chapter_id='${C}'`)[0][0]);
  await t("POST /rounds/{round_id}/cutoff", "admin", `/rounds/${R}/cutoff`, { body: cut, expect: 200, note: "dry run" });
  const after = Number(sql(`select count(*) from voting_rounds where chapter_id='${C}'`)[0][0]);
  if (before !== after) {
    results.push({ op: "POST /rounds/{round_id}/cutoff", as: "admin", outcome: "FAIL", detail: `dry run created a round: ${before} -> ${after}` });
    console.log(`  FAIL admin  cutoff dry_run created a round (${before} -> ${after})`);
  }
}

const roundBody = { type: "GENERAL", selected_pnm_ids: roster.slice(0, 4).map((p) => p.id) };
await t("POST /rounds", "none", `/rounds?chapter_id=${C}`, { body: roundBody, expect: DENIED });
await t("POST /rounds", "member", `/rounds?chapter_id=${C}`, { body: roundBody, expect: 403 });
const rr = await t("POST /rounds", "admin", `/rounds?chapter_id=${C}`, { body: roundBody, expect: OK });
const R2 = rr.json?.id || sql(`select id::text from voting_rounds where chapter_id='${C}' order by created_at desc limit 1`)[0]?.[0];
sql(`update voting_rounds set status='ACTIVE', started_at=coalesce(started_at, now()) where id='${R2}'`);

await t("POST /votes", "none", "/votes", { body: { round_id: R2, pnm_id: roster[0].id, choice: "YES" }, expect: DENIED });
await t("POST /votes", "member", "/votes", { body: { round_id: R2, pnm_id: roster[0].id, choice: "YES" }, expect: 200 });
await t("POST /votes", "member", "/votes", { body: { round_id: R2 }, expect: 400, note: "pnm_id missing" });
await t("POST /votes", "member", "/votes", { body: { round_id: R, pnm_id: roster[0].id, choice: "YES" }, expect: 400, note: "round is not active" });
await t("POST /votes", "member", "/votes", {
  body: { round_id: R2, pnm_id: roster[15].id, choice: "YES" }, expect: 400, note: "PNM is not in the round",
});

await t("PUT /rounds/{round_id}/end", "none", `/rounds/${R2}/end`, { expect: DENIED });
await t("PUT /rounds/{round_id}/end", "member", `/rounds/${R2}/end`, { expect: 403 });
await t("PUT /rounds/{round_id}/end", "admin", `/rounds/${R2}/end`, { expect: 200 });

// Open voting
await t("POST /rounds/open", "none", `/rounds/open?chapter_id=${C}`, { expect: DENIED });
await t("POST /rounds/open", "member", `/rounds/open?chapter_id=${C}`, {
  expect: 403, note: "this 403 is why the Open Voting tab is broken for members",
});
await t("POST /rounds/open", "admin", `/rounds/open?chapter_id=${C}`, { expect: OK });
await t("GET /rounds/open/current", "none", "/rounds/open/current", { expect: DENIED });
await t("GET /rounds/open/current", "member", "/rounds/open/current", { expect: 200 });
await t("GET /rounds/open/current", "member", `/rounds/open/current?chapter_id=${C}`, { expect: 200 });
await t("GET /rounds/open/current", "member", `/rounds/open/current?chapter_id=${NOBODY}`, { expect: [403, 404], note: "another chapter" });
{
  // The open round must never be a live session's round.
  const cur = await raw(member, "GET", `/api/v1/rounds/open/current?chapter_id=${C}`);
  const rid = cur.json?.round_id;
  if (rid && Number(sql(`select count(*) from sessions where round_id='${rid}'`)[0][0]) > 0) {
    results.push({ op: "GET /rounds/open/current", as: "member", outcome: "FAIL", detail: `open round ${rid} has a live session attached` });
    console.log("  FAIL member open round is a live session's round");
  }
}
sql(`update voting_rounds set status='ENDED', ended_at=now() where status='ACTIVE' and chapter_id='${C}'`);

// ------------------------------------------------------------------- sessions
await t("POST /sessions", "none", "/sessions", { body: { chapter_id: C }, expect: DENIED });
await t("POST /sessions", "member", "/sessions", { body: { chapter_id: C }, expect: 403 });
await t("POST /sessions", "admin", "/sessions", { body: { chapter_id: C, timer_seconds: 5 }, expect: 400, note: "timer under 10 s" });
const ss = await t("POST /sessions", "admin", "/sessions", { body: { chapter_id: C, timer_seconds: 60, anonymous: true }, expect: OK });
const S = ss.json?.id;
const SR = ss.json?.round_id;
const code = ss.json?.join_code;
await t("GET /sessions/active", "none", "/sessions/active", { expect: DENIED });
await t("GET /sessions/active", "member", "/sessions/active", { expect: 200 });
await t("POST /sessions/join", "none", "/sessions/join", { body: { join_code: code }, expect: DENIED });
await t("POST /sessions/join", "member", "/sessions/join", { body: { join_code: code }, expect: 200 });
await t("POST /sessions/join", "member", "/sessions/join", { body: { join_code: "ZZZZZ0" }, expect: 404, note: "wrong code" });
await t("GET /sessions/{session_id}/current", "none", `/sessions/${S}/current`, { expect: DENIED });
const cur = await t("GET /sessions/{session_id}/current", "member", `/sessions/${S}/current`, { expect: 200 });
await t("POST /sessions/{session_id}/lock", "none", `/sessions/${S}/lock`, { body: { locked: true }, expect: DENIED });
await t("POST /sessions/{session_id}/lock", "member", `/sessions/${S}/lock`, { body: { locked: true }, expect: 403 });
await t("POST /sessions/{session_id}/lock", "admin", `/sessions/${S}/lock`, { body: { locked: true }, expect: 200 });
await t("POST /votes", "member", "/votes", { body: { round_id: SR, pnm_id: cur.json?.pnm?.id, choice: "YES" }, expect: 409, note: "locked session" });
await t("POST /sessions/{session_id}/lock", "admin", `/sessions/${S}/lock`, { body: { locked: false }, expect: 200, note: "unlock" });
await t("POST /votes", "member", "/votes", { body: { round_id: SR, pnm_id: cur.json?.pnm?.id, choice: "YES" }, expect: 200, note: "unlocked session" });
{
  // "Anonymous" sessions: does the admin-only patterns endpoint still attribute votes?
  const rows = sql(`select count(*) from votes where round_id='${SR}' and voter_user_id='${member.id}'`)[0][0];
  if (Number(rows) > 0) {
    known.push({ op: "POST /sessions", as: "admin", status: 200, note: "anonymous:true still stores voter_user_id on every vote; the flag changes nothing" });
    console.log("  known admin  POST /sessions anonymous:true -> votes are still stored against the voter");
  }
}
await t("POST /sessions/{session_id}/advance", "none", `/sessions/${S}/advance`, { expect: DENIED });
await t("POST /sessions/{session_id}/advance", "member", `/sessions/${S}/advance`, { expect: 403 });
await t("POST /sessions/{session_id}/advance", "admin", `/sessions/${S}/advance`, { expect: 200 });
await t("POST /sessions/{session_id}/end", "none", `/sessions/${S}/end`, { expect: DENIED });
await t("POST /sessions/{session_id}/end", "member", `/sessions/${S}/end`, { expect: 403 });
await t("POST /sessions/{session_id}/end", "admin", `/sessions/${S}/end`, { expect: 200 });
await t("POST /sessions/{session_id}/end", "admin", `/sessions/${S}/end`, { expect: 404, note: "already ended" });
await t("GET /sessions/{session_id}/current", "member", `/sessions/${S}/current`, { expect: 404, note: "ended session" });

// ------------------------------------------------------------------ audit log
await t("GET /chapters/{chapter_id}/audit-log", "none", `/chapters/${C}/audit-log`, { expect: DENIED });
await t("GET /chapters/{chapter_id}/audit-log", "member", `/chapters/${C}/audit-log`, { expect: 403 });
await t("GET /chapters/{chapter_id}/audit-log", "exec", `/chapters/${C}/audit-log?limit=10`, { expect: 200 });

// ------------------------------------------------------- duplicates and merge
await t("GET /chapters/{chapter_id}/duplicates", "none", `/chapters/${C}/duplicates`, { expect: DENIED });
await t("GET /chapters/{chapter_id}/duplicates", "member", `/chapters/${C}/duplicates`, { expect: 403 });
await t("GET /chapters/{chapter_id}/duplicates", "admin", `/chapters/${C}/duplicates`, { expect: 200 });
await t("POST /pnms/{winner_id}/merge", "none", `/pnms/${W}/merge`, { body: { loser_id: L }, expect: DENIED });
await t("POST /pnms/{winner_id}/merge", "member", `/pnms/${W}/merge`, { body: { loser_id: L }, expect: 403 });
await t("POST /pnms/{winner_id}/merge", "admin", `/pnms/${W}/merge`, { body: { loser_id: L }, expect: 200 });
{
  const gone = sql(`select count(*) from pnms where id='${L}'`)[0][0] === "0";
  if (!gone) {
    results.push({ op: "POST /pnms/{winner_id}/merge", as: "admin", outcome: "FAIL", detail: "loser row still exists after merge" });
    console.log("  FAIL admin  merge left the loser row in place");
  }
}

// ------------------------------------------------------------------- bid list
await t("GET /chapters/me/bid-list", "none", "/chapters/me/bid-list", { expect: DENIED });
await t("GET /chapters/me/bid-list", "member", "/chapters/me/bid-list", { expect: 403 });
const bl = await t("GET /chapters/me/bid-list", "exec", "/chapters/me/bid-list", { expect: 200 });
const entries = bl.json?.entries || bl.json?.bid_list?.entries || [];
const BE = entries[0]?.pnm_id || entries[0]?.pnm?.id || sql(`select pnm_id::text from bid_list_entries limit 1`)[0]?.[0];
const newList = { source_round_id: R, name: `E2E ${stamp}` };
await t("POST /chapters/me/bid-list", "none", "/chapters/me/bid-list", { body: newList, expect: DENIED });
await t("POST /chapters/me/bid-list", "member", "/chapters/me/bid-list", { body: newList, expect: 403 });
await t("POST /chapters/me/bid-list", "admin", "/chapters/me/bid-list", { body: newList, expect: [200, 201, 400, 409], note: "a list already exists in the seed" });
await t("POST /chapters/me/bid-list/lock", "none", "/chapters/me/bid-list/lock", { expect: DENIED });
await t("POST /chapters/me/bid-list/lock", "member", "/chapters/me/bid-list/lock", { expect: 403 });
await t("POST /chapters/me/bid-list/lock", "admin", "/chapters/me/bid-list/lock", { expect: 200 });
await t("POST /chapters/me/bid-list/lock", "exec", "/chapters/me/bid-list/lock", { expect: [409, 423], note: "held by the admin" });
await t("POST /chapters/me/bid-list/lock/refresh", "none", "/chapters/me/bid-list/lock/refresh", { expect: DENIED });
await t("POST /chapters/me/bid-list/lock/refresh", "member", "/chapters/me/bid-list/lock/refresh", { expect: 403 });
await t("POST /chapters/me/bid-list/lock/refresh", "admin", "/chapters/me/bid-list/lock/refresh", { expect: 200 });
const move = { bucket: "bid", position: 0 };
await t("PATCH /chapters/me/bid-list/entries/{pnm_id}", "none", `/chapters/me/bid-list/entries/${BE}`, { body: move, expect: DENIED });
await t("PATCH /chapters/me/bid-list/entries/{pnm_id}", "member", `/chapters/me/bid-list/entries/${BE}`, { body: move, expect: 403 });
await t("PATCH /chapters/me/bid-list/entries/{pnm_id}", "exec", `/chapters/me/bid-list/entries/${BE}`, { body: move, expect: [409, 423], note: "exec does not hold the lock" });
await t("PATCH /chapters/me/bid-list/entries/{pnm_id}", "admin", `/chapters/me/bid-list/entries/${BE}`, { body: move, expect: 200 });
const outcome = { outcome: "declined", declined_reason: "e2e" };
await t("PATCH /chapters/me/bid-list/entries/{pnm_id}/outcome", "none", `/chapters/me/bid-list/entries/${BE}/outcome`, { body: outcome, expect: DENIED });
await t("PATCH /chapters/me/bid-list/entries/{pnm_id}/outcome", "member", `/chapters/me/bid-list/entries/${BE}/outcome`, { body: outcome, expect: 403 });
await t("PATCH /chapters/me/bid-list/entries/{pnm_id}/outcome", "exec", `/chapters/me/bid-list/entries/${BE}/outcome`, { body: outcome, expect: 200 });
await t("GET /chapters/me/bid-list/export/csv", "none", "/chapters/me/bid-list/export/csv", { expect: DENIED });
await t("GET /chapters/me/bid-list/export/csv", "member", "/chapters/me/bid-list/export/csv", { expect: 403 });
await t("GET /chapters/me/bid-list/export/csv", "admin", "/chapters/me/bid-list/export/csv", { expect: 200 });
await t("GET /chapters/me/bid-list/export/pdf", "none", "/chapters/me/bid-list/export/pdf", { expect: DENIED });
await t("GET /chapters/me/bid-list/export/pdf", "member", "/chapters/me/bid-list/export/pdf", { expect: 403 });
await t("GET /chapters/me/bid-list/export/pdf", "admin", "/chapters/me/bid-list/export/pdf", { expect: 200 });
await t("POST /chapters/me/bid-list/finalize", "none", "/chapters/me/bid-list/finalize", { expect: DENIED });
await t("POST /chapters/me/bid-list/finalize", "member", "/chapters/me/bid-list/finalize", { expect: 403 });
await t("POST /chapters/me/bid-list/finalize", "admin", "/chapters/me/bid-list/finalize", { expect: 200 });
await t("PATCH /chapters/me/bid-list/entries/{pnm_id}", "admin", `/chapters/me/bid-list/entries/${BE}`, {
  body: { bucket: "cut", position: 0 }, expect: 409, note: "a finalized bid list refuses edits",
});
await t("DELETE /chapters/me/bid-list/lock", "none", "/chapters/me/bid-list/lock", { expect: DENIED });
await t("DELETE /chapters/me/bid-list/lock", "member", "/chapters/me/bid-list/lock", { expect: 403 });
await t("DELETE /chapters/me/bid-list/lock", "admin", "/chapters/me/bid-list/lock", { expect: [200, 204] });

// ------------------------------------------------- another chapter's rows
// The second seeded chapter's admin is a full admin, of the wrong chapter. Every
// id below belongs to the main chapter; none of it may be read or changed.
{
  const O = fx.other;
  if (!O) {
    results.push({ op: "cross-chapter", as: "other", outcome: "FAIL", detail: "fixtures.json has no second chapter; reseed" });
    console.log("  FAIL fixtures.json has no second chapter; reseed with python3 e2e/guard.py --seed");
  } else {
    WHO.other = O.admin;
    const OC = O.chapter.id;
    const mainTag = sql(`select id::text from tags where chapter_id='${C}' order by label limit 1`)[0][0];
    const tagBefore = sql(`select label from tags where id='${mainTag}'`)[0][0];
    await t("PUT /tags/{tag_id}", "other", `/tags/${mainTag}?chapter_id=${OC}`, { body: { label: "hijacked", color: "#000000" }, expect: 404, note: "another chapter's tag" });
    await t("DELETE /tags/{tag_id}", "other", `/tags/${mainTag}?chapter_id=${OC}`, { expect: 404, note: "another chapter's tag" });
    await t("POST /pnms/{pnm_id}/tags/{tag_id}", "other", `/pnms/${O.pnm}/tags/${mainTag}`, { expect: 404, note: "another chapter's tag on own PNM" });
    await t("POST /pnms/{pnm_id}/tags/{tag_id}", "admin", `/pnms/${P}/tags/${O.tag}`, { expect: 404, note: "another chapter's tag on own PNM" });
    const tagAfter = sql(`select label from tags where id='${mainTag}'`)[0]?.[0];
    if (tagAfter !== tagBefore) {
      results.push({ op: "PUT /tags/{tag_id}", as: "other", outcome: "FAIL", detail: `tag label changed from "${tagBefore}" to "${tagAfter}"` });
      console.log("  FAIL another chapter's admin changed or deleted a tag");
    }
    await t("POST /chapters/me/bid-list", "other", "/chapters/me/bid-list", { body: { source_round_id: R, name: "stolen" }, expect: 404, note: "seeding from another chapter's round" });
    await t("POST /chapters/me/bid-list", "admin", "/chapters/me/bid-list", { body: { source_round_id: O.round, name: "stolen" }, expect: 404, note: "seeding from another chapter's round" });
    await t("POST /exports/pnm-cards/bulk", "other", "/exports/pnm-cards/bulk", { body: { chapter_id: OC, pnm_ids: [P] }, expect: 404, note: "another chapter's PNM with own chapter_id" });
    await t("POST /exports/pnm-cards/bulk", "other", "/exports/pnm-cards/bulk", { body: { pnm_ids: [P] }, expect: 403, note: "another chapter's PNM" });
    await t("POST /events/{event_id}/attendance", "other", `/events/${O.event}/attendance`, { body: { event_id: EV, pnm_id: P }, expect: 404, note: "body names another chapter's event and PNM" });
    const leaked = sql(`select count(*) from event_attendance ea join pnms p on p.id = ea.pnm_id join events e on e.id = ea.event_id where p.chapter_id <> e.chapter_id`)[0][0];
    if (leaked !== "0") {
      results.push({ op: "POST /events/{event_id}/attendance", as: "other", outcome: "FAIL", detail: `${leaked} attendance row(s) link a PNM to another chapter's event` });
      console.log("  FAIL attendance was written across chapters");
    }
    await t("GET /rounds", "other", `/rounds?chapter_id=${C}`, { expect: 403, note: "another chapter's rounds" });
    await t("GET /pnms/{pnm_id}", "other", `/pnms/${P}`, { expect: [403, 404], note: "another chapter's PNM" });
    await t("GET /rounds/{round_id}/results", "other", `/rounds/${R}/results`, { expect: [403, 404], note: "another chapter's results" });
  }
}

// --------------------------------------------------- archive, delete (last)
const arch = { pnm_ids: [P2], archived: true };
await t("POST /pnms/bulk-archive", "none", "/pnms/bulk-archive", { body: arch, expect: DENIED });
await t("POST /pnms/bulk-archive", "member", "/pnms/bulk-archive", { body: arch, expect: 403 });
await t("POST /pnms/bulk-archive", "admin", "/pnms/bulk-archive", { body: arch, expect: 200 });
await t("DELETE /pnms/{pnm_id}", "none", `/pnms/${P2}`, { expect: DENIED });
await t("DELETE /pnms/{pnm_id}", "member", `/pnms/${P2}`, { expect: 403 });
await t("DELETE /pnms/{pnm_id}", "admin", `/pnms/${P2}`, { expect: [200, 204] });
await t("GET /pnms/{pnm_id}", "member", `/pnms/${P2}`, { expect: 404, note: "deleted" });

// ----------------------------------------- chapter creation (cleaned up after)
// Provisioning lets a signed-in user create a chapter and become its admin; that
// is self-serve signup. The chapter is given the guard's temporary-chapter prefix
// and removed straight away. The unguarded POST /chapters is gone.
{
  const before = new Set(sql("select id::text from chapters").map((r) => r[0]));
  const TEMP_A = `${TEMP_CHAPTER_PREFIX}${stamp} a`;
  const TEMP_B = `${TEMP_CHAPTER_PREFIX}${stamp} b`;
  const gone = await raw(member, "POST", "/api/v1/chapters", { body: { name: TEMP_A } });
  results.push({ op: "POST /chapters (removed)", as: "member", status: gone.status, expect: [404, 405], outcome: [404, 405].includes(gone.status) ? "pass" : "FAIL", detail: gone.text.slice(0, 120) });
  if (![404, 405].includes(gone.status)) console.log(`  FAIL POST /chapters should be gone, got ${gone.status}`);
  const prov = { fraternity_name: "Beta Theta Pi", school: "E2E School", chapter_name: TEMP_B, admin_name: "E2E Founder" };
  await t("POST /chapters/provision", "none", "/chapters/provision", { body: prov, expect: DENIED });
  await t("POST /chapters/provision", "member", "/chapters/provision", { body: prov, expect: OK });
  await t("POST /chapters/provision", "member", "/chapters/provision", { body: prov, expect: OK, note: "idempotent for the same user, name and school" });
  const created = sql("select id::text from chapters").map((r) => r[0]).filter((id) => !before.has(id));
  if (created.length !== 1) {
    results.push({ op: "POST /chapters/provision", as: "member", outcome: "FAIL", detail: `expected 1 new chapter, found ${created.length}` });
    console.log(`  FAIL chapter creation produced ${created.length} new chapters, expected 1`);
  }
  for (const id of created) {
    sql(`delete from memberships where chapter_id='${id}'`);
    sql(`delete from chapters where id='${id}'`);
  }
}

// ------------------------------------------------------------------- coverage
const spec = (await raw(null, "GET", "/openapi.json")).json;
const ops = [];
for (const [path, methods] of Object.entries(spec?.paths || {})) {
  if (path.startsWith("/api/") && !path.startsWith("/api/v1/")) continue; // legacy mount, same handlers
  for (const method of Object.keys(methods)) {
    ops.push(`${method.toUpperCase()} ${path.replace(/^\/api\/v1/, "")}`);
  }
}
const uncovered = [...new Set(ops)].filter((op) => !covered.has(op));
const stale = [...covered].filter((op) => !ops.includes(op));

// Each compat-mounted route should exist too.
const legacyCount = Object.keys(spec?.paths || {}).filter((p) => p.startsWith("/api/") && !p.startsWith("/api/v1/")).length;
const v1Count = Object.keys(spec?.paths || {}).filter((p) => p.startsWith("/api/v1/")).length;

const fails = results.filter((r) => r.outcome === "FAIL");
const ext = results.filter((r) => r.outcome === "external");
const slow = results.filter((r) => r.ms > 1500 && r.outcome !== "external").sort((a, b) => b.ms - a.ms).slice(0, 10);

console.log(`\n=== ${results.length} assertions over ${covered.size} operations ===`);
console.log(`  passed      ${results.filter((r) => r.outcome === "pass").length}`);
console.log(`  FAILED      ${fails.length}`);
console.log(`  known       ${known.length}  (defects already listed in docs/reboot-2026-11/02-unfinished-and-broken.md)`);
console.log(`  external    ${ext.length}  (need Supabase/MailerLite; only auth and role were asserted)`);
console.log(`  uncovered   ${uncovered.length}${uncovered.length ? "  -> " + uncovered.join(", ") : ""}`);
if (stale.length) console.log(`  stale cases ${stale.length}  -> ${stale.join(", ")}  (no longer in openapi.json)`);
console.log(`  mounts      /api/v1 has ${v1Count} paths, legacy /api has ${legacyCount}`);
if (slow.length) console.log(`  slowest     ${slow.map((s) => `${s.op} ${s.ms}ms`).join("; ")}`);
for (const k of known) console.log(`  known: ${k.op} as ${k.as} -> ${k.status}: ${k.note}`);

writeFileSync(
  join(ROOT, "report-api-contract.json"),
  JSON.stringify({ script: "api-contract", api: API, operations: ops.length, covered: covered.size, uncovered, stale, known, external: ext, fails, results }, null, 2)
);
console.log("report: e2e/report-api-contract.json");
console.log("Reseed before running anything else: python3 e2e/guard.py --seed");

process.exit(fails.length || uncovered.length ? 1 : 0);
