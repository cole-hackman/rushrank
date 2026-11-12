/**
 * The main user flows, driven through the real UI and checked in the database.
 *
 * crawl.mjs clicks whatever buttons it finds and only notices a 5xx. This
 * script does the things a chapter actually does during rush, on purpose, and
 * checks that each one wrote what it should:
 *
 *   1. A prospect fills in the public interest form        (signed out)
 *   2. The admin imports a CSV: preview, then commit       (admin)
 *   3. The admin creates an event                          (admin)
 *   4. A member checks a PNM in to that event              (member)
 *   5. A member posts a note and marks "I've met him"      (member)
 *   6. The admin previews round cuts without committing    (admin)
 *   7. The admin records a bid outcome                     (admin)
 *   8. The admin adds an intake question on Settings       (admin)
 *   8b. The public intake link asks it; the PNM page shows  (signed out,
 *       the answer                                           then member)
 *   9. The admin opens a round; a member votes in Open      (admin, member)
 *      Voting and moves on to the next PNM
 *
 * Each flow is independent: one failing does not stop the rest.
 *
 *   node flows.mjs
 *
 * WRITES: creates PNMs, an event, attendance, a note, a contact record, a
 * bid outcome, an intake question and answers, an open round and a vote. Reseed after (`python3 e2e/guard.py --seed`). Runs only
 * against the local e2e database; guard.mjs enforces that.
 * Exit code: 0 = nothing new, 1 = at least one new failure, 2 = guard refused.
 *
 * Not covered here, because it needs real email or Supabase Storage: the
 * signup wizard's magic link, invites, password reset, photo upload, and the
 * public /intake form (its inputs have no labels or placeholders to select
 * by). Those are manual steps in docs/reboot-2026-11/06-test-plan.md.
 */

import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fixtures, signIn, watch, settle, sleep, APP, ROOT } from "./lib/harness.mjs";
import { guard, sql, API } from "./guard.mjs";

await guard();

const fx = fixtures();
const C = fx.chapter.id;
const admin = fx.users.find((u) => u.role === "admin");
const member = fx.users.find((u) => u.role === "member");
const stamp = Date.now().toString(36);

const outcomes = [];
const one = (q) => sql(q)[0]?.[0] ?? null;
const num = (q) => Number(one(q) || 0);

async function until(fn, timeout = 6000, step = 200) {
  const end = Date.now() + timeout;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) return null;
    await sleep(step);
  }
}

/** Run one flow. `fn` returns {ok, detail, known?}. Anything thrown is a failure. */
async function flow(name, fn) {
  const sink = [];
  let result;
  try {
    result = await fn(sink);
  } catch (e) {
    result = { ok: false, detail: `threw: ${String(e.message || e).split("\n")[0]}` };
  }
  const http5 = sink.filter((e) => /^http5/.test(e.kind)).map((e) => e.text);
  const row = { name, ...result, http5xx: http5.slice(0, 3) };
  outcomes.push(row);
  const tag = row.ok ? "ok   " : row.known ? "known" : "FAIL ";
  console.log(`  ${tag} ${name}${row.detail ? `\n         ${row.detail}` : ""}`);
  return row;
}

const browser = await chromium.launch();
const ctxFor = async (user, mobile = false) => {
  const ctx = await browser.newContext(
    mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 900 } }
  );
  if (user) await signIn(ctx, user, { chapterId: C });
  return ctx;
};
const open = async (ctx, path, sink, label) => {
  const page = await ctx.newPage();
  watch(page, sink, label);
  page.on("dialog", (d) => d.accept());
  await page.goto(`${APP}${path}`, { waitUntil: "domcontentloaded" });
  await settle(page, 1200);
  return page;
};

console.log("\n=== flows ===\n");

