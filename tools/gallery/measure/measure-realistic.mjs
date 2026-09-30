// Måler hver komponenttype med realistiske data i hver gitterbredde (A13). Se measure-realistic-build.ts.
//   node tools/gallery/measure/measure-realistic.mjs <mappe med gallery.html + manifest.json> [filter]
// Skriver tools/gallery/measure/widths-realistic.json.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const out = process.argv[2];
const filter = process.argv[3];
const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const manifest = JSON.parse(readFileSync(join(out, "manifest.json"), "utf8"));
const col = (n) => n * 74 + (n - 1) * 24; // 1200-gitter: indholdsbredde 1152, 12 kolonner à 74, gap 24
const WIDTHS = { quarter: col(3), third: col(4), half: col(6), "two-thirds": col(8), "three-quarters": col(9), full: col(12) };

/** Kører i siden: måler elementet i sin celle. */
function measure() {
  const cell = document.querySelector("#stage .lasso-dstack__item") ?? document.querySelector("#stage .lasso-cell");
  if (!cell) return { error: "ingen celle" };
  const host = cell.firstElementChild ?? cell;
  const cr = cell.getBoundingClientRect();
  const W = cr.width;
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== "hidden" && cs.display !== "none" && cs.opacity !== "0";
  };
  const all = [...host.querySelectorAll("*")].filter(visible);
  const inEllipsis = (el) => {
    for (let x = el; x && x !== host.parentElement; x = x.parentElement) if (getComputedStyle(x).textOverflow === "ellipsis") return true;
    return false;
  };

  // (a) afkortning: ellipsis aktiv (scrollWidth > clientWidth) eller linje-klipning aktiv (line-clamp)
  const truncated = [];
  for (const el of all) {
    const cs = getComputedStyle(el);
    const clampLines = cs.webkitLineClamp && cs.webkitLineClamp !== "none";
    const ell = cs.textOverflow === "ellipsis" && el.scrollWidth > el.clientWidth + 1;
    const clamp = clampLines && el.scrollHeight > el.clientHeight + 1;
    if (ell || clamp) truncated.push((el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 50));
  }
  // vandret rulning i et rulleområde (tabel, der ikke kan være i bredden)
  let hscroll = 0;
  let hscrollNeed = 0; // px indholdet kræver i det bredeste rulleområde
  for (const el of all) {
    const cs = getComputedStyle(el);
    if ((cs.overflowX === "auto" || cs.overflowX === "scroll") && el.scrollWidth > el.clientWidth + 8) {
      // Kun hvis der faktisk ligger synligt indhold (tekst eller celle) uden for højre kant; ellers er det et tomt rulleområde.
      const er = el.getBoundingClientRect();
      const beyond = [...el.querySelectorAll("*")].some((c) => {
        if (!visible(c)) return false;
        const r = c.getBoundingClientRect();
        return r.left >= er.right - 1 && (c.tagName === "TD" || c.tagName === "TH" || (c.children.length === 0 && (c.textContent ?? "").trim()));
      });
      if (beyond) {
        hscroll++;
        hscrollNeed = Math.max(hscrollNeed, el.scrollWidth);
      }
    }
  }

  // Synlig del af en rektangel: klippet af forfædre med overflow ≠ visible (skjulte linjer i line-clamp, rulleområder).
  const clipInfo = (el, rect) => {
    let l = rect.left, r = rect.right, t = rect.top, b = rect.bottom, cutX = false;
    for (let x = el; x && x !== host.parentElement; x = x.parentElement) {
      const cs = getComputedStyle(x);
      const ox = cs.overflowX, oy = cs.overflowY;
      if (ox === "visible" && oy === "visible") continue;
      const xr = x.getBoundingClientRect();
      if (ox !== "visible") {
        if (l < xr.left - 0.5 || r > xr.right + 0.5) if (ox === "hidden" || ox === "clip") cutX = true;
        l = Math.max(l, xr.left); r = Math.min(r, xr.right);
      }
      if (oy !== "visible") { t = Math.max(t, xr.top); b = Math.min(b, xr.bottom); }
    }
    return { l, r, t, b, cutX };
  };

  // tekstbokse (hver tekstnodes linjerektangler, klippet til det synlige)
  const boxes = [];
  let clipped = 0;
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.textContent.replace(/\s+/g, " ").trim();
    if (!t) continue;
    const el = n.parentElement;
    if (!el || !visible(el)) continue;
    const er = el.getBoundingClientRect();
    if (er.width <= 2 || er.height <= 2) continue; // skjult for øjet (sr-only)
    const range = document.createRange();
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) {
      if (r.width < 1 || r.height < 1) continue;
      const c = clipInfo(el, r);
      if (c.cutX && !inEllipsis(el) && c.r - c.l < r.width - 2 && c.r - c.l > 0) clipped++;
      if (c.r - c.l < 1 || c.b - c.t < 1) continue; // helt skjult
      boxes.push({ l: c.l, r: c.r, t: c.t, b: c.b, text: t.slice(0, 24), el });
    }
  }
  // svg-figurer, billeder og lærred tæller som indhold, ligesom løvelementer uden tekst med fyld (søjler, bjælker, målere)
  const shapeEls = [...host.querySelectorAll("svg, img, canvas")].filter(visible);
  for (const el of all) {
    if (el.children.length > 0 || (el.textContent ?? "").trim() || el.closest("svg")) continue;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const filled = cs.backgroundImage !== "none" || !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor);
    if (filled && r.width >= 3 && r.height >= 3) shapeEls.push(el);
  }
  // tabelceller: en tabel fylder sin bredde med kolonner (kolonneafstanden er en del af tabellen, ikke tom plads)
  for (const el of all) if (el.tagName === "TD" || el.tagName === "TH") shapeEls.push(el);
  const shapes = shapeEls.map((el) => {
    const c = clipInfo(el, el.getBoundingClientRect());
    return { l: c.l, r: c.r, t: c.t, b: c.b };
  }).filter((c) => c.r - c.l >= 1 && c.b - c.t >= 1);

  // (b) overlap mellem tekstbokse fra forskellige elementer: overlap ≥ 3 px i bredden og ≥ 40 % af den laveste bokses højde
  const overlaps = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const w = Math.min(a.r, b.r) - Math.max(a.l, b.l);
      const h = Math.min(a.b, b.b) - Math.max(a.t, b.t);
      if (w >= 3 && h >= 0.4 * Math.min(a.b - a.t, b.b - b.t)) overlaps.push(`${a.text} | ${b.text}`);
    }
  }

  // (c) tom plads. Indholdet pr. række (10 px-bånd): tekstbokse, figurer, fyldte bjælker og tabelceller.
  // Pr. række: det største sammenhængende tomme stykke (også til højre for det yderste indhold) / cellens bredde.
  // gapPct = medianen over rækkerne (typisk række); fanger "navn til venstre, dato til højre, tomt imellem" og "etiket + værdi,
  // tomt til højre", men tæller også tid før en tidsakses bjælke som tomt. coverEmptyPct = 100 % minus dækningen i den mest
  // dækkede række (bredeste række); overvurderer tomhed i jævnt fordelte kort. emptyPct = det mindste af de to.
  const rows = new Map();
  const add = (y, l, r) => {
    const k = Math.round(y / 10);
    if (!rows.has(k)) rows.set(k, []);
    rows.get(k).push([Math.max(l, cr.left), Math.min(r, cr.right)]);
  };
  for (const bx of boxes) add((bx.t + bx.b) / 2, bx.l, bx.r);
  // Figurer og bjælker fylder alle rækker, de spænder over (en høj graf er mange rækker, ikke én).
  for (const c of shapes) for (let y = c.t + 5; y < c.b + 5; y += 10) add(Math.min(y, c.b - 1), c.l, c.r);
  const stats = [...rows.values()].map((iv) => {
    iv.sort((x, y) => x[0] - y[0]);
    let covered = 0, maxGap = 0, cursor = cr.left;
    for (const [l, r] of iv) {
      if (r <= l) continue;
      if (l > cursor) maxGap = Math.max(maxGap, l - cursor);
      else if (cursor > l) covered -= Math.min(cursor, r) - l; // overlap med det, der allerede er talt
      covered += r - l;
      cursor = Math.max(cursor, r);
    }
    maxGap = Math.max(maxGap, cr.right - cursor);
    return { gap: maxGap / W, cover: covered / W };
  });
  const gaps = stats.map((x) => x.gap).sort((x, y) => x - y);
  const widestCover = stats.reduce((m, x) => Math.max(m, x.cover), 0);
  const covers = stats.map((x) => x.cover).sort((x, y) => x - y);
  const p75Cover = covers.length ? covers[Math.floor(0.75 * (covers.length - 1))] : 0;
  const medianGap = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 0;
  const pctOf = (f) => Math.max(0, Math.round(Math.min(f, 1) * 100));
  // til højre for indholdets yderste kant (bredeste række): "tom plads til højre"
  const maxRight = Math.max(cr.left, ...boxes.map((x) => x.r), ...shapes.map((x) => x.r));
  const rightEmpty = Math.max(0, Math.round(((cr.right - Math.min(maxRight, cr.right)) / W) * 100));
  return {
    h: Math.round(host.getBoundingClientRect().height),
    w: Math.round(W),
    truncated: truncated.length,
    truncatedSample: truncated.slice(0, 4),
    hscroll,
    hscrollNeed,
    clipped,
    overlaps: overlaps.length,
    overlapSample: overlaps.slice(0, 4),
    // tom plads = det mindste af (a) 100 % minus dækningen i de bredeste rækker (75-percentilen; en enkelt bred række, fx en lang
    // kapitaltekst, gør ikke en ellers tom liste fuld) og (b) typisk rækkes største hul (tæller ikke tid før en tidsakses bjælke som fuld).
    emptyPct: Math.min(100 - pctOf(p75Cover), pctOf(medianGap)),
    gapPct: pctOf(medianGap),
    p75EmptyPct: 100 - pctOf(p75Cover),
    coverEmptyPct: 100 - pctOf(widestCover),
    rightEmptyPct: rightEmpty,
    textBoxes: boxes.length,
  };
}

