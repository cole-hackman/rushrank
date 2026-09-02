/** Why does one voter have two buttons named "No"? Dump the DOM and find out. */
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { fixtures, signIn, settle, APP } from "./lib/harness.mjs";

const sql = (q) =>
  execFileSync("psql", [process.env.E2E_DATABASE_URL, "-tAF", "|", "-c", q], {
    encoding: "utf8",
    env: { ...process.env, PATH: `/opt/homebrew/opt/libpq@17/bin:${process.env.PATH}` },
  }).trim();

const fx = fixtures();
const chair = fx.users.find((u) => u.role === "admin");
const noel = fx.users.find((u) => /Noel Escobar/.test(u.name)) || fx.users[5];
const other = fx.users.find((u) => u.id !== chair.id && u.id !== noel.id);

sql(`update sessions set ended_at=now() where ended_at is null`);
sql(`update voting_rounds set status='ENDED', ended_at=now() where status='ACTIVE' and name is null`);

const browser = await chromium.launch();

const chairCtx = await browser.newContext();
await signIn(chairCtx, chair, { chapterId: fx.chapter.id });
const cp = await chairCtx.newPage();
await cp.goto(`${APP}/voting`, { waitUntil: "domcontentloaded" });
await settle(cp);
await cp.getByRole("button", { name: /^Start Session$/i }).click();
await settle(cp, 1200);
await cp.getByRole("button", { name: /Next PNM/i }).click();
await settle(cp, 1200);

for (const user of [noel, other]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await signIn(ctx, user, { chapterId: fx.chapter.id });
  const p = await ctx.newPage();
  await p.goto(`${APP}/voting`, { waitUntil: "domcontentloaded" });
  await settle(p, 1200);

  const dump = await p.evaluate(() => {
    return [...document.querySelectorAll("button")]
      .map((b) => {
        const r = b.getBoundingClientRect();
        const cs = getComputedStyle(b);
        return {
          text: (b.textContent || "").trim().slice(0, 24),
          aria: b.getAttribute("aria-label"),
          disabled: b.disabled,
          w: Math.round(r.width),
          h: Math.round(r.height),
          vis: cs.visibility,
          opacity: cs.opacity,
          pointer: cs.pointerEvents,
          cls: b.className.slice(0, 70),
        };
      })
      .filter((b) => /^(yes|no|don't know)$/i.test(b.text));
  });
  console.log(`\n--- ${user.name} (${user.role}) ---`);
  for (const b of dump) console.log("   ", JSON.stringify(b));
}

await browser.close();
