// Skærmbilleder (1200 og 390 px) af hvert galleri-element og samlet PDF.
// Brug: node tools/gallery/shoot.mjs <ud-mappe> [nr-præfiks]
// Playwright hentes fra PLAYWRIGHT_MODULE (sti til playwright/index.mjs) eller som "playwright".
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const [out, filter] = process.argv.slice(2);
if (!out) throw new Error("Angiv ud-mappen fra build.ts");
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const manifest = JSON.parse(readFileSync(join(out, "manifest.json"), "utf8"));
const shots = join(out, "png");
mkdirSync(shots, { recursive: true });
const page = pathToFileURL(join(out, "gallery.html")).href;
const b = await chromium.launch();
const sel = manifest.filter((m) => !filter || m.nr.startsWith(filter));
const errors = [];
async function shootOne(m) {
  const widths = m.only === "mobile" ? [390] : m.only === "desktop" ? [m.desktopWidth ?? 1200] : [m.desktopWidth ?? 1200, 390];
  m.shots = [];
  for (const w of widths) {
    const p = await b.newPage({ viewport: { width: w, height: 800 }, deviceScaleFactor: 1 });
    p.on("pageerror", (e) => errors.push(`${m.nr} ${m.title} @${w}: ${e.message}`));
    const file = join(shots, `${String(m.id).padStart(3, "0")}-${w}.png`);
    try {
      await p.goto(`${page}?id=${m.id}`, { timeout: 20000 });
      await p.waitForFunction(() => window.__GALLERY_READY__ === true, null, { timeout: 5000 }).catch(() => undefined);
      await p.waitForTimeout(500);
      await p.locator("#stage").screenshot({ path: file, animations: "disabled", timeout: 20000 });
      m.shots.push({ w, file });
    } catch (e) {
      errors.push(`${m.nr} ${m.title} @${w}: skærmbillede fejlede: ${e.message.split("\n")[0]}`);
    }
    await p.close();
  }
}
const queue = [...sel];
await Promise.all(Array.from({ length: 4 }, async () => {
  while (queue.length) await shootOne(queue.shift());
}));
writeFileSync(join(out, "shots.json"), JSON.stringify(sel, null, 1));

// PDF: én side pr. element, desktop til venstre (skaleret) og mobil til højre.
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const img = (f) => `data:image/png;base64,${readFileSync(f).toString("base64")}`;
const pages = sel
  .map((m) => {
    const d = m.shots.find((s) => s.w !== 390);
    const mob = m.shots.find((s) => s.w === 390);
    return `<section class="pg"><header><span class="nr">${esc(m.nr)}</span><span class="t">${esc(m.title)}</span><span class="meta">${m.node ? "Paper " + esc(m.node) + ", " : ""}${m.kind === "spec" ? "visning med demodata" : "UI-komponent"}</span></header>
${m.note ? `<p class="note">${esc(m.note)}</p>` : ""}<div class="row">${d ? `<figure class="d"><figcaption>Desktop ${d.w} px</figcaption><img src="${img(d.file)}"></figure>` : ""}${mob ? `<figure class="m"><figcaption>Mobil 390 px</figcaption><img src="${img(mob.file)}"></figure>` : ""}</div></section>`;
  })
  .join("\n");
const toc = sel.map((m) => `<tr><td>${esc(m.nr)}</td><td>${esc(m.title)}</td><td>${m.kind === "spec" ? "Visning" : "UI"}</td></tr>`).join("");
const html = `<!doctype html><html lang="da"><head><meta charset="utf-8"><style>
@page{size:A4 landscape;margin:10mm}
body{font-family:Poppins,system-ui,sans-serif;color:#16181D;margin:0}
.cover{page-break-after:always;padding:20mm 10mm}.cover h1{font-size:28px;margin:0 0 6px}.cover p{color:#5B6068;font-size:12px}
table{border-collapse:collapse;font-size:9px;width:100%;columns:2}td{padding:2px 6px;border-bottom:1px solid #E6E7EB}
.pg{page-break-after:always;height:188mm;display:flex;flex-direction:column}
header{display:flex;gap:10px;align-items:baseline;border-bottom:1px solid #E4E4E7;padding-bottom:6px;margin-bottom:8px}
.nr{font-weight:700;color:#B2450F;font-size:16px}.t{font-weight:600;font-size:16px}.meta{margin-left:auto;color:#8A9099;font-size:10px}
.note{font-size:10px;color:#5B6068;margin:0 0 6px}
.row{display:flex;gap:10mm;flex:1;min-height:0;align-items:flex-start}
figure{margin:0;display:flex;flex-direction:column;min-height:0;max-height:100%}figcaption{font-size:9px;color:#8A9099;margin-bottom:3px}
figure img{border:1px solid #E6E7EB;object-fit:contain;object-position:top left;max-height:170mm}
.d{flex:3 1 0;min-width:0}.d img{max-width:100%}.m{flex:0 0 62mm}.m img{width:62mm}
</style></head><body><div class="cover"><h1>Lasso designkatalog, tegnet fra koden</h1><p>${sel.length} elementer. Hvert element er tegnet af komponenterne i Lasso-Builder med demodata og mærket med nummeret fra Paper, så det kan sammenlignes side om side med designkataloget. Genereret ${new Date().toISOString().slice(0, 10)}.</p><table>${toc}</table></div>${pages}</body></html>`;
writeFileSync(join(out, "galleri.html"), html);
const pdfPage = await b.newPage();
await pdfPage.goto(pathToFileURL(join(out, "galleri.html")).href);
await pdfPage.pdf({ path: join(out, "galleri.pdf"), format: "A4", landscape: true, printBackground: true });
await b.close();
if (errors.length) writeFileSync(join(out, "errors.txt"), errors.join("\n"));
console.log(`${sel.length} elementer, ${errors.length} fejl -> ${join(out, "galleri.pdf")}`);
if (!existsSync(join(out, "galleri.pdf"))) process.exit(1);
