// Måler gridmodellen (23.1) på rigtige sider: huller og kolonnehøjde-afvigelse pr. bånd.
// Brug (fra repoets rod, efter build.ts eller tools/gallery/build.ts):
//   PLAYWRIGHT_MODULE=… node tools/gallery/pages/measure.mjs <ud-mappe> [bredder, fx 1200,1024,834,768,390] [nr-præfiks …] [--json fil]
// For hvert bånd (.lasso-band i layout 'columns', .lasso-dband i layout 'dashboard'):
//   hul = største lodrette afstand mellem et elements ramme og det næste (eller båndets bund) ud over
//         den faste afstand; stakkene strækkes, så det skal være 0.
//   afvigelse = (højeste − laveste stak) / højeste, målt på indholdet med strækningen slået fra, pr.
//         visuel række (på tablet folder båndene; på mobil er der én kolonne og ingen afvigelse).
// Celler i dashboardets gitter uden for bånd (fx to halve, der står i hver sin celle) tælles også.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const jsonAt = args.indexOf("--json");
const jsonFile = jsonAt >= 0 ? args.splice(jsonAt, 2)[1] : undefined;
const [out, widthArg = "1200", ...prefixes] = args;
const widths = widthArg.split(",").map(Number);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const manifest = JSON.parse(readFileSync(join(out, "manifest.json"), "utf8")).filter((m) => prefixes.length === 0 || prefixes.some((p) => m.nr.startsWith(p)));
const browser = await chromium.launch();
const url = pathToFileURL(join(out, "gallery.html")).href;
const results = [];

