// Skærmbilleder (1200 og 390 px) af hvert galleri-element og samlet PDF.
// Brug: node tools/gallery/shoot.mjs <ud-mappe> [nr-præfiks]
// Playwright hentes fra PLAYWRIGHT_MODULE (sti til playwright/index.mjs) eller som "playwright".
//
// PDF'en (G4, G6): ét element pr. side. Billederne placeres med beregnede mål (mm) ud fra PNG'ernes
// pixelmål, så intet kan flyde ind over sidehovedet eller over på næste side. Alle billeder tegnes i
// samme målestok (1200 px = 192 mm), så et ¼-element står som ¼ af et fuldbredde-element. Et billede,
// der er for højt til siden, deles over flere sider ("fortsat 2/3"); intet skaleres ud over siden.
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
const STAGE_PAD = 24; // luften om elementet i galleriet (lasso-frame--bare / render-rammen)

/** Højden (px) af siden, hvis et fast placeret, synligt ark/scrim dækker viewporten; ellers 0. */
async function openSheetHeight(p) {
  return p.evaluate(() => {
    const vw = window.innerWidth, vh = window.innerHeight;
    for (const el of document.querySelectorAll(".lasso-menu__scrim, .lasso-dialog-wrap, .lasso-sheet-backdrop")) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || cs.position !== "fixed") continue;
      const r = el.getBoundingClientRect();
      if (r.width >= vw * 0.9 && r.height >= vh * 0.6) return Math.ceil(document.documentElement.scrollHeight);
    }
    return 0;
  });
}

async function shootOne(m) {
  const main = m.only === "mobile" ? [390] : m.only === "desktop" ? [m.desktopWidth ?? 1200] : [m.desktopWidth ?? 1200, 390];
  const widths = [...main, ...(m.extraWidths ?? [])];
  m.shots = [];
  for (const w of widths) {
    const p = await b.newPage({ viewport: { width: w, height: 800 }, deviceScaleFactor: 1 });
    p.on("pageerror", (e) => errors.push(`${m.nr} ${m.title} @${w}: ${e.message}`));
    const file = join(shots, `${String(m.id).padStart(3, "0")}-${w}.png`);
    try {
      await p.goto(`${page}?id=${m.id}`, { timeout: 20000 });
      await p.waitForFunction(() => window.__GALLERY_READY__ === true, null, { timeout: 5000 }).catch(() => undefined);
      await p.waitForTimeout(500);
      const stage = p.locator("#stage");
      if (m.gridWidth && w > 560 && !(m.extraWidths ?? []).includes(w)) {
        // G6: kun elementets egen bredde (+ luften) kommer med på billedet.
        // Dokumentkoordinater (siden kan være rullet, fx af et diagram, der centrerer sig).
        const box = await stage.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.left + window.scrollX, y: r.top + window.scrollY, width: r.width, height: r.height };
        });
        const width = Math.min(box.width, m.gridWidth + 2 * STAGE_PAD);
        await p.screenshot({ path: file, fullPage: true, animations: "disabled", clip: { x: box.x, y: box.y, width, height: box.height }, timeout: 20000 });
      } else if (w <= 560 && (await openSheetHeight(p)) > 0) {
        // Mobil med åbent ark (handlingsark, bundark): arket og scrimmen er fast placeret i viewporten,
        // så et billede af #stage alene viser kun scrimmen (02b.2, 04.3) eller klipper arket (02a.4, 18.3).
        // Billedet tages af hele viewporten; derefter lukkes arket, og feltet/elementet tages lukket.
        const h = Math.max(await openSheetHeight(p), 800);
        await p.screenshot({ path: file, fullPage: true, animations: "disabled", clip: { x: 0, y: 0, width: w, height: h }, timeout: 20000 });
        m.shots.push({ w, file, extra: false, variant: "med åbent ark" });
        await p.keyboard.press("Escape");
        await p.mouse.click(w - 2, 2);
        await p.waitForTimeout(300);
        if ((await openSheetHeight(p)) === 0) {
          const closed = join(shots, `${String(m.id).padStart(3, "0")}-${w}-lukket.png`);
          await stage.screenshot({ path: closed, animations: "disabled", timeout: 20000 });
          m.shots.push({ w, file: closed, extra: false, variant: "lukket" });
        }
        await p.close();
        continue;
      } else {
        await stage.screenshot({ path: file, animations: "disabled", timeout: 20000 });
      }
      m.shots.push({ w, file, extra: (m.extraWidths ?? []).includes(w) });
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

