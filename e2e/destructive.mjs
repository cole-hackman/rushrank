/**
 * The controls the crawler refuses to press.
 *
 * crawl.mjs skips anything matching delete/archive/merge/end-session so one
 * click cannot empty the fixture and make every later page look empty for the
 * wrong reason. That leaves the most consequential buttons in the app
 * untested, so they get their own pass here — each one driven through the UI
 * and then checked against the database, because "the toast said it worked" is
 * not evidence.
 *
 *   node destructive.mjs
 */

import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fixtures, signIn, watch, settle, sleep, APP, ROOT } from "./lib/harness.mjs";

const sql = (q) =>
  execFileSync("psql", [process.env.E2E_DATABASE_URL, "-tAF", "|", "-c", q], {
    encoding: "utf8",
    env: { ...process.env, PATH: `/opt/homebrew/opt/libpq@17/bin:${process.env.PATH}` },
  })
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => l.split("|"));

const one = (q) => (sql(q)[0] || [null])[0];

const fx = fixtures();
const chair = fx.users.find((u) => u.role === "admin");
const findings = [];
const errors = [];
const results = [];
const note = (severity, title, detail) => {
  findings.push({ severity, title, detail });
  console.log(`   [${severity}] ${title}\n         ${detail}`);
};
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`);
  if (!ok) note("high", name, detail);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await signIn(ctx, chair, { chapterId: fx.chapter.id });
const page = await ctx.newPage();
watch(page, errors, "destructive");

// These flows confirm through native window.confirm(). Playwright dismisses
// native dialogs when nothing is listening, which silently cancels the very
// action under test and makes a working feature look broken.
const dialogs = [];
page.on("dialog", async (d) => {
  dialogs.push(d.message());
  await d.accept();
});

// ---------------------------------------------------------------- duplicates
// The FK guard in merge_pnms was extended for pnm_contacts during this session;
// this is the flow that exercises it end to end.
console.log("\n=== merge duplicates ===");
await page.goto(`${APP}/admin/duplicates`, { waitUntil: "domcontentloaded" });
await settle(page, 1200);

const dupGroupsBefore = Number(one(`
  select count(*) from (
    select lower(name) from pnms where chapter_id='${fx.chapter.id}' and archived=false
    group by lower(name) having count(*) > 1
  ) g`));
console.log(`duplicate name groups in DB: ${dupGroupsBefore}`);

const pnmsBefore = Number(one(`select count(*) from pnms where chapter_id='${fx.chapter.id}'`));
// The control is labelled "Keep this one" -- you pick the survivor, rather
// than pressing a button called Merge.
const mergeBtn = page.getByRole("button", { name: /Keep this one|^Merge/i }).first();
if (await mergeBtn.isVisible().catch(() => false)) {
  // Capture the pair so the contact/note reassignment can be verified after.
  const notesBefore = Number(one(`select count(*) from pnm_notes`));
  const contactsBefore = Number(one(`select count(*) from pnm_contacts`));
  const votesBefore = Number(one(`select count(*) from votes`));

  await mergeBtn.click();
  await sleep(700);
  // Confirm dialog, if the UI asks.
  for (const label of [/^Merge$/i, /^Confirm/i, /^Yes/i]) {
    const c = page.getByRole("button", { name: label }).last();
    if (await c.isVisible().catch(() => false)) {
      await c.click().catch(() => {});
      break;
    }
  }
  await sleep(1800);

  const pnmsAfter = Number(one(`select count(*) from pnms where chapter_id='${fx.chapter.id}'`));
  const notesAfter = Number(one(`select count(*) from pnm_notes`));
  const contactsAfter = Number(one(`select count(*) from pnm_contacts`));
  const votesAfter = Number(one(`select count(*) from votes`));
  const orphanNotes = Number(one(`select count(*) from pnm_notes n left join pnms p on p.id=n.pnm_id where p.id is null`));
  const orphanContacts = Number(one(`select count(*) from pnm_contacts c left join pnms p on p.id=c.pnm_id where p.id is null`));

  check("merge removes exactly one PNM", pnmsAfter === pnmsBefore - 1, `${pnmsBefore} -> ${pnmsAfter}`);
  check("merge leaves no orphaned notes", orphanNotes === 0, `${orphanNotes} orphans`);
  check("merge leaves no orphaned contacts", orphanContacts === 0, `${orphanContacts} orphans`);
  check(
    "merge does not silently drop child rows",
    notesAfter === notesBefore && contactsAfter <= contactsBefore && votesAfter <= votesBefore,
    `notes ${notesBefore}->${notesAfter}, contacts ${contactsBefore}->${contactsAfter}, votes ${votesBefore}->${votesAfter}`
  );
} else {
  console.log("  (no merge button on screen — duplicates page rendered nothing to merge)");
  if (dupGroupsBefore > 0) {
    note("high", "Duplicates exist but the page offers no merge",
      `${dupGroupsBefore} duplicate name group(s) in the database, no Merge control rendered`);
  }
}

// -------------------------------------------------------------------- archive
console.log("\n=== archive a PNM ===");
await page.goto(`${APP}/pnms`, { waitUntil: "domcontentloaded" });
await settle(page, 1200);
const archivedBefore = Number(one(`select count(*) from pnms where chapter_id='${fx.chapter.id}' and archived=true`));
const rowCheckbox = page.locator('table input[type="checkbox"]').nth(1);
if (await rowCheckbox.isVisible().catch(() => false)) {
  await rowCheckbox.check().catch(() => {});
  await sleep(500);
  const arch = page.getByRole("button", { name: /^Archive \(/i }).first();
  if (await arch.isVisible().catch(() => false)) {
    await arch.click();
    await sleep(1800);
    const archivedAfter = Number(one(`select count(*) from pnms where chapter_id='${fx.chapter.id}' and archived=true`));
    check("archive marks the PNM archived", archivedAfter === archivedBefore + 1, `${archivedBefore} -> ${archivedAfter}`);
    const stillInRoster = Number(one(`
      select count(*) from pnms where chapter_id='${fx.chapter.id}' and archived=true and stage <> 'prospect'`));
    console.log(`  archived rows now excluded from roster queries: ${stillInRoster} archived total`);
  } else {
    console.log("  (no Archive button appeared after selecting a row)");
  }
} else {
  console.log("  (no row checkbox found)");
}

// ---------------------------------------------------------------- delete tag
console.log("\n=== delete a tag ===");
await page.goto(`${APP}/admin/tags`, { waitUntil: "domcontentloaded" });
await settle(page, 1200);
const tagsBefore = Number(one(`select count(*) from tags where chapter_id='${fx.chapter.id}'`));
const linksBefore = Number(one(`select count(*) from pnm_tags`));
const kebab = page.locator("button").filter({ hasText: /^$/ }).last();
await kebab.click().catch(() => {});
await sleep(600);
const del = page.getByRole("button", { name: /delete/i }).first();
if (await del.isVisible().catch(() => false)) {
  await del.click();
  await sleep(700);
  for (const label of [/^Delete$/i, /^Confirm/i, /^Yes/i]) {
    const c = page.getByRole("button", { name: label }).last();
    if (await c.isVisible().catch(() => false)) { await c.click().catch(() => {}); break; }
  }
  await sleep(1600);
  const tagsAfter = Number(one(`select count(*) from tags where chapter_id='${fx.chapter.id}'`));
  const orphanLinks = Number(one(`select count(*) from pnm_tags pt left join tags t on t.id=pt.tag_id where t.id is null`));
  check("delete removes the tag", tagsAfter === tagsBefore - 1, `${tagsBefore} -> ${tagsAfter}`);
  check("deleting a tag leaves no orphaned pnm_tags", orphanLinks === 0, `${orphanLinks} orphaned links`);
} else {
  console.log("  (no delete control reachable on the tag row)");
}

// -------------------------------------------------------------- end session
console.log("\n=== end a live session ===");
sql(`update sessions set ended_at=now() where ended_at is null`);
sql(`update voting_rounds set status='ENDED', ended_at=now() where status='ACTIVE' and name is null`);
await page.goto(`${APP}/voting`, { waitUntil: "domcontentloaded" });
await settle(page, 1200);
const start = page.getByRole("button", { name: /^Start Session$/i });
if (await start.isVisible().catch(() => false)) {
  await start.click();
  await settle(page, 1500);
  const openBefore = Number(one(`select count(*) from sessions where ended_at is null`));
  const endBtn = page.getByRole("button", { name: /End Session/i }).first();
  if (await endBtn.isVisible().catch(() => false)) {
    await endBtn.click();
    await sleep(800);
    for (const label of [/^End Session$/i, /^Confirm/i, /^Yes/i]) {
      const c = page.getByRole("button", { name: label }).last();
      if (await c.isVisible().catch(() => false)) { await c.click().catch(() => {}); break; }
    }
    await sleep(1800);
    const openAfter = Number(one(`select count(*) from sessions where ended_at is null`));
    check("ending a session closes it", openAfter < openBefore, `open sessions ${openBefore} -> ${openAfter}`);
  } else {
    console.log("  (no End Session control on the chair's view)");
    note("medium", "Chair cannot end a session from the UI",
      "Start Session works, but no End Session control is rendered; the session can only be ended by exhausting the PNM list.");
  }
  sql(`update sessions set ended_at=now() where ended_at is null`);
  sql(`update voting_rounds set status='ENDED', ended_at=now() where status='ACTIVE' and name is null`);
}

const serverErrors = errors.filter((e) => /^http5/.test(e.kind));
writeFileSync(join(ROOT, "report-destructive.json"), JSON.stringify({ results, findings, errors }, null, 2));
console.log(`\n=== ${results.filter((r) => r.ok).length}/${results.length} checks passed, ${findings.length} finding(s), ${serverErrors.length} server error(s) ===`);
for (const e of serverErrors.slice(0, 8)) console.log(`  ! ${e.text.slice(0, 150)}`);

await browser.close();
