/**
 * The contrast pass reported several 1:1 readings (text the same colour as its
 * background, i.e. invisible). That is either a real defect or my background
 * walker mishandling a translucent layer. Resolve it by reading the actual
 * painted pixels instead of the cascade.
 */
import { chromium } from "playwright";
import { fixtures, signIn, settle, APP } from "./lib/harness.mjs";

const fx = fixtures();
const chair = fx.users.find((u) => u.role === "admin");
const browser = await chromium.launch();

for (const [route, needsAuth] of [
  ["/", false],
  ["/admin/users", true],
]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  if (needsAuth) await signIn(ctx, chair, { chapterId: fx.chapter.id });
  const page = await ctx.newPage();
  await page.goto(`${APP}${route}`, { waitUntil: "domcontentloaded" });
  await settle(page, 1200);

  const suspects = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("span, div, p, a, button, li")) {
      const t = (el.textContent || "").trim();
      if (!t || t.length > 30) continue;
      const direct = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!direct) continue;
      if (!/^(legacy|athlete|Admin|scholar|local|referred)$/i.test(t)) continue;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      out.push({
        text: t,
        color: cs.color,
        ownBg: cs.backgroundColor,
        parentBg: el.parentElement ? getComputedStyle(el.parentElement).backgroundColor : null,
        x: Math.round(r.x + r.width / 2),
        y: Math.round(r.y + r.height / 2),
        w: Math.round(r.width),
        h: Math.round(r.height),
      });
      if (out.length >= 6) break;
    }
    return out;
  });

  console.log(`\n=== ${route} ===`);
  for (const s of suspects) {
    console.log(`  "${s.text}" color=${s.color} ownBg=${s.ownBg} parentBg=${s.parentBg} (${s.w}x${s.h})`);
  }

  // Screenshot the element itself so the rendered result can be judged
  // directly. Element shots scroll into view; a page clip does not.
  if (suspects.length) {
    const name = route === "/" ? "landing" : "admin";
    try {
      const el = page
        .locator(`text="${suspects[0].text}"`)
        .first();
      await el.scrollIntoViewIfNeeded();
      const box = await el.boundingBox();
      if (box) {
        await page.screenshot({
          path: `screens/contrast-probe-${name}.png`,
          clip: {
            x: Math.max(0, box.x - 120),
            y: Math.max(0, box.y - 30),
            width: 280,
            height: Math.max(60, box.height + 60),
          },
        });
        console.log(`  cropped -> screens/contrast-probe-${name}.png`);
      }
    } catch (e) {
      console.log(`  (could not crop: ${e.message.slice(0, 60)})`);
    }
  }
  await ctx.close();
}

await browser.close();