// ---------- PDF ----------
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const png = (f) => {
  const buf = readFileSync(f);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), src: `data:image/png;base64,${buf.toString("base64")}` };
};
// A4 liggende, margen 10 mm: 277 × 190 mm. Siden er 188 mm høj (lidt luft, så intet spilder over).
const PAGE_W = 277;
const PAGE_H = 188;
const HEAD_H = 12; // sidehoved med nummer og titel
const NOTE_LINE = 4.2; // mm pr. notelinje (10 px)
const CAP_H = 5; // billedtekst over hvert billede
const GAP = 8; // mm mellem billederne
const SCALE = 192 / 1200; // mm pr. px: 1200 px = 192 mm, 390 px = 62,4 mm
const MIN_FIT = 0.75; // et billede må skaleres ned til 75 % for at undgå en sidedeling

// 08.9/26f: 768–1199 er tablet (26.1), også når det er elementets hovedbredde.
const label = (s) => (s.w <= 560 ? `Mobil ${s.w} px${s.variant ? `, ${s.variant}` : ""}` : s.extra || s.w < 1200 ? `Tablet ${s.w} px` : `Desktop ${s.w} px`);

/** Rækker: hovedbilledet (desktop + mobil side om side) og derefter hver ekstra bredde for sig. */
function rows(m) {
  const main = m.shots.filter((s) => !s.extra);
  const extra = m.shots.filter((s) => s.extra);
  return [main, ...extra.map((s) => [s])].filter((r) => r.length);
}

async function pagesFor(m) {
  const noteLines = m.note ? Math.ceil(m.note.length / 160) : 0;
  const avail = PAGE_H - HEAD_H - noteLines * NOTE_LINE - (noteLines ? 2 : 0) - CAP_H;
  const out = [];
  let carry = [];
  const emit = (fixed, flow) => emitPages(out, fixed, flow);
  const flush = () => {
    if (carry.length) emit([], carry);
    carry = [];
  };
  for (const row of rows(m)) {
    const imgs = [];
    for (const s of row) {
      const p = png(s.file);
      imgs.push({ ...s, ...p, blank: await blankRows(p.src) });
    }
    const totalW = imgs.reduce((a, i) => a + i.w, 0);
    // Samme målestok for alle; kun hvis rækken er bredere end siden, skaleres den ned.
    let scale = Math.min(SCALE, (PAGE_W - GAP * (imgs.length - 1)) / totalW);
    const tallest = Math.max(...imgs.map((i) => i.h));
    if (tallest * scale > avail && tallest * scale * MIN_FIT <= avail) scale = avail / tallest;
    const slicePx = Math.floor(avail / scale);
    // Delingen lægges i en ensfarvet pixelrække (luft mellem kort/rækker), højst 30 % over sidens bund,
    // så tekst og kort ikke skæres midt over.
    const slices = (i) => {
      const cuts = [];
      let top = 0;
      while (top < i.h) {
        let end = Math.min(i.h, top + slicePx);
        if (end < i.h) {
          const floor = top + Math.floor(slicePx * 0.7);
          let c = end;
          while (c > floor && !i.blank[c]) c--;
          if (c > floor) end = c;
        }
        cuts.push({ top, hPx: end - top });
        top = end;
      }
      return cuts.map((c, k) => ({ i, k, n: cuts.length, top: c.top, hPx: c.hPx, w: i.w * scale, scale }));
    };
    // Første billede (desktop) står fast til venstre, én del pr. side; de øvrige (mobil) flyder som
    // spalter i den ledige bredde, så et højt mobilbillede ikke giver en side pr. 160 mm.
    const fixed = imgs.length > 1 ? slices(imgs[0]) : [];
    // Rækker med ét billede (fx tabletbredderne) flyder videre i samme spalteforløb som forrige række.
    if (!fixed.length) {
      carry.push(...imgs.flatMap(slices));
      continue;
    }
    flush();
    const flow = imgs.slice(1).flatMap(slices);
    emit(fixed, flow);
  }
  flush();
  return out.map((p, i, all) => ({ ...p, part: all.length > 1 ? `side ${i + 1} af ${all.length}` : "" }));
}

function emitPages(out, fixed, flow) {
  while (fixed.length || flow.length) {
    const parts = [];
    let used = 0;
    if (fixed.length) {
      const f = fixed.shift();
      parts.push(f);
      used = f.w;
    }
    while (flow.length && used + (used ? GAP : 0) + flow[0].w <= PAGE_W + 0.01) {
      const g = flow.shift();
      used += (used ? GAP : 0) + g.w;
      parts.push(g);
    }
    if (!parts.length) parts.push(flow.shift());
    const figs = parts
      .map(({ i, k, n, top, hPx, w, scale }) => `<figure style="width:${w.toFixed(2)}mm"><figcaption>${esc(label(i))}${n > 1 ? `, del ${k + 1} af ${n}` : ""}</figcaption><div class="clip" style="width:${w.toFixed(2)}mm;height:${(hPx * scale).toFixed(2)}mm"><img src="${i.src}" style="width:${w.toFixed(2)}mm;margin-top:${(-top * scale).toFixed(2)}mm"></div></figure>`)
      .join("");
    out.push({ figs });
  }
}

