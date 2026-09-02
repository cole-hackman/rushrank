/**
 * Screenshot every page and run the visual checks that can be made objective.
 *
 * Screenshots are for the human (and the design pass) to look at. The measured
 * checks below are the ones worth automating because they are unambiguous and
 * easy to miss by eye:
 *
 *   - horizontal overflow, which on a phone is the difference between a usable
 *     voting card and one you have to pan sideways to reach
 *   - tap targets under 44px, the threshold below which thumbs miss
 *   - text contrast below WCAG AA
 *   - images with no alt text
 *
 * Everything else -- typography, hierarchy, whether a page reads as finished --
 * is judged from the images, not guessed at here.
 *
 *   node visual.mjs
 */

import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fixtures, signIn, settle, routes, publicRoutes, APP, ROOT } from "./lib/harness.mjs";

const SHOTS = join(ROOT, "screens");
mkdirSync(SHOTS, { recursive: true });

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900, isMobile: false },
  { name: "mobile", width: 390, height: 844, isMobile: true },
];

const fx = fixtures();
const chair = fx.users.find((u) => u.role === "admin");
const findings = [];
const results = [];
const note = (severity, page, title, detail) => {
  findings.push({ severity, page, title, detail });
  console.log(`   [${severity}] ${page}: ${title} — ${detail}`);
};

/** WCAG relative luminance + contrast ratio. */
const AUDIT = `(() => {
  const lum = (c) => {
    const [r,g,b] = c.map(v => { v/=255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); });
    return 0.2126*r + 0.7152*g + 0.0722*b;
  };
  // Parse to [r,g,b,a]. Alpha matters: a badge with an 8%-opacity dark
  // background over a light card is legible, but treating that background as
  // fully opaque dark reports it as invisible text.
  const parse = (s) => {
    const m = (s||"").match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(",").map(x => parseFloat(x.trim()));
    return [p[0], p[1], p[2], p.length >= 4 ? p[3] : 1];
  };
  const over = (fg, bg) => {
    const a = fg[3];
    return [
      fg[0]*a + bg[0]*(1-a),
      fg[1]*a + bg[1]*(1-a),
      fg[2]*a + bg[2]*(1-a),
    ];
  };
  // Collect every translucent layer up to the first opaque one, then composite
  // them back down in paint order.
  const bgOf = (el) => {
    const layers = [];
    let n = el;
    while (n && n !== document.documentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c[3] > 0) {
        layers.push(c);
        if (c[3] >= 1) break;
      }
      n = n.parentElement;
    }
    let base = [255,255,255];
    for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
    return base;
  };
  const ratio = (a,b) => { const l1=lum(a), l2=lum(b); const hi=Math.max(l1,l2), lo=Math.min(l1,l2); return (hi+0.05)/(lo+0.05); };

  const doc = document.documentElement;
  const overflow = Math.max(0, doc.scrollWidth - doc.clientWidth);

  const small = [];
  const lowContrast = [];
  const noAlt = [];
  const offscreen = [];

  for (const el of document.querySelectorAll('button, a[href], [role="button"], input, select')) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (r.width === 0 || r.height === 0 || cs.visibility === "hidden" || cs.display === "none") continue;
    if (r.width < 44 || r.height < 44) {
      small.push({
        label: ((el.getAttribute("aria-label") || el.textContent || "").trim().slice(0,40)) || el.tagName.toLowerCase(),
        w: Math.round(r.width), h: Math.round(r.height),
      });
    }
    if (r.right > doc.clientWidth + 2) {
      offscreen.push(((el.getAttribute("aria-label") || el.textContent || "").trim().slice(0,40)) || el.tagName.toLowerCase());
    }
  }

  for (const el of document.querySelectorAll('p, span, div, li, td, th, h1, h2, h3, h4, label, a, button')) {
    if (!el.childNodes.length) continue;
    const direct = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 2);
    if (!direct) continue;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || cs.visibility === "hidden") continue;
    // WCAG exempts disabled controls, and flagging every greyed-out button
    // buries the failures that matter.
    if (el.disabled || el.closest("[disabled]") || cs.opacity === "0") continue;
    const fgRaw = parse(cs.color);
    if (!fgRaw || fgRaw[3] === 0) continue;
    const bg = bgOf(el);
    const fg = over(fgRaw, bg);
    const size = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight, 10) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    const cr = ratio(fg, bg);
    if (cr < need) {
      lowContrast.push({
        text: el.textContent.replace(/\\s+/g," ").trim().slice(0,50),
        ratio: Math.round(cr*100)/100, need, size: Math.round(size),
        color: cs.color, bg: 'rgb(' + bg.join(',') + ')',
      });
    }
  }

  for (const img of document.querySelectorAll('img')) {
    if (!img.getAttribute('alt') && img.getBoundingClientRect().width > 24) {
      noAlt.push(img.getAttribute('src')?.slice(0,60) || '(img)');
    }
  }

  const dedupe = (arr, k) => { const s = new Set(); return arr.filter(x => { const v = k(x); if (s.has(v)) return false; s.add(v); return true; }); };

  return {
    overflow,
    scrollWidth: doc.scrollWidth,
    clientWidth: doc.clientWidth,
    smallTargets: dedupe(small, x => x.label + x.w + x.h).slice(0, 12),
    smallTargetCount: small.length,
    lowContrast: dedupe(lowContrast, x => x.text + x.ratio).slice(0, 12),
    lowContrastCount: lowContrast.length,
    noAlt: [...new Set(noAlt)].slice(0, 6),
    offscreen: [...new Set(offscreen)].slice(0, 6),
    bodyChars: (document.body.innerText || "").trim().length,
  };
})()`;

