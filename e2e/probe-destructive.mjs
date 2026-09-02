/** Screenshot the three screens destructive.mjs reported on, so the findings
 *  are judged from what is on screen rather than from a selector that missed. */
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { fixtures, signIn, settle, sleep, APP } from "./lib/harness.mjs";

const sql = (q) =>
  execFileSync("psql", [process.env.E2E_DATABASE_URL, "-tAF", "|", "-c", q], {
    encoding: "utf8",
    env: { ...process.env, PATH: `/opt/homebrew/opt/libpq@17/bin:${process.env.PATH}` },
  }).trim();

const fx = fixtures();
const chair = fx.users.find((u) => u.role === "admin");
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
await signIn(ctx, chair, { chapterId: fx.chapter.id });
const p = await ctx.newPage();

const buttons = () =>
  p.evaluate(() =>
    [...document.querySelectorAll("button, a[href]")]
      .filter((e) => e.getBoundingClientRect().width > 0)
      .map((e) => (e.textContent || "").replace(/\s+/g, " ").trim().slice(0, 34))
      .filter(Boolean)
  );

console.log("duplicate rows in DB:");
console.log(sql(`select name, count(*) from pnms where chapter_id='${fx.chapter.id}'
                 and archived=false group by name having count(*)>1`));

for (const [route, file] of [
  ["/admin/duplicates", "probe-duplicates"],
  ["/pnms", "probe-pnms-actions"],
  ["/voting", "probe-voting-chair"],
]) {
  await p.goto(`${APP}${route}`, { waitUntil: "domcontentloaded" });
  await settle(p, 1500);

  if (route === "/pnms") {
    const cb = p.locator('table input[type="checkbox"]').nth(1);
    if (await cb.isVisible().catch(() => false)) {
      await cb.check().catch(() => {});
      await sleep(900);
    }
  }
  if (route === "/voting") {
    const s = p.getByRole("button", { name: /^Start Session$/i });
    if (await s.isVisible().catch(() => false)) {
      await s.click();
      await settle(p, 1600);
    }
  }

  await p.screenshot({ path: `screens/${file}.png`, fullPage: false });
  console.log(`\n--- ${route} ---`);
  console.log("  visible controls:", (await buttons()).join(" | ").slice(0, 400));
}

sql(`update sessions set ended_at=now() where ended_at is null`);
sql(`update voting_rounds set status='ENDED', ended_at=now() where status='ACTIVE' and name is null`);
await b.close();
