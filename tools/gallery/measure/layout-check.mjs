// B9: screenshot-tjek af komponerede sider i 1200 px: afkortede tekster (scrollWidth > clientWidth), overlappende
// tidsakse-etiketter (årstal) og vandret sideoverløb. Skriver layout-check.json og sektionen "B9 layout-tjek" i docs/bredde-maaling.md.
// Brug (fra repoets rod): PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs node tools/gallery/measure/layout-check.mjs [--no-md]
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = new URL("../../../", import.meta.url).pathname;
const out = mkdtempSync(join(tmpdir(), "layout-check-"));
execFileSync("npx", ["tsx", "tools/gallery/measure/layout-check-build.ts", out], { cwd: root, stdio: "inherit" });
const pages = JSON.parse(readFileSync(join(out, "pages.json"), "utf8"));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const browser = await chromium.launch();
const url = pathToFileURL(join(out, "layout-check.html")).href;
const WIDTH = 1200;

const results = [];
for (const p of pages) {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: 900 } });
  await page.goto(`${url}?i=${p.index}`);
  await page.waitForTimeout(600);
  const m = await page.evaluate(() => {
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const cs = getComputedStyle(el);
      return cs.visibility !== "hidden" && cs.display !== "none" && cs.opacity !== "0";
    };
    const txt = (el) => (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
    const host = document.getElementById("stage");
    const truncated = [];
    for (const el of host.querySelectorAll("*")) {
      if (!visible(el)) continue;
      const cs = getComputedStyle(el);
      const ell = cs.textOverflow === "ellipsis" && el.scrollWidth > el.clientWidth + 1;
      const clamp = cs.webkitLineClamp && cs.webkitLineClamp !== "none" && el.scrollHeight > el.clientHeight + 1;
      if (ell || clamp) truncated.push(txt(el));
    }
    // tidsakse-etiketter: synlige årstal på hver akse må ikke overlappe hinanden
    const overlaps = [];
    for (const axis of host.querySelectorAll(".lasso-personroles__ticks, .lasso-personnet__maxis")) {
      const ticks = [...axis.children].filter(visible).map((t) => ({ text: txt(t), r: t.getBoundingClientRect() })).sort((a, b) => a.r.left - b.r.left);
      for (let i = 0; i + 1 < ticks.length; i++) {
        if (ticks[i].r.right > ticks[i + 1].r.left - 1) overlaps.push(`${ticks[i].text} | ${ticks[i + 1].text}`);
      }
    }
    const netTicks = [...host.querySelectorAll(".lasso-personnet .lasso-personroles__tick")].filter(visible).length;
    const over = document.documentElement.scrollWidth - window.innerWidth;
    return { truncated, overlaps, netTicks, pageOverflow: Math.max(0, over) };
  });
  results.push({ id: p.id, types: p.types, truncated: m.truncated.length, truncatedSample: [...new Set(m.truncated)].slice(0, 5), overlap: m.overlaps.length, overlapSample: m.overlaps.slice(0, 5), netTicks: m.netTicks, pageOverflow: m.pageOverflow });
  await page.close();
}
await browser.close();

const date = new Date().toISOString().slice(0, 10);
const summary = { date, width: WIDTH, pages: results.length, truncated: results.reduce((s, r) => s + r.truncated, 0), overlap: results.reduce((s, r) => s + r.overlap, 0) };
writeFileSync(join(root, "tools/gallery/measure/layout-check.json"), JSON.stringify({ summary, results }, null, 2) + "\n");

const rows = results.map((r) => `| ${r.id} | ${r.truncated}${r.truncatedSample.length ? ` (${r.truncatedSample.map((s) => `"${s.slice(0, 30)}"`).join(", ")})` : ""} | ${r.overlap}${r.overlapSample.length ? ` (${r.overlapSample.join("; ")})` : ""} | ${r.netTicks || "-"} | ${r.pageOverflow} |`);
const section = `## B9 layout-tjek (${date})

Layout-testen er en del af eval-kørslen (\`npm run eval -w @lasso/server\`, linjen "layout: N/60 ok") og af \`npm test\` (\`apps/server/src/eval/layout.test.ts\`). Screenshot-tjekket (\`PLAYWRIGHT_MODULE=… node tools/gallery/measure/layout-check.mjs\`) tegner ${results.length} komponerede sider i ${WIDTH} px og måler afkortede tekster (ellipsis/line-clamp aktiv: scrollWidth > clientWidth), overlappende årstal på tidsakserne og vandret sideoverløb. Rå tal: \`tools/gallery/measure/layout-check.json\`.

| Side | afkortede | overlap (årstal) | synlige årstal på netværksaksen | sideoverløb px |
|---|---|---|---|---|
${rows.join("\n")}

I alt: ${summary.truncated} afkortede tekster, ${summary.overlap} overlappende årstal.
`;
if (!process.argv.includes("--no-md")) {
  const md = join(root, "docs/bredde-maaling.md");
  let s = readFileSync(md, "utf8");
  const at = s.indexOf("## B9 layout-tjek");
  if (at >= 0) {
    const next = s.indexOf("\n## ", at + 5);
    s = s.slice(0, at) + section + (next >= 0 ? s.slice(next) : "");
  } else s = s.replace(/\n*$/, "\n\n") + section;
  writeFileSync(md, s);
}
console.log(section);
process.exit(summary.overlap > 0 ? 1 : 0);