// Ensfarvede pixelrækker pr. billede (til delingen af høje billeder), målt i en browserside.
const probe = await b.newPage();
async function blankRows(src) {
  return probe.evaluate(async (url) => {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const out = new Array(c.height).fill(false);
    // Kun den midterste del af bredden tæller (kantlinjer i siderne må gerne løbe igennem).
    const x0 = Math.floor(c.width * 0.04), x1 = Math.ceil(c.width * 0.96);
    for (let y = 0; y < c.height; y++) {
      const r = y * c.width * 4;
      const a = r + x0 * 4;
      let same = true;
      for (let x = x0; x < x1 && same; x++) {
        const o = r + x * 4;
        if (Math.abs(d[o] - d[a]) + Math.abs(d[o + 1] - d[a + 1]) + Math.abs(d[o + 2] - d[a + 2]) > 6) same = false;
      }
      out[y] = same;
    }
    return out;
  }, src);
}
const pageSets = [];
for (const m of sel.filter((x) => x.shots.length)) pageSets.push([m, await pagesFor(m)]);
await probe.close();
const pages = pageSets
  .flatMap(([m, list]) =>
    list.map(
      (p) => `<section class="pg"><header><span class="nr">${esc(m.nr)}</span><span class="t">${esc(m.title)}${p.part ? `<span class="cont">${esc(p.part)}</span>` : ""}</span><span class="meta">${m.node ? "Paper " + esc(m.node) + ", " : ""}${m.kind === "spec" ? "visning med demodata" : "UI-komponent"}${m.gridWidth ? `, bredde ${m.gridWidth} px` : ""}</span></header>
${m.note ? `<p class="note">${esc(m.note)}</p>` : ""}<div class="row">${p.figs}</div></section>`,
    ),
  )
  .join("\n");
const toc = sel.map((m) => `<tr><td>${esc(m.nr)}</td><td>${esc(m.title)}</td><td>${m.kind === "spec" ? "Visning" : "UI"}</td></tr>`).join("");
const html = `<!doctype html><html lang="da"><head><meta charset="utf-8"><style>
@page{size:A4 landscape;margin:10mm}
body{font-family:Poppins,system-ui,sans-serif;color:#16181D;margin:0}
.cover{break-after:page;padding:20mm 10mm}.cover h1{font-size:28px;margin:0 0 6px}.cover p{color:#5B6068;font-size:12px}
table{border-collapse:collapse;font-size:9px;width:100%}td{padding:2px 6px;border-bottom:1px solid #E6E7EB}
.pg{break-after:page;break-inside:avoid;height:${PAGE_H}mm;overflow:hidden;display:flex;flex-direction:column;position:relative}
header{flex:none;height:${HEAD_H - 3}mm;box-sizing:border-box;display:flex;gap:10px;align-items:baseline;border-bottom:1px solid #E4E4E7;margin-bottom:3mm;background:#fff}
.nr{font-weight:700;color:#B2450F;font-size:16px}.t{font-weight:600;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}.cont{font-weight:400;color:#8A9099;font-size:12px;margin-left:6px}.meta{margin-left:auto;flex:none;color:#8A9099;font-size:10px}
.note{flex:none;font-size:10px;line-height:${NOTE_LINE}mm;color:#5B6068;margin:0 0 2mm}
.row{flex:none;display:flex;gap:${GAP}mm;align-items:flex-start}
figure{margin:0;flex:none}figcaption{font-size:9px;line-height:${CAP_H - 1}mm;height:${CAP_H}mm;color:#8A9099}
.clip{overflow:hidden;outline:1px solid #E6E7EB;outline-offset:-0.5px}.clip img{display:block}
</style></head><body><div class="cover"><h1>Lasso designkatalog, tegnet fra koden</h1><p>${sel.length} elementer. Hvert element er tegnet af komponenterne i Lasso-Builder med demodata og mærket med nummeret fra Paper, så det kan sammenlignes side om side med designkataloget. Ét element pr. side; alle billeder i samme målestok (1200 px = 192 mm), så hvert element står i sin egen bredde på 1200-gitteret. Høje elementer deles over flere sider. Genereret ${new Date().toISOString().slice(0, 10)}.</p><table>${toc}</table></div>${pages}</body></html>`;
writeFileSync(join(out, "galleri.html"), html);
const pdfPage = await b.newPage();
await pdfPage.goto(pathToFileURL(join(out, "galleri.html")).href);
await pdfPage.pdf({ path: join(out, "galleri.pdf"), format: "A4", landscape: true, printBackground: true, timeout: 0 });
await b.close();
if (errors.length) writeFileSync(join(out, "errors.txt"), errors.join("\n"));
console.log(`${sel.length} elementer, ${errors.length} fejl -> ${join(out, "galleri.pdf")}`);
if (!existsSync(join(out, "galleri.pdf"))) process.exit(1);
