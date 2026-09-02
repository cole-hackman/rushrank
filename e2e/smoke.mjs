/** Prove the harness can sign a browser in before building the real suites. */
import { chromium } from "playwright";
import { fixtures, signIn, watch, settle, APP } from "./lib/harness.mjs";

const fx = fixtures();
const chair = fx.users[0];

const browser = await chromium.launch();
const ctx = await browser.newContext();
await signIn(ctx, chair, { chapterId: fx.chapter.id });
const page = await ctx.newPage();
const errors = watch(page, [], "smoke");

await page.goto(`${APP}/dashboard`, { waitUntil: "domcontentloaded" });
await settle(page);

const url = page.url();
const sessionSeen = await page.evaluate(() => {
  const raw = window.localStorage.getItem("sb-e2elocal-auth-token");
  return raw ? JSON.parse(raw).user?.email : null;
});
const bodyText = (await page.textContent("body")) || "";

console.log("final url        :", url);
console.log("session in store :", sessionSeen);
console.log("redirected to login:", url.includes("/login"));
console.log("chapter name on page:", bodyText.includes("Beta Theta Pi"));
console.log("body chars       :", bodyText.trim().length);
console.log("errors           :", errors.length);
for (const e of errors.slice(0, 12)) console.log("   -", e.kind, e.text.slice(0, 160));

await browser.close();
