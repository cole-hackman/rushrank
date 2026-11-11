/**
 * Live voting: one chair plus N concurrent voters, with the websocket contract
 * asserted frame by frame.
 *
 * e2e/voting.mjs already proves that concurrent votes land and the lock holds,
 * but it reads the database to find out what happened. It never looks at what
 * the server actually pushed. This script records every websocket frame each
 * browser context receives and checks the four events the app depends on:
 *
 *   pnm_advance    {type, current_pnm_id, pnm:{id,name,major,hometown,year,photo_url,tags}}
 *   lock_change    {type, locked}
 *   vote_cast      {type, pnm_id, tallies:{yes,no,unknown,favorites,votes_collected}}
 *   session_ended  {type, round_id}
 *
 * It also covers what voting.mjs does not: join by code, favourite, a voter
 * whose websocket is blocked (the 5 s polling fallback), members attempting
 * chair actions, the chair ending the session, and whether an unauthenticated
 * socket can listen in.
 *
 *   node ws-voting.mjs [voterCount=12] [pnmsToRun=3]
 *
 * WRITES: creates a round and a session, casts votes, ends the session.
 * Runs only against the local e2e database; guard.mjs enforces that.
 * Exit code: 0 = nothing new (findings tagged "(known)" do not count),
 * 1 = at least one new blocker/high finding, 2 = guard refused.
 */

import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fixtures, signIn, watch, settle, sleep, acceptConfirm, APP, ROOT } from "./lib/harness.mjs";
import { guard, sql, API } from "./guard.mjs";

const VOTERS = Number(process.argv[2] || 12);
const PNMS_TO_RUN = Number(process.argv[3] || 3);

await guard();

const fx = fixtures();
const chair = fx.users.find((u) => u.role === "admin");
const members = fx.users.filter((u) => u.role === "member");
const voters = members.slice(0, VOTERS);
// One extra member whose websocket is blocked, to exercise the polling fallback.
const pollUser = members[VOTERS] || null;

const findings = [];
const errors = [];
const checks = [];
const note = (severity, title, detail) => {
  findings.push({ severity, title, detail });
  console.log(`  [${severity}] ${title}\n        ${detail}`);
};
const pass = (title) => {
  checks.push(title);
  console.log(`  ok  ${title}`);
};