for (const m of manifest) {
  for (const width of widths) {
    if (m.only === "desktop" && width < 1200) continue;
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(`${url}?id=${m.id}`);
    await page.waitForTimeout(500);
    // 1) Huller med strækningen slået til (som siden tegnes).
    const holes = await page.evaluate(() => {
      const px = (v) => parseFloat(v) || 0;
      const out = [];
      for (const band of document.querySelectorAll(".lasso-band, .lasso-dband")) {
        const bb = band.getBoundingClientRect();
        if ([...band.children].some((s) => getComputedStyle(s).display === "contents")) {
          // Mobil med opløste kolonner: elementerne står direkte under hinanden; mål afstanden mellem dem.
          const items = [...band.querySelectorAll(":scope > * > *")].map((i) => i.getBoundingClientRect()).filter((r) => r.height > 0).sort((a, b) => a.top - b.top);
          let hole = 0;
          items.forEach((r, k) => {
            if (items[k + 1]) hole = Math.max(hole, items[k + 1].top - r.bottom);
          });
          out.push(Math.round(hole));
          continue;
        }
        const stacks = [...band.children];
        let hole = 0;
        for (const s of stacks) {
          const r = s.getBoundingClientRect();
          // Stakkens bund mod båndets bund (kun de stakke, der står i båndets nederste række).
          const lastRow = stacks.every((o) => o.getBoundingClientRect().top <= r.top + 1 || o.getBoundingClientRect().bottom <= r.top + 1);
          if (lastRow) hole = Math.max(hole, bb.bottom - r.bottom);
          const items = [...s.children];
          const gap = px(getComputedStyle(s).rowGap);
          items.forEach((it, k) => {
            const a = it.getBoundingClientRect();
            const next = items[k + 1]?.getBoundingClientRect();
            if (next) hole = Math.max(hole, next.top - a.bottom - gap);
            else hole = Math.max(hole, r.bottom - a.bottom);
          });
        }
        out.push(Math.round(hole));
      }
      // Dashboardceller uden for bånd: rækker med flere celler må ikke have tomrum under en kort celle.
      let cellHole = 0;
      const main = document.querySelector(".lasso-content--dashboard");
      if (main) {
        const cells = [...main.children].filter((c) => !c.classList.contains("lasso-dband") && !c.classList.contains("lasso-cell--full"));
        const rows = new Map();
        for (const c of cells) {
          const top = Math.round(c.getBoundingClientRect().top);
          rows.set(top, [...(rows.get(top) ?? []), c]);
        }
        for (const row of rows.values()) {
          if (row.length < 2) continue;
          const bottoms = row.map((c) => c.getBoundingClientRect().bottom);
          cellHole = Math.max(cellHole, Math.max(...bottoms) - Math.min(...bottoms));
        }
      }
      return { bands: out, cellHole: Math.round(cellHole) };
    });
    // 2) Afvigelse på indholdet: strækningen slås fra, og stakkene måles pr. visuel række.
    await page.addStyleTag({
      content:
        ".lasso-band,.lasso-dband{align-items:start!important}.lasso-band>.lasso-column>.lasso-column__item:last-child,.lasso-dstack__item:last-child,.lasso-dstack__item:last-child>*{flex:none!important}",
    });
    await page.waitForTimeout(100);
    const bands = await page.evaluate(() => {
      const label = (el) => (el.querySelector("h2,h3,.lasso-section__title")?.textContent ?? el.firstElementChild?.className.split(" ")[0] ?? "?").trim().slice(0, 18);
      return [...document.querySelectorAll(".lasso-band, .lasso-dband")].map((band) => {
        // Mobil: kolonnerne er opløst (display: contents) eller stablet i én kolonne; ingen afvigelse.
        if ([...band.children].some((s) => getComputedStyle(s).display === "contents") || getComputedStyle(band).flexDirection === "column") {
          return { stacks: [{ top: 0, left: 0, h: Math.round(band.getBoundingClientRect().height), w: Math.round(band.getBoundingClientRect().width), names: "én kolonne" }], dev: null };
        }
        const stacks = [...band.children].map((s) => {
          const r = s.getBoundingClientRect();
          const items = [...s.children].filter((c) => c.getBoundingClientRect().height > 0);
          const bottom = items.length ? Math.max(...items.map((c) => c.getBoundingClientRect().bottom)) : r.top;
          return { top: Math.round(r.top), left: Math.round(r.left), h: Math.round(bottom - r.top), w: Math.round(r.width), names: items.map((i) => `${label(i)}=${Math.round(i.getBoundingClientRect().height)}`).join(" + ") };
        });
        const rows = new Map();
        for (const s of stacks) rows.set(s.top, [...(rows.get(s.top) ?? []), s]);
        let dev = null;
        for (const row of rows.values()) {
          if (row.length < 2) continue;
          const hs = row.map((s) => s.h);
          const d = (Math.max(...hs) - Math.min(...hs)) / Math.max(...hs);
          dev = Math.max(dev ?? 0, d);
        }
        return { stacks, dev: dev === null ? null : Math.round(dev * 100) };
      });
    });
    // Vandret overløb = siden kan rulle sidelæns (et element, der ruller i sin egen beholder, tæller ikke).
    // Skjulte tooltips (.lasso-tip__bubble, visibility hidden) tæller ikke; de vises kun ved hover.
    await page.addStyleTag({ content: ".lasso-tip__bubble{display:none!important}" });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    // Sidehøjde (px) som tegnet med strækningen slået fra; bruges til højdebudgettet (23.3).
    const pageHeight = await page.evaluate(() => Math.round(document.getElementById("stage")?.getBoundingClientRect().height ?? document.documentElement.scrollHeight));
    const res = { nr: m.nr, title: m.title, width, overflow, pageHeight, cellHole: holes.cellHole, bands: bands.map((b, i) => ({ ...b, hole: holes.bands[i] ?? 0 })) };
    results.push(res);
    const maxDev = Math.max(0, ...res.bands.map((b) => b.dev ?? 0));
    const maxHole = Math.max(holes.cellHole, ...res.bands.map((b) => b.hole));
    console.log(`${m.nr} ${m.title.slice(0, 40)} @${width}: ${res.bands.length} bånd, højde ${pageHeight} px, hul ${maxHole} px, afvigelse ${maxDev} %${overflow ? ", VANDRET OVERLØB" : ""}`);
    for (const b of res.bands) console.log(`    ${b.stacks.map((s) => `[${s.w}] ${s.names} (${s.h})`).join(" | ")}  afv ${b.dev ?? "-"} %  hul ${b.hole}`);
    await page.close();
  }
}
await browser.close();
if (jsonFile) writeFileSync(jsonFile, JSON.stringify(results, null, 1));