const b = await chromium.launch();
const page = pathToFileURL(join(out, "gallery.html")).href;
const res = {};
const jobs = [];
for (const m of manifest) {
  if (filter && !m.name.includes(filter)) continue;
  res[m.name] = { type: m.type, variant: m.variant, drivers: { ...m.drivers, longestLabel: m.longestLabel }, errors: m.errors, widths: {} };
  for (const k of Object.keys(WIDTHS)) jobs.push({ m, k });
}
let next = 0;
async function worker() {
  while (next < jobs.length) {
    const { m, k } = jobs[next++];
    const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
    await p.goto(`${page}?id=${m.id}&w=${k}`);
    await p.waitForTimeout(500);
    try {
      res[m.name].widths[k] = await p.evaluate(measure);
    } catch (e) {
      res[m.name].widths[k] = { error: String(e) };
    }
    await p.close();
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
await b.close();
for (const r of Object.values(res)) r.widths = Object.fromEntries(Object.keys(WIDTHS).map((k) => [k, r.widths[k]]));
const target = join(here, "widths-realistic.json");
writeFileSync(process.argv[4] ?? target, JSON.stringify({ cellWidths: WIDTHS, generated: new Date().toISOString().slice(0, 10), types: res }, null, 1));
console.log("ok", process.argv[4] ?? target);