/** Direct API call as a given user. Returns {status, body}. */
async function call(user, method, path, body) {
  const res = await fetch(`${API}/api/v1${path}`, {
    method,
    headers: {
      ...(user ? { Authorization: `Bearer ${user.token}` } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let parsed = null;
  try {
    parsed = await res.json();
  } catch {
    /* not json */
  }
  return { status: res.status, body: parsed };
}

/** Record every JSON frame the page's session socket receives. */
function tapSocket(page, sink) {
  page.on("websocket", (ws) => {
    if (!/\/ws\/session\//.test(ws.url())) return;
    sink.sockets.push(ws.url());
    ws.on("framereceived", ({ payload }) => {
      if (typeof payload !== "string" || payload === "pong") return;
      try {
        sink.frames.push({ at: Date.now(), ...JSON.parse(payload) });
      } catch {
        sink.frames.push({ at: Date.now(), type: "__unparseable__", raw: String(payload).slice(0, 120) });
      }
    });
  });
}

/** Poll until `fn()` is truthy or the timeout passes. */
async function until(fn, timeout = 8000, step = 150) {
  const end = Date.now() + timeout;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) return null;
    await sleep(step);
  }
}

const hasKeys = (obj, keys) => obj && typeof obj === "object" && keys.every((k) => k in obj);

// Re-runnable: close anything a previous run left open, in this chapter only.
sql(`update sessions set ended_at = now()
     where ended_at is null and round_id in (select id from voting_rounds where chapter_id='${fx.chapter.id}')`);
sql(`update voting_rounds set status='ENDED', ended_at=now()
     where status='ACTIVE' and name is null and chapter_id='${fx.chapter.id}'`);

const browser = await chromium.launch();
console.log(`\n=== ws-voting: 1 chair + ${voters.length} voters${pollUser ? " + 1 polling voter" : ""} ===\n`);

// ------------------------------------------------------------------ chair
const chairSink = { frames: [], sockets: [] };
const chairCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await signIn(chairCtx, chair, { chapterId: fx.chapter.id });
const chairPage = await chairCtx.newPage();
watch(chairPage, errors, "chair");
tapSocket(chairPage, chairSink);
await chairPage.goto(`${APP}/voting`, { waitUntil: "domcontentloaded" });
await settle(chairPage);
await chairPage.getByRole("button", { name: /^Start Session$/i }).click();
await settle(chairPage, 1500);

const active = await call(chair, "GET", "/sessions/active");
const session = active.body;
if (active.status !== 200 || !session?.id) {
  note("blocker", "Chair could not start a session", `GET /sessions/active -> ${active.status} ${JSON.stringify(session)}`);
  await browser.close();
  process.exit(1);
}
const { id: sessionId, round_id: roundId, join_code: joinCode } = session;
console.log(`session ${sessionId}\nround   ${roundId}\ncode    ${joinCode}`);

const shownCode = (await chairPage.locator("span.font-mono").first().textContent().catch(() => ""))?.trim();
if (shownCode === joinCode) pass("join code on the chair's screen matches the API");
else note("high", "Join code on screen differs from the API", `screen="${shownCode}" api="${joinCode}"`);

if (session.is_chair === true) pass("creator is reported as chair");
else note("high", "Session creator is not reported as chair", `is_chair=${session.is_chair}`);

// ------------------------------------------------- join by code (API contract)
{
  const m = voters[0];
  const good = await call(m, "POST", "/sessions/join", { join_code: joinCode });
  if (good.status === 200 && hasKeys(good.body, ["id", "round_id", "current_pnm", "pnm_ids", "user_votes"])) {
    pass("POST /sessions/join with the right code returns the session");
  } else {
    note("high", "Join by code failed or changed shape", `status=${good.status} keys=${Object.keys(good.body || {})}`);
  }
  if (good.body?.is_chair === false) pass("a member joining is not chair");
  else note("high", "A member is told they are chair", `is_chair=${good.body?.is_chair}`);

  const bad = await call(m, "POST", "/sessions/join", { join_code: "ZZZZZ0" });
  if (bad.status === 404) pass("POST /sessions/join with a wrong code returns 404");
  else note("high", "Wrong join code is not rejected with 404", `status=${bad.status}`);

  const anon = await call(null, "POST", "/sessions/join", { join_code: joinCode });
  if (anon.status === 401 || anon.status === 403) pass("join without a token is rejected");
  else note("blocker", "Join works without authentication", `status=${anon.status}`);
}

// ------------------------------------------------------------------ voters
const clients = [];
for (const v of voters) {
  const sink = { frames: [], sockets: [] };
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await signIn(ctx, v, { chapterId: fx.chapter.id });
  const page = await ctx.newPage();
  watch(page, errors, v.name);
  tapSocket(page, sink);
  await page.goto(`${APP}/voting`, { waitUntil: "domcontentloaded" });
  clients.push({ user: v, page, ctx, sink });
}
await Promise.all(clients.map((c) => settle(c.page, 600)));

// A voter whose socket never connects: must fall back to polling.
let poller = null;
if (pollUser) {
  const sink = { frames: [], sockets: [] };
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await signIn(ctx, pollUser, { chapterId: fx.chapter.id });
  const page = await ctx.newPage();
  tapSocket(page, sink);
  if (typeof page.routeWebSocket === "function") {
    await page.routeWebSocket(/\/ws\/session\//, (ws) => ws.close());
    await page.goto(`${APP}/voting`, { waitUntil: "domcontentloaded" });
    await settle(page, 600);
    poller = { user: pollUser, page, ctx, sink };
  } else {
    console.log("  (this Playwright has no routeWebSocket; skipping the polling-fallback voter)");
    await ctx.close();
  }
}

const pill = (page) => page.locator("text=/^(Live|Polling)$/").first().textContent().catch(() => "?");
await sleep(2500);
const pills = await Promise.all(clients.map((c) => pill(c.page)));
const live = pills.filter((p) => /Live/.test(p || "")).length;
if (live === clients.length && clients.every((c) => c.sink.sockets.length >= 1)) {
  pass(`all ${clients.length} voters show "Live" and opened a session socket`);
} else {
  note("high", "Not every voter connected over the websocket", `${live}/${clients.length} show Live; pills=${pills.join(",")}`);
}
if (poller) {
  const p = await pill(poller.page);
  if (/Polling/.test(p || "")) pass('the socket-blocked voter shows "Polling"');
  else note("high", "Socket-blocked voter does not show Polling", `pill="${p}"`);
}

// Every client should be looking at the PNM the server says is current.
const currentPnmId = () =>
  sql(`select current_pnm_id::text from sessions where id='${sessionId}'`)[0]?.[0] || null;
const pnmName = (id) => sql(`select name from pnms where id='${id}'`)[0]?.[0] || null;
const headingOf = (page) => page.locator("h2").first().textContent().then((t) => (t || "").trim()).catch(() => "");

// --------------------------------------------------- concurrent voting + events
const CHOICES = ["Yes", "No", "Don't Know"];
const WANT = { Yes: "YES", No: "NO", "Don't Know": "UNKNOWN" };

for (let i = 0; i < PNMS_TO_RUN; i++) {
  const pnmId = currentPnmId();
  if (!pnmId) {
    note("blocker", "Session has no current PNM", "sessions.current_pnm_id is null while the session is open");
    break;
  }
  const name = pnmName(pnmId);
  const onScreen = await Promise.all(clients.map((c) => headingOf(c.page)));
  const wrongCard = onScreen.filter((h) => h !== name).length;
  if (wrongCard === 0) pass(`PNM ${i + 1}: every voter's card shows "${name}"`);
  else note("high", "Voters are not all on the current PNM", `${wrongCard}/${clients.length} show something other than "${name}"`);

  const mark = Date.now();
  const picks = new Map();
  await Promise.all(
    clients.map(async (c, n) => {
      const choice = CHOICES[n % CHOICES.length];
      picks.set(c.user.id, choice);
      try {
        // exact + case-sensitive: the avatar button's initials can spell "NO".
        await c.page.getByRole("button", { name: choice, exact: true }).first().click({ timeout: 8000 });
      } catch {
        errors.push({ kind: "vote", where: c.user.name, text: `could not click ${choice}` });
      }
    })
  );

  // Database: one row per voter, with the value they clicked.
  const landed = await until(() => {
    const n = Number(sql(`select count(*) from votes where round_id='${roundId}' and pnm_id='${pnmId}'`)[0][0]);
    return n >= clients.length ? n : null;
  }, 10000, 300);
  const rows = sql(`select voter_user_id::text, value from votes where round_id='${roundId}' and pnm_id='${pnmId}'`);
  if (rows.length === clients.length) pass(`PNM ${i + 1}: ${rows.length}/${clients.length} concurrent votes stored`);
  else note("blocker", "Concurrent votes were lost", `${clients.length} voted, ${rows.length} rows stored (waited: ${landed})`);
  const wrong = rows.filter(([uid, val]) => picks.has(uid) && WANT[picks.get(uid)] !== val);
  if (wrong.length) note("blocker", "Votes stored with the wrong value", `${wrong.length}/${rows.length} rows disagree with the click`);

  // vote_cast: shape, and the final tallies must equal the database.
  await sleep(800);
  const [dbY, dbN, dbU] = sql(
    `select count(*) filter (where value='YES'), count(*) filter (where value='NO'),
            count(*) filter (where value='UNKNOWN')
     from votes where round_id='${roundId}' and pnm_id='${pnmId}'`
  )[0].map(Number);
  const dbCollected = Number(sql(`select count(distinct voter_user_id) from votes where round_id='${roundId}'`)[0][0]);

  const castFrames = (sink) => sink.frames.filter((f) => f.type === "vote_cast" && f.pnm_id === pnmId && f.at >= mark);
  const chairCasts = castFrames(chairSink);
  const badShape = chairCasts.filter(
    (f) => !hasKeys(f.tallies, ["yes", "no", "unknown", "favorites", "votes_collected"])
  );
  if (chairCasts.length === 0) {
    note("blocker", "Chair received no vote_cast events", `0 frames for PNM ${pnmId} after ${clients.length} votes`);
  } else if (badShape.length) {
    note("high", "vote_cast payload shape changed", `example: ${JSON.stringify(badShape[0])}`);
  } else {
    const best = chairCasts.reduce((a, f) => (f.tallies.yes + f.tallies.no + f.tallies.unknown >= a.tallies.yes + a.tallies.no + a.tallies.unknown ? f : a));
    const t = best.tallies;
    if (t.yes === dbY && t.no === dbN && t.unknown === dbU && t.votes_collected === dbCollected) {
      pass(`PNM ${i + 1}: vote_cast tallies match the database (yes ${dbY}, no ${dbN}, unknown ${dbU}, collected ${dbCollected}); chair got ${chairCasts.length} frames`);
    } else {
      note("high", "vote_cast tallies disagree with the database",
        `frame=${JSON.stringify(t)} db={yes:${dbY},no:${dbN},unknown:${dbU},collected:${dbCollected}}`);
    }
  }
  const votersWithCast = clients.filter((c) => castFrames(c.sink).length > 0).length;
  console.log(`      vote_cast reached ${votersWithCast}/${clients.length} voters (they only use votes_collected)`);

  // Chair's progress bar should reflect the count without a reload.
  const bar = await chairPage.locator(`text=/^\\s*${dbCollected}\\s*\\/\\s*\\d+\\s*$/`).first().isVisible().catch(() => false);
  if (bar) pass(`PNM ${i + 1}: chair's "Votes Collected" shows ${dbCollected}`);
  else note("high", "Chair's Votes Collected did not update live", `expected "${dbCollected} / <total>" on the chair's screen`);

  // pnm_advance
  const advMark = Date.now();
  await chairPage.getByRole("button", { name: /Next PNM/i }).click();
  const nextId = await until(() => {
    const id = currentPnmId();
    return id && id !== pnmId ? id : null;
  }, 8000);
  if (!nextId) {
    note("blocker", "Next PNM did not advance the session", `current_pnm_id stayed ${pnmId}`);
    break;
  }
  const nextName = pnmName(nextId);
  const got = await until(() => {
    const n = clients.filter((c) => c.sink.frames.some((f) => f.type === "pnm_advance" && f.current_pnm_id === nextId && f.at >= advMark)).length;
    return n === clients.length ? n : null;
  }, 6000);
  if (got) pass(`advance ${i + 1}: pnm_advance reached all ${clients.length} voters`);
  else {
    const n = clients.filter((c) => c.sink.frames.some((f) => f.type === "pnm_advance" && f.current_pnm_id === nextId)).length;
    note("blocker", "pnm_advance did not reach every voter", `${n}/${clients.length} received it for ${nextId}`);
  }
  const adv = clients[0].sink.frames.find((f) => f.type === "pnm_advance" && f.current_pnm_id === nextId);
  if (adv) {
    if (hasKeys(adv.pnm, ["id", "name", "major", "hometown", "year", "photo_url", "tags"]) && adv.pnm.id === nextId && adv.pnm.name === nextName) {
      pass(`advance ${i + 1}: pnm_advance payload is complete and names "${nextName}"`);
    } else {
      note("high", "pnm_advance payload shape changed", JSON.stringify(adv).slice(0, 300));
    }
  }
  const swapped = await until(async () => {
    const hs = await Promise.all(clients.map((c) => headingOf(c.page)));
    return hs.every((h) => h === nextName);
  }, 5000);
  if (swapped) pass(`advance ${i + 1}: every voter's card changed to "${nextName}"`);
  else note("high", "Voter cards did not follow pnm_advance", `expected "${nextName}" on all ${clients.length} screens`);

  if (poller) {
    const followed = await until(async () => (await headingOf(poller.page)) === nextName, 9000, 400);
    if (followed) pass(`advance ${i + 1}: polling voter caught up within 9 s`);
    else note("high", "Polling fallback did not pick up the new PNM", `still showing "${await headingOf(poller.page)}"`);
  }
}

// ------------------------------------------------- walk-up joins the session
// A PNM added while the session is running is appended to the end of its
// running order (python_server/live_round.py), so the chair reaches them.
{
  const name = `E2E Walkup ${Date.now().toString(36)}`;
  const stamp = Date.now().toString(36);
  // A formal-rush PNM needs an email (services.py create_pnm).
  const created = await call(voters[0], "POST", `/pnms?chapter_id=${fx.chapter.id}`, {
    name, major: "Testing", email: `walkup-${stamp}@example.com`,
  });
  const newId = created.body?.id;
  const last = sql(`select selected_pnm_ids[array_length(selected_pnm_ids, 1)] from voting_rounds where id='${roundId}'`)[0]?.[0];
  const inRound = Number(sql(`select count(*) from round_pnms where round_id='${roundId}' and pnm_id='${newId}'`)[0]?.[0] || 0);
  if (created.status === 200 && newId && last === newId && inRound === 1) {
    pass("a PNM added mid-session is appended to the end of the running order");
  } else {
    note("high", "A PNM added mid-session did not join the session",
      `create=${created.status}, last in order=${last}, in round_pnms=${inRound}`);
  }
}

// ----------------------------------------------------------------- lock_change
console.log("\n--- lock ---");
{
  const mark = Date.now();
  await chairPage.getByRole("button", { name: /^Lock Voting$/i }).click();
  const all = [...clients.map((c) => c.sink), chairSink];
  const got = await until(() => all.every((s) => s.frames.some((f) => f.type === "lock_change" && f.locked === true && f.at >= mark)), 6000);
  if (got) pass(`lock_change {locked:true} reached the chair and all ${clients.length} voters`);
  else {
    const n = all.filter((s) => s.frames.some((f) => f.type === "lock_change" && f.locked === true && f.at >= mark)).length;
    note("blocker", "lock_change did not reach every client", `${n}/${all.length} received locked:true`);
  }

  const victim = clients[0];
  const disabled = await until(
    () => victim.page.getByRole("button", { name: "Yes", exact: true }).first().isDisabled().catch(() => false),
    4000
  );
  if (disabled) pass("voter's Yes button is disabled while locked");
  else note("high", "Vote buttons stay enabled while locked", "Yes button on a voter's screen was not disabled");

  const cur = currentPnmId();
  const before = Number(sql(`select count(*) from votes where round_id='${roundId}' and pnm_id='${cur}'`)[0][0]);
  const forced = await call(victim.user, "POST", "/votes", { round_id: roundId, pnm_id: cur, choice: "YES" });
  const after = Number(sql(`select count(*) from votes where round_id='${roundId}' and pnm_id='${cur}'`)[0][0]);
  if (forced.status === 409 && before === after) pass("direct POST /votes while locked returns 409 and writes nothing");
  else note("blocker", "Lock is not enforced server-side", `status=${forced.status}, rows ${before} -> ${after}`);

  // Known gap (docs/reboot-2026-11/02): the legacy endpoint has no lock check.
  const legacy = await call(victim.user, "POST", `/rounds/${roundId}/votes`, { pnm_id: cur, value: "YES" });
  const afterLegacy = Number(sql(`select count(*) from votes where round_id='${roundId}' and pnm_id='${cur}'`)[0][0]);
  if (legacy.status >= 200 && legacy.status < 300 && afterLegacy > after) {
    note("high", "Lock bypass through POST /rounds/{id}/votes (known)",
      `status=${legacy.status}, rows ${after} -> ${afterLegacy}. This endpoint does not check sessions.locked.`);
    sql(`delete from votes where round_id='${roundId}' and pnm_id='${cur}' and voter_user_id='${victim.user.id}'`);
  } else {
    pass(`legacy POST /rounds/{id}/votes while locked did not write (status ${legacy.status})`);
  }

  const mark2 = Date.now();
  await chairPage.getByRole("button", { name: /^Unlock Voting$/i }).click();
  const got2 = await until(() => all.every((s) => s.frames.some((f) => f.type === "lock_change" && f.locked === false && f.at >= mark2)), 6000);
  if (got2) pass("lock_change {locked:false} reached every client");
  else note("blocker", "Unlock did not reach every client", "missing lock_change locked:false on at least one socket");
}

// --------------------------------------------------- re-vote, then favourite
{
  const c = clients[0];
  const cur = currentPnmId();
  const own = () =>
    sql(`select value, favorite::text from votes where round_id='${roundId}' and pnm_id='${cur}' and voter_user_id='${c.user.id}'`);
  await c.page.getByRole("button", { name: "Yes", exact: true }).first().click().catch(() => {});
  await until(() => own().length === 1, 4000);
  await c.page.getByRole("button", { name: "No", exact: true }).first().click().catch(() => {});
  const flipped = await until(() => (own()[0]?.[0] === "NO" ? true : null), 4000);
  if (flipped && own().length === 1) pass("changing a vote updates the single row in place");
  else note("blocker", "Re-vote did not update in place", `rows=${JSON.stringify(own())}`);

  const star = c.page.locator("button:has(svg.lucide-star)").first();
  if (await star.isVisible().catch(() => false)) {
    await star.click().catch(() => {});
    const fav = await until(() => (own()[0]?.[1] === "true" || own()[0]?.[1] === "t" ? true : null), 4000);
    if (fav && own()[0][0] === "NO") pass("vote then star keeps the vote and sets favourite");
    else note("high", "Favourite after a vote did not persist correctly", `row=${JSON.stringify(own())}`);
  } else {
    console.log("  (star button not found with button:has(svg.lucide-star); favourite checked through the API instead)");
    const r = await call(c.user, "POST", "/votes", { round_id: roundId, pnm_id: cur, favorite: true });
    if (r.status === 200 && r.body?.favorite === true) pass("favourite through the API keeps the existing vote");
    else note("high", "Favourite through the API failed", `status=${r.status}`);
  }

  // Known behaviour worth seeing: a normal vote after a favourite clears it.
  await c.page.getByRole("button", { name: "Yes", exact: true }).first().click().catch(() => {});
  await sleep(1200);
  const row = own()[0];
  if (row && row[0] === "YES" && !(row[1] === "true" || row[1] === "t")) {
    note("medium", "Voting after favouriting clears the favourite (known)",
      "POST /votes defaults favorite to false, so star-then-vote loses the star.");
  }
}

// ------------------------------------------- members cannot use chair controls
{
  const m = clients[1]?.user || voters[0];
  for (const [label, path, body] of [
    ["advance", `/sessions/${sessionId}/advance`, undefined],
    ["lock", `/sessions/${sessionId}/lock`, { locked: true }],
    ["end", `/sessions/${sessionId}/end`, undefined],
  ]) {
    const r = await call(m, "POST", path, body);
    if (r.status === 403) pass(`member POST ${label} -> 403`);
    else note("blocker", `A member can ${label} the session`, `status=${r.status}`);
  }
  const endVisible = await clients[1]?.page.getByRole("button", { name: /^End Session$/i }).isVisible().catch(() => false);
  if (!endVisible) pass("End Session button is hidden from members");
  else note("high", "End Session button is visible to a member", "");
}

// ------------------------------------------- unauthenticated socket (known gap)
let eavesdropper = null;
if (typeof globalThis.WebSocket === "function") {
  const wsUrl = `${API.replace(/^http/, "ws")}/ws/session/${sessionId}`;
  eavesdropper = { frames: [], opened: false };
  const ws = new globalThis.WebSocket(wsUrl);
  ws.addEventListener("open", () => (eavesdropper.opened = true));
  ws.addEventListener("message", (ev) => {
    try {
      eavesdropper.frames.push(JSON.parse(String(ev.data)));
    } catch {
      /* pong */
    }
  });
  eavesdropper.ws = ws;
  await sleep(800);
} else {
  console.log("  (no global WebSocket in this Node; skipping the unauthenticated-socket check. Node 22+ has it.)");
}

// --------------------------------------------------------------- session_ended
console.log("\n--- end session ---");
{
  const votesBefore = Number(sql(`select count(*) from votes where round_id='${roundId}'`)[0][0]);
  const mark = Date.now();
  await chairPage.getByRole("button", { name: /^End Session$/i }).click();
  if (await acceptConfirm(chairPage)) pass("End Session asks for confirmation in an in-app dialog");
  else note("high", "End Session did not show its confirmation dialog", "no role=alertdialog appeared");

  const all = [...clients.map((c) => c.sink), chairSink];
  const got = await until(() => all.every((s) => s.frames.some((f) => f.type === "session_ended" && f.at >= mark)), 6000);
  if (got) pass(`session_ended reached the chair and all ${clients.length} voters`);
  else {
    const n = all.filter((s) => s.frames.some((f) => f.type === "session_ended" && f.at >= mark)).length;
    note("blocker", "session_ended did not reach every client", `${n}/${all.length}`);
  }
  const ended = clients[0].sink.frames.find((f) => f.type === "session_ended");
  if (ended?.round_id === roundId) pass("session_ended carries the round id");
  else note("high", "session_ended payload shape changed", JSON.stringify(ended));

  const closed = await until(() => (sql(`select (ended_at is not null)::text from sessions where id='${sessionId}'`)[0][0].startsWith("t") ? true : null), 4000);
  if (closed) pass("session is closed in the database");
  else note("blocker", "End Session did not close the session", "sessions.ended_at is still null");

  const votesAfter = Number(sql(`select count(*) from votes where round_id='${roundId}'`)[0][0]);
  if (votesAfter === votesBefore) pass(`ending kept all ${votesAfter} votes`);
  else note("blocker", "Ending the session changed the vote count", `${votesBefore} -> ${votesAfter}`);

  const redirected = await until(async () => {
    const urls = [chairPage.url(), ...clients.map((c) => c.page.url())];
    return urls.every((u) => u.includes("/results") && u.includes(roundId));
  }, 8000, 300);
  if (redirected) pass("chair and every voter were redirected to /results for this round");
  else {
    const n = clients.filter((c) => c.page.url().includes("/results")).length;
    note("high", "Not everyone was redirected to results", `chair=${chairPage.url()} voters on /results=${n}/${clients.length}`);
  }

  const again = await call(chair, "POST", `/sessions/${sessionId}/end`);
  if (again.status === 404) pass("ending an already-ended session returns 404");
  else note("high", "Second end did not return 404", `status=${again.status}`);

  const late = await call(clients[0].user, "POST", "/votes", { round_id: roundId, pnm_id: fx.roster[0].id, choice: "YES" });
  if (late.status === 400 || late.status === 409) pass(`voting after the session ended is rejected (${late.status})`);
  else note("high", "A vote was accepted after the session ended", `status=${late.status}`);

  if (poller) {
    await sleep(7000);
    if (poller.page.url().includes("/results")) pass("polling voter was redirected after the session ended");
    else note("medium", "Polling voter is never told the session ended (known)",
      "The 5 s poll swallows the 404 from GET /sessions/{id}/current, so a client without a socket stays on a dead card.");
  }

  if (eavesdropper) {
    const saw = eavesdropper.frames.some((f) => f.type === "session_ended");
    if (eavesdropper.opened && saw) {
      note("high", "Websocket accepts unauthenticated listeners (known)",
        `A socket with no token connected to /ws/session/${sessionId} and received ${eavesdropper.frames.length} frame(s), including session_ended.`);
    } else {
      pass("an unauthenticated socket received nothing");
    }
    try {
      eavesdropper.ws.close();
    } catch {
      /* already closed */
    }
  }
}

// --------------------------------------------------------------------- report
const count = (sink, type) => sink.frames.filter((f) => f.type === type).length;
const report = {
  script: "ws-voting",
  voters: clients.length,
  pnmsRun: PNMS_TO_RUN,
  sessionId,
  roundId,
  chairFrames: {
    pnm_advance: count(chairSink, "pnm_advance"),
    lock_change: count(chairSink, "lock_change"),
    vote_cast: count(chairSink, "vote_cast"),
    session_ended: count(chairSink, "session_ended"),
  },
  voterFrames: clients.map((c) => ({
    user: c.user.email,
    pnm_advance: count(c.sink, "pnm_advance"),
    lock_change: count(c.sink, "lock_change"),
    vote_cast: count(c.sink, "vote_cast"),
    session_ended: count(c.sink, "session_ended"),
  })),
  unknownFrameTypes: [
    ...new Set(
      [chairSink, ...clients.map((c) => c.sink)]
        .flatMap((s) => s.frames.map((f) => f.type))
        .filter((t) => !["pnm_advance", "lock_change", "vote_cast", "session_ended"].includes(t))
    ),
  ],
  passed: checks,
  findings,
  errors: errors.slice(0, 80),
};
writeFileSync(join(ROOT, "report-ws-voting.json"), JSON.stringify(report, null, 2));

if (report.unknownFrameTypes.length) {
  note("medium", "Websocket sent event types this script does not know", report.unknownFrameTypes.join(", "));
}

// Findings tagged "(known)" are defects already written up in
// docs/reboot-2026-11/02-unfinished-and-broken.md; they are printed but do not
// fail the run, so a non-zero exit always means something new.
const serious = findings.filter((f) => (f.severity === "blocker" || f.severity === "high") && !/\(known\)$/.test(f.title));
// 409s from the deliberate forced vote are expected, not page errors.
const realErrors = errors.filter((e) => !(e.kind === "http409" && /\/votes/.test(e.text)));
console.log(`\n=== ${checks.length} checks passed, ${findings.length} finding(s) (${serious.length} new blocker/high), ${realErrors.length} console/network error(s) ===`);
for (const e of realErrors.slice(0, 12)) console.log(`  ! ${e.kind} ${String(e.text).slice(0, 150)}`);
console.log("report: e2e/report-ws-voting.json");

await browser.close();
process.exit(serious.length ? 1 : 0);