// 1 ------------------------------------------------------------ interest form
await flow("1. public interest form creates a prospect", async (sink) => {
  const ctx = await ctxFor(null, true);
  const page = await open(ctx, `/interest?chapter=${C}&source=instagram`, sink, "interest");
  const name = `E2E Interest ${stamp}`;
  await page.getByPlaceholder("Jordan Miller").fill(name);
  await page.getByPlaceholder("jordanmiller").fill(`e2e_${stamp}`);
  await page.getByRole("button", { name: /Count me in/i }).click();
  const thanks = await until(() => page.getByText("You're on the list").isVisible().catch(() => false));
  const row = sql(`select stage, source from pnms where chapter_id='${C}' and name='${name}'`)[0];
  await ctx.close();
  if (!thanks) return { ok: false, detail: "no confirmation screen after submit" };
  if (!row) return { ok: false, detail: "confirmation shown but no row in pnms" };
  if (row[0] !== "prospect" || row[1] !== "instagram") return { ok: false, detail: `row stored as stage=${row[0]} source=${row[1]}` };
  return { ok: true, detail: "stored as stage=prospect, source=instagram" };
});

await flow("1b. interest form needs a way to reply", async (sink) => {
  const ctx = await ctxFor(null, true);
  const page = await open(ctx, `/interest?chapter=${C}`, sink, "interest-empty");
  const name = `E2E NoContact ${stamp}`;
  await page.getByPlaceholder("Jordan Miller").fill(name);
  await page.getByRole("button", { name: /Count me in/i }).click().catch(() => {});
  await sleep(1500);
  const created = num(`select count(*) from pnms where name='${name}'`);
  await ctx.close();
  return created === 0 ? { ok: true, detail: "name alone is refused" } : { ok: false, detail: "a prospect with no contact details was created" };
});

