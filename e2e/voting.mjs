/**
 * Multi-browser live voting simulation.
 *
 * One chair and N voters, each in its own browser context signed in as a
 * different brother, driving the real UI. This is the only test in the suite
 * that can actually falsify the concurrency work: whether simultaneous votes
 * survive, whether the chair's lock is obeyed by the server rather than just
 * greyed out in the client, and whether the websocket carries advance / lock /
 * tally rather than the page quietly falling back to polling.
 *
 *   node voting.mjs [voterCount]
 */

import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { fixtures, signIn, watch, settle, sleep, APP, ROOT } from "./lib/harness.mjs";

const VOTERS = Number(process.argv[2] || 10);
const PNMS_TO_RUN = 4;

const fx = fixtures();
const chair = fx.users.find((u) => u.role === "admin");
const voters = fx.users.filter((u) => u.id !== chair.id).slice(0, VOTERS);

const findings = [];
const errors = [];
const note = (severity, title, detail) => {
  findings.push({ severity, title, detail });
  console.log(`  [${severity}] ${title}\n        ${detail}`);
};

function sql(query) {
  const out = execFileSync(
    "psql",
    [process.env.E2E_DATABASE_URL || "postgresql://coleh@localhost:5432/rushrank_e2e", "-tAF", "|", "-c", query],
    { encoding: "utf8", env: { ...process.env, PATH: `/opt/homebrew/opt/libpq@17/bin:${process.env.PATH}` } }
  );
  return out.trim().split("\n").filter(Boolean).map((l) => l.split("|"));
}

// Re-runnable: close out anything a previous run left open, and drop the
// throwaway rounds it created, so the chair sees the Start Session form again.
sql(`update sessions set ended_at = now() where ended_at is null`);
sql(`update voting_rounds set status='ENDED', ended_at=now()
     where status='ACTIVE' and name is null`);

const browser = await chromium.launch();

// ---------------------------------------------------------------- chair opens
console.log(`\n=== Live voting: 1 chair + ${voters.length} voters ===\n`);
const chairCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await signIn(chairCtx, chair, { chapterId: fx.chapter.id });
const chairPage = await chairCtx.newPage();
watch(chairPage, errors, "chair");
await chairPage.goto(`${APP}/voting`, { waitUntil: "domcontentloaded" });
await settle(chairPage);

// Live Session should be the landing tab after the simplification call.
const landingTab = await chairPage
  .locator('[class*="active"], [aria-selected="true"]')
  .first()
  .textContent()
  .catch(() => null);
console.log("landing tab:", landingTab?.trim() || "(indeterminate)");

await chairPage.getByRole("button", { name: /^Start Session$/i }).click();
await settle(chairPage, 1500);

const joinCode = (
  await chairPage.locator("span.font-mono").first().textContent().catch(() => "")
)?.trim();
console.log("join code:", joinCode || "(NOT FOUND)");
if (!joinCode) {
  note("blocker", "Chair could not start a session", "No join code rendered after Start Session.");
  await browser.close();
  process.exit(1);
}

// What did the session actually put in the round?
const [[roundId]] = sql(
  `select r.id::text from sessions s join voting_rounds r on r.id=s.round_id
   where s.ended_at is null order by s.started_at desc limit 1`
);
const [[inRound]] = sql(`select count(*)::text from round_pnms where round_id='${roundId}'`);
const [[eligible]] = sql(
  `select count(*)::text from pnms where chapter_id='${fx.chapter.id}'
   and archived=false and stage <> 'prospect'`
);
const [[prospects]] = sql(
  `select count(*)::text from round_pnms rp join pnms p on p.id=rp.pnm_id
   where rp.round_id='${roundId}' and p.stage='prospect'`
);
const [[archived]] = sql(
  `select count(*)::text from round_pnms rp join pnms p on p.id=rp.pnm_id
   where rp.round_id='${roundId}' and p.archived=true`
);
console.log(`round contains ${inRound} PNMs (eligible roster is ${eligible})`);
if (Number(prospects) > 0 || Number(archived) > 0) {
  note(
    "high",
    "Live session votes on prospects and archived PNMs",
    `The round has ${inRound} PNMs but only ${eligible} are in formal rush: ` +
      `${prospects} prospects and ${archived} archived rows were included. ` +
      `routes.py create_session builds the round from "SELECT id FROM pnms WHERE chapter_id=$1" ` +
      `with no stage/archived filter, so the pipeline stage that #10 added is ignored here.`
  );
}