const browser = await chromium.launch();

async function shoot(ctx, route, vp, { signedIn }) {
  const page = await ctx.newPage();
  await page.goto(`${APP}${route.path}`, { waitUntil: "domcontentloaded" }).catch(() => {});
  await settle(page, 1100);

  const file = join(SHOTS, `${route.name}-${vp.name}.png`);
  await page.screenshot({ path: file, fullPage: true }).catch(() => {});

  const a = await page.evaluate(AUDIT).catch(() => null);
  if (a) {
    if (vp.isMobile && a.overflow > 4) {
      note("high", route.name, "Horizontal overflow on mobile",
        `content is ${a.scrollWidth}px in a ${a.clientWidth}px viewport (${a.overflow}px over)` +
          (a.offscreen.length ? ` — e.g. "${a.offscreen[0]}"` : ""));
    }
    if (vp.isMobile && a.smallTargetCount > 0) {
      const worst = a.smallTargets.slice(0, 3).map((t) => `"${t.label}" ${t.w}x${t.h}`).join(", ");
      note(a.smallTargetCount > 6 ? "medium" : "low", route.name,
        `${a.smallTargetCount} tap target(s) under 44px`, worst);
    }
    if (a.lowContrastCount > 0) {
      const worst = a.lowContrast.sort((x, y) => x.ratio - y.ratio)[0];
      note(a.lowContrastCount > 8 ? "medium" : "low", route.name,
        `${a.lowContrastCount} text node(s) below WCAG AA (${vp.name})`,
        `worst ${worst.ratio}:1 (needs ${worst.need}) — "${worst.text}" ${worst.color} on ${worst.bg}`);
    }
    if (a.noAlt.length) {
      note("low", route.name, `${a.noAlt.length} image(s) without alt text`, a.noAlt.join(", "));
    }
    results.push({ route: route.name, viewport: vp.name, signedIn, ...a, screenshot: file });
  }
  await page.close();
}

for (const vp of VIEWPORTS) {
  console.log(`\n=== ${vp.name} (${vp.width}x${vp.height}) ===`);
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.isMobile,
    hasTouch: vp.isMobile,
    deviceScaleFactor: 2,
  });
  await signIn(ctx, chair, { chapterId: fx.chapter.id });
  for (const r of routes(fx)) {
    await shoot(ctx, r, vp, { signedIn: true });
    console.log(`  shot ${r.name}`);
  }
  await ctx.close();

  const anon = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.isMobile,
    hasTouch: vp.isMobile,
    deviceScaleFactor: 2,
  });
  for (const r of publicRoutes(fx)) {
    await shoot(anon, r, vp, { signedIn: false });
    console.log(`  shot ${r.name} (public)`);
  }
  await anon.close();
}

writeFileSync(join(ROOT, "report-visual.json"), JSON.stringify({ findings, results }, null, 2));
console.log(`\n=== ${findings.length} visual finding(s); screenshots in e2e/screens ===`);
const bySev = findings.reduce((a, f) => ((a[f.severity] = (a[f.severity] || 0) + 1), a), {});
console.log(bySev);

await browser.close();