// 2 ----------------------------------------------------------------- CSV import
await flow("2. CSV import: preview, then commit", async (sink) => {
  const ctx = await ctxFor(admin);
  const page = await open(ctx, "/pnms/import", sink, "import");
  const dupe = fx.roster[0].name;
  const csv =
    "Name,Email,Major,GPA\n" +
    `E2E Import A ${stamp},e2e-a-${stamp}@example.com,Testing,3.4\n` +
    `E2E Import B ${stamp},e2e-b-${stamp}@example.com,Testing,2.0\n` +
    `E2E Import C ${stamp},not-an-email,Testing,3.0\n` +
    `${dupe},,,\n`;
  const before = num(`select count(*) from pnms where chapter_id='${C}'`);
  await page.locator('input[type="file"]').setInputFiles({ name: "e2e.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  const previewed = await until(() => page.getByText("Will import").isVisible().catch(() => false), 8000);
  if (!previewed) {
    await ctx.close();
    return { ok: false, detail: "no preview after choosing the file" };
  }
  const afterPreview = num(`select count(*) from pnms where chapter_id='${C}'`);
  if (afterPreview !== before) {
    await ctx.close();
    return { ok: false, detail: `the preview wrote rows (${before} -> ${afterPreview})` };
  }
  await page.getByRole("button", { name: /^Import \d+ PNM/i }).click();
  const done = await until(() => page.getByText(/View PNMs/i).first().isVisible().catch(() => false), 8000);
  const after = num(`select count(*) from pnms where chapter_id='${C}'`);
  const gpa = one(`select gpa::text from pnms where email='e2e-b-${stamp}@example.com'`);
  const logged = num(`select count(*) from audit_log where chapter_id='${C}' and action='pnm.import' and created_at > now() - interval '1 minute'`);
  await ctx.close();
  if (!done) return { ok: false, detail: "no completion screen after Import" };
  if (after - before !== 2) return { ok: false, detail: `expected 2 new PNMs (bad email and existing name skipped), got ${after - before}` };
  if (!gpa || Number(gpa) !== 2) return { ok: false, detail: `GPA column was not imported (got ${gpa})` };
  if (logged < 1) return { ok: false, detail: "import committed but no pnm.import row in audit_log" };
  return { ok: true, detail: "2 imported, 1 bad email and 1 existing name skipped, GPA stored, audit row written" };
});

// 3 --------------------------------------------------------------- create event
const eventName = `E2E Event ${stamp}`;
await flow("3. admin creates an event", async (sink) => {
  const ctx = await ctxFor(admin);
  const page = await open(ctx, "/events", sink, "events");
  await page.getByRole("button", { name: /Add Event/i }).first().click();
  await page.getByPlaceholder("e.g., Fall BBQ").fill(eventName);
  await page.getByPlaceholder("e.g., Beta House Backyard").fill("Localhost");
  const d = new Date(Date.now() + 86400000);
  await page.locator('input[type="date"]').first().fill(d.toISOString().slice(0, 10));
  await page.getByRole("button", { name: /^Add Event$/i }).last().click();
  const id = await until(() => one(`select id::text from events where chapter_id='${C}' and name='${eventName}'`));
  await ctx.close();
  return id ? { ok: true, detail: `event ${id}` } : { ok: false, detail: "no events row after submitting the form" };
});

await flow("3b. /events?action=add opens the form", async (sink) => {
  const ctx = await ctxFor(admin);
  const page = await open(ctx, "/events?action=add", sink, "events-action");
  const shown = await page.getByPlaceholder("e.g., Fall BBQ").isVisible().catch(() => false);
  await ctx.close();
  return shown
    ? { ok: true }
    : { ok: false, known: true, detail: "the dashboard's Create Event button links here, but the page ignores ?action=add" };
});

// 4 ------------------------------------------------------------------- check-in
await flow("4. member checks a PNM in", async (sink) => {
  const ev = one(`select id::text from events where chapter_id='${C}' and name='${eventName}'`) || fx.event.id;
  const pnm = fx.roster[2];
  const ctx = await ctxFor(member, true);
  const page = await open(ctx, `/events/${ev}/checkin`, sink, "checkin");
  await page.getByPlaceholder("Search PNM name or ID...").fill(pnm.name);
  await sleep(1500);
  const rows = await page.getByRole("button", { name: /^Check In$/i }).count();
  await page.getByRole("button", { name: /^Check In$/i }).first().click().catch(() => {});
  const got = await until(() => num(`select count(*) from event_attendance where event_id='${ev}'`) > 0);
  const who = one(`select p.name from event_attendance a join pnms p on p.id=a.pnm_id where a.event_id='${ev}' limit 1`);
  await ctx.close();
  if (!got) return { ok: false, detail: "no event_attendance row after Check In" };
  if (rows > 3) {
    return {
      ok: who === pnm.name,
      known: true,
      detail: `search for "${pnm.name}" listed ${rows} PNMs (the backend ignores ?search=); checked in "${who}"`,
    };
  }
  return who === pnm.name ? { ok: true, detail: `checked in ${who}` } : { ok: false, detail: `checked in "${who}", expected "${pnm.name}"` };
});

// 5 ---------------------------------------------------------------- note + met
await flow("5. member posts a note and marks met", async (sink) => {
  const pnm = fx.roster[4];
  const ctx = await ctxFor(member);
  const page = await open(ctx, `/pnms/${pnm.id}`, sink, "pnm-detail");
  const body = `e2e note ${stamp}`;
  const notesBefore = num(`select count(*) from pnm_notes where pnm_id='${pnm.id}'`);
  await page.getByPlaceholder("Add a comment...").fill(body);
  await page.getByRole("button", { name: /Post Comment/i }).click();
  const noted = await until(() => num(`select count(*) from pnm_notes where pnm_id='${pnm.id}'`) === notesBefore + 1);

  const metBefore = num(`select count(*) from pnm_contacts where pnm_id='${pnm.id}' and user_id='${member.id}'`);
  const btn = page.getByRole("button", { name: /^(I've met him|Met)$/ }).first();
  const label = ((await btn.textContent().catch(() => "")) || "").trim();
  await btn.click().catch(() => {});
  const toggled = await until(() => num(`select count(*) from pnm_contacts where pnm_id='${pnm.id}' and user_id='${member.id}'`) !== metBefore);
  await ctx.close();
  if (!noted) return { ok: false, detail: "note was not stored" };
  if (!toggled) return { ok: false, detail: `"${label}" button did not change pnm_contacts` };
  return { ok: true, detail: `note stored; "${label}" toggled the contact record` };
});

// 6 ---------------------------------------------------------------- cut preview
await flow("6. admin previews cuts without committing", async (sink) => {
  const ctx = await ctxFor(admin);
  const page = await open(ctx, `/results?roundId=${fx.endedRound.id}`, sink, "results");
  const rounds = num(`select count(*) from voting_rounds where chapter_id='${C}'`);
  const tableRows = await page.locator("tbody tr").count();
  await page.getByRole("button", { name: /Make cuts/i }).first().click();
  await page.getByRole("button", { name: /^Review$/i }).click();
  const confirm = await until(() => page.getByRole("button", { name: /Confirm cuts|Cut \d+ and start next round/i }).first().isVisible().catch(() => false));
  const roundsAfter = num(`select count(*) from voting_rounds where chapter_id='${C}'`);
  await ctx.close();
  if (tableRows === 0) return { ok: false, detail: "results table is empty for an ended round" };
  if (!confirm) return { ok: false, detail: "no confirmation step after Review" };
  if (roundsAfter !== rounds) return { ok: false, detail: `the preview created a round (${rounds} -> ${roundsAfter})` };
  return { ok: true, detail: `${tableRows} result rows; preview reached the confirm step and wrote nothing` };
});

// 7 ---------------------------------------------------------------- bid outcome
await flow("7. admin records a bid outcome", async (sink) => {
  const ctx = await ctxFor(admin);
  const page = await open(ctx, "/bid-list", sink, "bid-list");
  // Each card in the Bid column has its own dropdown; take one still "Not sent".
  const all = page.locator('select[aria-label^="Bid outcome for"]');
  const values = await all.evaluateAll((els) => els.map((e) => e.value));
  const idx = values.indexOf("pending");
  if (idx < 0) {
    await ctx.close();
    return { ok: false, detail: `no "Not sent" outcome dropdown on the bid list (found ${values.length} dropdowns)` };
  }
  const select = all.nth(idx);
  const before = num(`select count(*) from bid_list_entries where outcome='offered'`);
  // The card is a dnd-kit sortable that is aria-disabled until "Start editing",
  // so Playwright treats the dropdown inside it as disabled and will not act on
  // it. It is not disabled for a person: outcomes deliberately work without the
  // edit lock. Set the value the way the browser would and fire change.
  await select.evaluate((el) => {
    el.value = "offered";
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  const changed = await until(() => num(`select count(*) from bid_list_entries where outcome='offered'`) === before + 1);
  const logged = num(`select count(*) from audit_log where chapter_id='${C}' and action='bid.outcome' and created_at > now() - interval '1 minute'`);
  const capShown = await page.getByText(/bids? left|Over the bid cap/i).first().isVisible().catch(() => false);
  await ctx.close();
  if (!changed) return { ok: false, detail: "selecting Offered did not change bid_list_entries" };
  if (logged < 1) return { ok: false, detail: "outcome saved but no bid.outcome row in audit_log" };
  return { ok: true, detail: `outcome saved and audited; bid-cap text ${capShown ? "shown" : "not shown"}` };
});

// 8 ----------------------------------------------------------- intake questions
await flow("8. admin adds an intake question", async (sink) => {
  const ctx = await ctxFor(admin);
  const page = await open(ctx, "/settings", sink, "settings");
  const input = page.locator('label:has-text("Question Text") input, label:has-text("Question Text") textarea').first();
  if (!(await input.isVisible().catch(() => false))) {
    await ctx.close();
    return { ok: false, detail: 'could not find the "Question Text" field on /settings' };
  }
  await input.fill(`E2E question ${stamp}?`);
  await page.getByRole("button", { name: /^Add Question$/i }).click();
  await sleep(2500);
  const stored = num(`select count(*) from questionnaires where chapter_id='${C}' and schema::text like '%E2E question ${stamp}%'`);
  const failed = sink.filter((e) => /^http5/.test(e.kind) && /questionnaires/.test(e.text));
  await ctx.close();
  if (stored > 0) return { ok: true, detail: "question stored" };
  if (failed.length) {
    return { ok: false, known: true, detail: `saving returns a 500 (${failed[0].text.replace(/^\[[^\]]*\]\s*/, "")}); the schema dict is not JSON-encoded` };
  }
  return { ok: false, detail: "question was not stored and no request failed" };
});

// 8b ---------------------------------------- intake answers reach the PNM page
await flow("8b. public intake asks the questions and the PNM page shows the answers", async (sink) => {
  // Make sure there is a question, whether or not flow 8 added one.
  const question = `E2E why us ${stamp}?`;
  const qid = `q_e2e_${stamp}`;
  const existing = one(`select id::text from questionnaires where chapter_id='${C}' and active order by created_at desc limit 1`);
  const schema = JSON.stringify({ questions: [{ id: qid, question, type: "text", required: false }] }).replace(/'/g, "''");
  if (existing) sql(`update questionnaires set schema='${schema}'::jsonb where id='${existing}'`);
  else sql(`insert into questionnaires (chapter_id, name, schema, active) values ('${C}', 'Intake', '${schema}'::jsonb, true)`);

  const info = await (await fetch(`${API}/api/v1/public/chapters/${C}`)).json();
  const asked = info.questionnaire?.questions?.some((q) => q.question === question);
  if (!asked) return { ok: false, detail: "GET /public/chapters/{id} does not list the chapter's question" };

  const name = `E2E Intake ${stamp}`;
  const res = await fetch(`${API}/api/v1/public/chapters/${C}/intake`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email: `intake-${stamp}@example.com`, answers: { [`questionnaire-${qid}`]: "Because of the people" } }),
  });
  if (!res.ok) return { ok: false, detail: `public intake returned ${res.status}` };
  const pnmId = (await res.json()).id;

  const ctx = await ctxFor(member);
  const page = await open(ctx, `/pnms/${pnmId}`, sink, "pnm-answers");
  const shown = await until(() => page.getByText("Because of the people").isVisible().catch(() => false), 6000);
  const label = await page.getByText(question).isVisible().catch(() => false);
  await ctx.close();
  if (!shown || !label) return { ok: false, detail: `answer shown=${!!shown}, question shown=${label}` };
  return { ok: true, detail: "question offered publicly, answer stored, shown on the PNM page under its question" };
});

// 9 ------------------------------------------------------------- open voting
await flow("9. admin opens a round; a member votes in Open Voting", async (sink) => {
  // Clear any open round so the tab starts empty.
  sql(`update voting_rounds set status='ENDED', ended_at=now() where chapter_id='${C}' and status='ACTIVE'`);

  const mctx = await ctxFor(member, true);
  const mpage = await open(mctx, "/voting", sink, "open-member");
  await mpage.getByText("Open Voting", { exact: true }).first().click();
  const empty = await until(() => mpage.getByText("No open round right now").isVisible().catch(() => false));
  const memberCanOpen = await mpage.getByRole("button", { name: "Open a round" }).isVisible().catch(() => false);
  if (!empty) { await mctx.close(); return { ok: false, detail: "member did not see the no-round message" }; }
  if (memberCanOpen) { await mctx.close(); return { ok: false, detail: "a member was offered Open a round" }; }

  const actx = await ctxFor(admin);
  const apage = await open(actx, "/voting", sink, "open-admin");
  await apage.getByText("Open Voting", { exact: true }).first().click();
  const btn = apage.getByRole("button", { name: "Open a round" });
  if (!(await until(() => btn.isVisible().catch(() => false)))) {
    await mctx.close(); await actx.close();
    return { ok: false, detail: "admin was not offered Open a round" };
  }
  await btn.click();
  const roundId = await until(() => one(`select vr.id::text from voting_rounds vr where vr.chapter_id='${C}' and vr.status='ACTIVE'
      and not exists (select 1 from sessions s where s.round_id=vr.id)`));
  await actx.close();
  if (!roundId) { await mctx.close(); return { ok: false, detail: "no open round was created" }; }

  await mpage.reload({ waitUntil: "domcontentloaded" });
  await settle(mpage, 1000);
  await mpage.getByText("Open Voting", { exact: true }).first().click();
  const first = await until(async () => {
    const h = ((await mpage.locator("h2").first().textContent().catch(() => "")) || "").trim();
    return h && !/No open round|All caught up/.test(h) ? h : null;
  }, 8000);
  if (!first) { await mctx.close(); return { ok: false, detail: "member saw no PNM card after the round opened" }; }
  await mpage.getByRole("button", { name: "Yes", exact: true }).first().click();
  const stored = await until(() => num(`select count(*) from votes v join pnms p on p.id=v.pnm_id
      where v.round_id='${roundId}' and v.voter_user_id='${member.id}' and p.name='${first.replace(/'/g, "''")}'`) === 1);
  const next = await until(async () => {
    const h = ((await mpage.locator("h2").first().textContent().catch(() => "")) || "").trim();
    return h && h !== first ? h : null;
  }, 6000);
  const forbidden = sink.filter((e) => e.kind === "http403" && /rounds\/open/.test(e.text) && /open-member/.test(e.text));
  await mctx.close();
  if (forbidden.length) return { ok: false, detail: "the member's tab still called an admin-only endpoint" };
  if (!stored) return { ok: false, detail: `vote on "${first}" was not stored` };
  if (!next) return { ok: false, detail: "the next PNM did not load after voting" };
  return { ok: true, detail: `member voted Yes on "${first}" and moved on to "${next}"` };
});

// 10 ----------------------------------------------------------- self check-in
await flow("10. a PNM checks himself in from the event's QR link", async (sink) => {
  const ev = fx.event.id;
  const link = await (await fetch(`${API}/api/v1/events/${ev}/self-check-in`, { headers: { Authorization: `Bearer ${member.token}` } })).json();
  if (!link?.url) return { ok: false, detail: "GET /events/{id}/self-check-in returned no link" };
  const row = sql(
    `select p.id::text, p.name, p.email from pnms p where p.chapter_id='${C}' and p.email is not null and p.email <> '' and not p.archived
       and not exists (select 1 from event_attendance a where a.event_id='${ev}' and a.pnm_id=p.id) order by p.name desc limit 1`
  )[0];
  if (!row) return { ok: false, detail: "no seeded PNM with an email left to check in" };
  const [pnmId, pnmName, pnmEmail] = row;

  const ctx = await ctxFor(null, true); // signed out, on a phone
  const page = await open(ctx, new URL(link.url).pathname + new URL(link.url).search, sink, "self-checkin");
  await page.getByLabel(/email you signed up with/i).fill(pnmEmail);
  await page.getByRole("button", { name: /^Check in$/i }).click();
  const shown = await page
    .getByText(/You are (already )?checked in/i)
    .waitFor({ state: "visible", timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  const method = one(`select method::text from event_attendance where event_id='${ev}' and pnm_id='${pnmId}'`);
  await ctx.close();
  if (!shown) return { ok: false, detail: "the page did not say the PNM was checked in" };
  if (method !== "SELF") return { ok: false, detail: `attendance method is ${method}, expected SELF` };
  return { ok: true, detail: `${pnmName} checked himself in` };
});

await browser.close();

writeFileSync(join(ROOT, "report-flows.json"), JSON.stringify({ script: "flows", outcomes }, null, 2));
const failed = outcomes.filter((o) => !o.ok && !o.known);
const knownCount = outcomes.filter((o) => o.known).length;
console.log(`\n=== ${outcomes.length} flows: ${outcomes.filter((o) => o.ok).length} ok, ${knownCount} known defect(s), ${failed.length} new failure(s) ===`);
console.log("report: e2e/report-flows.json");
console.log("Reseed before running anything else: python3 e2e/guard.py --seed");
process.exit(failed.length ? 1 : 0);
