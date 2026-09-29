import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const out = process.argv[2];
const width = Number(process.argv[3] ?? 1200);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const manifest = JSON.parse(readFileSync(join(out, "manifest.json"), "utf8"));
const b = await chromium.launch();
const url = pathToFileURL(join(out, "gallery.html")).href;
for (const m of manifest) {
  const p = await b.newPage({ viewport: { width, height: 900 } });
  await p.goto(`${url}?id=${m.id}`);
  await p.waitForTimeout(600);
  const holes = await p.evaluate(() => [...document.querySelectorAll(".lasso-band")].map((band) => {
    const bb = band.getBoundingClientRect();
    return [...band.querySelectorAll(":scope > .lasso-column")].map((c) => { const r = c.getBoundingClientRect(); const last = c.lastElementChild?.getBoundingClientRect(); return Math.round(Math.max(bb.bottom - r.bottom, last ? r.bottom - last.bottom : 0)); });
  }));
  await p.addStyleTag({ content: ".lasso-band{align-items:start!important}.lasso-band>.lasso-column>.lasso-column__item:last-child{flex:none!important}" });
  await p.waitForTimeout(100);
  const bands = await p.evaluate(() => [...document.querySelectorAll(".lasso-band")].map((band) => {
    const cols = [...band.querySelectorAll(":scope > .lasso-column")];
    const hs = cols.map((c) => Math.round(c.getBoundingClientRect().height));
    const names = cols.map((c) => [...c.children].map((i) => ((i.querySelector("h2,h3,.lasso-section__title")?.textContent ?? i.firstElementChild?.className.split(" ")[0] ?? "?").slice(0, 16)) + "=" + Math.round(i.getBoundingClientRect().height)).join("+"));
    const tops = cols.map((c) => Math.round(c.getBoundingClientRect().top));
    const rowsSame = tops.every((t) => t === tops[0]);
    return { names, hs, dev: rowsSame ? Math.round(100 * (Math.max(...hs) - Math.min(...hs)) / Math.max(...hs)) : null };
  }));
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  console.log(`${m.title}${overflow ? " OVERFLOW" : ""}`);
  bands.forEach((x, i) => console.log(`   ${x.names.map((n, k) => `${n}:${x.hs[k]}`).join(" | ")}  dev ${x.dev}%  hul ${Math.max(...holes[i])}`));
  await p.close();
}
await b.close();
