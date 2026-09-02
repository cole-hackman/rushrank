/** Verify the two product changes: End Session, and Voting in the bottom nav. */
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { fixtures, signIn, watch, settle, sleep, APP } from "./lib/harness.mjs";

const sql = (q) =>
  execFileSync("psql", [process.env.E2E_DATABASE_URL, "-tAF", "|", "-c", q], {
    encoding: "utf8",
    env: { ...process.env, PATH: `/opt/homebrew/opt/libpq@17/bin:${process.env.PATH}` },
  }).trim();

const fx = fixtures();
const chair = fx.users.find((u) => u.role === "admin");
const voter = fx.users.find((u) => u.id !== chair.id);
const errors = [];
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(`  ${ok ? "PASS" : "FAIL"}  ${n} — ${d}`); };

sql(`update sessions set ended_at=now() where ended_at is null`);
sql(`update voting_rounds set status='ENDED', ended_at=now() where status='ACTIVE' and name is null`);

const b = await chromium.launch();

// ---------------------------------------------------------- bottom nav
console.log("\n=== Voting in the mobile bottom nav ===");
const mob = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await signIn(mob, chair, { chapterId: fx.chapter.id });
const mp = await mob.newPage();
watch(mp, errors, "mobile");
await mp.goto(`${APP}/dashboard`, { waitUntil: "domcontentloaded" });
await settle(mp, 1200);

const nav = await mp.evaluate(() => {
  const n = document.querySelector("nav.fixed.bottom-0");
  if (!n) return null;
  const items = [...n.querySelectorAll("a")].map((a) => {
    const r = a.getBoundingClientRect();
    return { label: (a.textContent || "").trim(), href: a.getAttribute("href"), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right) };
  });
  return { items, navWidth: Math.round(n.getBoundingClientRect().width) };
});
console.log("  nav items:", nav?.items.map((i) => `${i.label}(${i.w}x${i.h})`).join(" "));
check("Voting is in the bottom nav", !!nav?.items.find((i) => i.href === "/voting"), nav?.items.map((i) => i.label).join(", "));
check("all five items fit the viewport", nav?.items.every((i) => i.right <= 390), `rightmost edge ${Math.max(...(nav?.items.map((i) => i.right) || [0]))}px of 390`);
check("touch targets still >= 44px", nav?.items.every((i) => i.w >= 44 && i.h >= 44), `smallest ${Math.min(...(nav?.items.map((i) => Math.min(i.w, i.h)) || [0]))}px`);

// Tapping it goes to voting.
await mp.locator('nav.fixed.bottom-0 a[href="/voting"]').click();
await settle(mp, 1200);
check("tapping Voting navigates there", new URL(mp.url()).pathname === "/voting", mp.url());
await mp.screenshot({ path: "screens/verify-bottomnav.png" });

// ---------------------------------------------------------- end session
console.log("\n=== End Session ===");
const chairCtx = await b.newContext({ viewport: { width: 1280, height: 900 } });
await signIn(chairCtx, chair, { chapterId: fx.chapter.id });
const cp = await chairCtx.newPage();
watch(cp, errors, "chair");
cp.on("dialog", async (d) => { console.log("  confirm:", JSON.stringify(d.message().slice(0, 70))); await d.accept(); });
await cp.goto(`${APP}/voting`, { waitUntil: "domcontentloaded" });
await settle(cp, 1200);
await cp.getByRole("button", { name: /^Start Session$/i }).click();
await settle(cp, 1600);
await cp.getByRole("button", { name: /Next PNM/i }).click();
await settle(cp, 1400);

// A voter is in the room, so the broadcast can be observed.
const vCtx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await signIn(vCtx, voter, { chapterId: fx.chapter.id });
const vp = await vCtx.newPage();
watch(vp, errors, "voter");
await vp.goto(`${APP}/voting`, { waitUntil: "domcontentloaded" });
await settle(vp, 1500);

const openBefore = Number(sql(`select count(*) from sessions where ended_at is null`));
const endVisible = await cp.getByRole("button", { name: /^End Session$/i }).isVisible().catch(() => false);
check("chair sees an End Session control", endVisible, endVisible ? "rendered" : "not found");

// A member must not be able to end the room.
const voterSeesEnd = await vp.getByRole("button", { name: /^End Session$/i }).isVisible().catch(() => false);
check("a non-chair does not see End Session", !voterSeesEnd, voterSeesEnd ? "voter can see it" : "hidden from voters");

if (endVisible) {
  await cp.getByRole("button", { name: /^End Session$/i }).click();
  await sleep(2600);
  const openAfter = Number(sql(`select count(*) from sessions where ended_at is null`));
  check("session is closed in the database", openAfter === openBefore - 1, `open sessions ${openBefore} -> ${openAfter}`);
  check("chair is taken to the results", /\/results/.test(cp.url()), cp.url());

  const votesKept = Number(sql(`select count(*) from votes`));
  check("votes are kept, not discarded", votesKept > 0, `${votesKept} votes still stored`);

  // The voter should have been told over the websocket.
  await sleep(1500);
  const voterUrl = vp.url();
  const voterBody = (await vp.textContent("body").catch(() => "")) || "";
  check(
    "voters are told the session ended",
    /\/results/.test(voterUrl) || /session (completed|ended)/i.test(voterBody),
    /\/results/.test(voterUrl) ? "redirected to results" : voterBody.slice(0, 60).replace(/\s+/g, " ")
  );
}

// Ending twice must not 500.
const sid = sql(`select id from sessions order by started_at desc limit 1`);
const again = await cp.evaluate(async ([api, id]) => {
  const raw = window.localStorage.getItem("sb-e2elocal-auth-token");
  const tok = raw ? JSON.parse(raw).access_token : null;
  const r = await fetch(`${api}/api/v1/sessions/${id}/end`, { method: "POST", headers: { Authorization: `Bearer ${tok}` } });
  return r.status;
}, ["http://localhost:8000", sid]);
check("ending an already-ended session is not a 500", again === 404, `HTTP ${again}`);

const serverErrors = errors.filter((e) => /^http5/.test(e.kind));
console.log(`\n=== ${pass} passed, ${fail} failed, ${serverErrors.length} server error(s) ===`);
for (const e of serverErrors.slice(0, 5)) console.log("  !", e.text.slice(0, 140));

await b.close();
