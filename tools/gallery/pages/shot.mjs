import { pathToFileURL } from "node:url";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const b = await chromium.launch();
const [dir, ...specs] = process.argv.slice(2);
for (const s of specs) { const [id, w] = s.split("@").map(Number);
const p = await b.newPage({ viewport: { width: w, height: 900 } });
await p.goto(pathToFileURL(dir + "/gallery.html").href + "?id=" + id);
await p.waitForTimeout(700);
await p.screenshot({ path: `${dir}/p${id}-${w}.png`, fullPage: true }); await p.close(); }
await b.close();