// ---------------------------------------------------------------- voters join
const voterSessions = [];
for (const v of voters) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await signIn(ctx, v, { chapterId: fx.chapter.id });
  const p = await ctx.newPage();
  watch(p, errors, v.name);
  await p.goto(`${APP}/voting`, { waitUntil: "domcontentloaded" });
  await settle(p, 800);
  // Members are auto-joined: loadActiveSession() finds the chapter's live
  // session on mount, so the join form only renders if that lookup missed.
  const needsCode = await p.getByPlaceholder(/join code/i).isVisible().catch(() => false);
  if (needsCode) {
    await p.getByPlaceholder(/join code/i).fill(joinCode);
    await p.getByRole("button", { name: /^Join Session$/i }).click();
    await settle(p, 500);
  }
  voterSessions.push({ user: v, page: p, ctx, joinedByCode: needsCode });
}
console.log(
  `${voterSessions.length} voters in session ` +
    `(${voterSessions.filter((v) => v.joinedByCode).length} needed the code, rest auto-joined)`
);

// Websocket or polling? This is the B3/B4 fix under real conditions.
await sleep(2500);
const wsStates = await Promise.all(
  voterSessions.map((v) =>
    v.page.locator("text=/^(Live|Polling)$/").first().textContent().catch(() => "?")
  )
);
const chairWs = await chairPage.locator("text=/^(Live|Polling)$/").first().textContent().catch(() => "?");
const polling = wsStates.filter((s) => /Polling/i.test(s || "")).length;
console.log(`websocket: chair=${chairWs}, voters live=${wsStates.length - polling}/${wsStates.length}`);
if (polling > 0 || /Polling/i.test(chairWs || "")) {
  note("high", "Websocket did not connect for every client",
    `chair=${chairWs}, ${polling}/${wsStates.length} voters fell back to polling.`);
}

// ---------------------------------------------------------- concurrent voting
const CHOICES = ["Yes", "No", "Don't Know"];
const expected = new Map(); // pnmId -> Map(voterId -> choice)

