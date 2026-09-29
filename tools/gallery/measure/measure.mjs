// Måler hver katalogtypes højde i gitterets bredder (1200-gitter, 12 kolonner, gap 24).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const out = process.argv[2];
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const manifest = JSON.parse(readFileSync(join(out, "manifest.json"), "utf8"));
// Indholdsbredde 1152 (1200 minus 2×24), 12 kolonner à 74 + 11 gap à 24.
const col = (n) => n * 74 + (n - 1) * 24;
const WIDTHS = { "1/4": col(3), "1/3": col(4), "1/2": col(6), "2/3": col(8), "3/4": col(9), "1/1": col(12) };
const b = await chromium.launch();
const page = pathToFileURL(join(out, "gallery.html")).href;
const res = {};
for (const m of manifest) {
  res[m.title] = {};
  for (const [k, w] of Object.entries(WIDTHS)) {
    const p = await b.newPage({ viewport: { width: w + 48, height: 900 } });
    await p.goto(`${page}?id=${m.id}`);
    await p.waitForTimeout(700);
    const h = await p.evaluate(() => {
      const el = document.querySelector("#stage .lasso-cell > *, #stage .lasso-section, #stage section");
      const r = (el ?? document.querySelector("#stage")).getBoundingClientRect();
      const inner = document.querySelector("#stage .lasso-cell, #stage main")?.getBoundingClientRect();
      return { h: Math.round(r.height), w: Math.round((inner ?? r).width) };
    });
    res[m.title][k] = h;
    await p.close();
  }
  process.stdout.write(".");
}
await b.close();
writeFileSync(join(out, "heights.json"), JSON.stringify({ widths: WIDTHS, heights: res }, null, 1));
console.log("\nok");