for (let round = 0; round < PNMS_TO_RUN; round++) {
  const [[currentPnm]] = sql(
    `select current_pnm_id::text from sessions where round_id='${roundId}' and ended_at is null`
  );
  const pnmId = currentPnm || null;
  if (!pnmId) {
    // First PNM only appears once the chair advances.
    await chairPage.getByRole("button", { name: /Next PNM/i }).click();
    await settle(chairPage, 1200);
    continue;
  }

  // Everyone votes at the same instant -- the whole point of the exercise.
  const picks = new Map();
  await Promise.all(
    voterSessions.map(async (v, i) => {
      const choice = CHOICES[i % CHOICES.length];
      picks.set(v.user.id, choice);
      try {
        // exact:true, so this stays case-sensitive. A case-insensitive match
        // also selects the user-avatar button, whose initials can spell a vote
        // ("Noel Escobar" -> "NO"), and clicking that silently drops the vote.
        await v.page
          .getByRole("button", { name: choice, exact: true })
          .first()
          .click({ timeout: 8000 });
      } catch (e) {
        // Why could this brother not vote? Capture the page's actual state --
        // a stuck client in a live room is the failure that matters.
        const diag = await v.page
          .evaluate(() => {
            const btns = [...document.querySelectorAll("button")].map((b) => ({
              t: (b.textContent || "").trim().slice(0, 20),
              d: b.disabled,
            }));
            const body = document.body.innerText || "";
            return {
              voteButtons: btns.filter((b) => /^(Yes|No|Don't Know)$/i.test(b.t)),
              waiting: /Waiting for chair/i.test(body),
              locked: /\bLocked\b/.test(body),
              loading: /Loading active session/i.test(body),
              noSession: /Start Session/i.test(body),
              heading: (document.querySelector("h2")?.textContent || "").trim(),
            };
          })
          .catch(() => null);
        errors.push({
          kind: "vote",
          where: v.user.name,
          text: `could not click ${choice}`,
          diag,
        });
      }
    })
  );
  expected.set(pnmId, picks);
  await sleep(1800);

  const [[stored]] = sql(
    `select count(*)::text from votes where round_id='${roundId}' and pnm_id='${pnmId}'`
  );
  console.log(`PNM ${round + 1}: ${voterSessions.length} voted concurrently -> ${stored} rows in DB`);
  if (Number(stored) !== voterSessions.length) {
    note("blocker", "Concurrent votes were lost",
      `${voterSessions.length} brothers voted on the same PNM at once but only ${stored} rows landed.`);
  }

  // Values must match who voted what, not just the count.
  const rows = sql(
    `select voter_user_id::text, value from votes where round_id='${roundId}' and pnm_id='${pnmId}'`
  );
  const want = { Yes: "YES", No: "NO", "Don't Know": "UNKNOWN" };
  const wrong = rows.filter(([uid, val]) => picks.has(uid) && want[picks.get(uid)] !== val);
  if (wrong.length) {
    note("blocker", "Votes were recorded against the wrong value",
      `${wrong.length} of ${rows.length} rows disagree with what the brother clicked.`);
  }

  await chairPage.getByRole("button", { name: /Next PNM/i }).click();
  await settle(chairPage, 1500);
}

// ------------------------------------------------------------------ lock test
console.log("\n--- lock ---");
await chairPage.getByRole("button", { name: /Lock Voting/i }).click();
await settle(chairPage, 1800);

const [[curPnm]] = sql(`select current_pnm_id::text from sessions where round_id='${roundId}' and ended_at is null`);
const before = curPnm
  ? Number(sql(`select count(*)::text from votes where round_id='${roundId}' and pnm_id='${curPnm}'`)[0][0])
  : 0;

const victim = voterSessions[0];
const lockedBtnDisabled = await victim.page
  .getByRole("button", { name: "Yes", exact: true })
  .first()
  .isDisabled()
  .catch(() => null);
console.log("voter's Yes button disabled after lock:", lockedBtnDisabled);

// Try to vote anyway, straight past the UI, the way a stale tab would.
const forced = await victim.page.evaluate(
  async ([api, rid, pid]) => {
    const raw = window.localStorage.getItem("sb-e2elocal-auth-token");
    const tok = raw ? JSON.parse(raw).access_token : null;
    const r = await fetch(`${api}/api/v1/votes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ round_id: rid, pnm_id: pid, choice: "YES" }),
    });
    return r.status;
  },
  ["http://localhost:8000", roundId, curPnm]
);
const after = curPnm
  ? Number(sql(`select count(*)::text from votes where round_id='${roundId}' and pnm_id='${curPnm}'`)[0][0])
  : 0;
console.log(`forced vote while locked -> HTTP ${forced} (rows ${before} -> ${after})`);
// That 409 is the correct answer, so it must not count as a page error.
for (let i = errors.length - 1; i >= 0; i--) {
  if (errors[i].kind === "http409" && /\/votes$/.test(errors[i].text)) errors.splice(i, 1);
}
if (forced !== 409 || after !== before) {
  note("blocker", "Lock is not enforced server-side",
    `A direct POST /votes during a locked session returned ${forced} and rows went ${before} -> ${after}. Expected 409 and no change.`);
}

await chairPage.getByRole("button", { name: /Unlock Voting/i }).click();
await settle(chairPage, 1200);

// -------------------------------------------------------------- tally sanity
const [[distinctVoters]] = sql(`select count(distinct voter_user_id)::text from votes where round_id='${roundId}'`);
const [[totalVotes]] = sql(`select count(*)::text from votes where round_id='${roundId}'`);
console.log(`\nsession totals: ${totalVotes} votes from ${distinctVoters} distinct brothers`);

// Changing your mind must update the row in place, never add a second one.
// Vote once first -- otherwise the "before" count is zero and any first vote
// looks like a duplicate.
if (curPnm) {
  const countFor = () =>
    Number(sql(`select count(*)::text from votes where round_id='${roundId}' and pnm_id='${curPnm}' and voter_user_id='${victim.user.id}'`)[0][0]);

  await victim.page.getByRole("button", { name: "Yes", exact: true }).first().click().catch(() => {});
  await sleep(1400);
  const afterFirst = countFor();

  await victim.page.getByRole("button", { name: "No", exact: true }).first().click().catch(() => {});
  await sleep(1400);
  const afterSecond = countFor();
  const [[val]] = sql(
    `select value from votes where round_id='${roundId}' and pnm_id='${curPnm}' and voter_user_id='${victim.user.id}'`
  );
  console.log(`re-vote: own rows ${afterFirst} -> ${afterSecond}, value now ${val}`);
  if (afterFirst !== 1 || afterSecond !== 1) {
    note("blocker", "Changing a vote creates a second row",
      `one brother's rows for one PNM went ${afterFirst} -> ${afterSecond}; expected 1 -> 1`);
  } else if (val !== "NO") {
    note("high", "Changing a vote did not take effect",
      `brother clicked Yes then No, but the stored value is ${val}`);
  }
}

const report = {
  voters: voterSessions.length,
  roundId,
  pnmsInRound: Number(inRound),
  eligibleRoster: Number(eligible),
  prospectsIncluded: Number(prospects),
  archivedIncluded: Number(archived),
  websocket: { chair: chairWs, votersPolling: polling, voterTotal: wsStates.length },
  totalVotes: Number(totalVotes),
  distinctVoters: Number(distinctVoters),
  findings,
  errors: errors.slice(0, 80),
};
writeFileSync(join(ROOT, "report-voting.json"), JSON.stringify(report, null, 2));

console.log(`\n=== ${findings.length} finding(s), ${errors.length} console/network error(s) ===`);
const bySeverity = findings.reduce((a, f) => ((a[f.severity] = (a[f.severity] || 0) + 1), a), {});
console.log(bySeverity);
for (const e of errors.slice(0, 15)) console.log(`  ! ${e.kind} ${e.text.slice(0, 150)}`);

await browser.close();
