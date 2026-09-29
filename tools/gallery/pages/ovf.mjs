import { pathToFileURL } from "node:url";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const b = await chromium.launch();
for (const w of [1200, 768, 390]) for (const id of [0, 1]) {
const p = await b.newPage({ viewport: { width: w, height: 900 } });
await p.goto(pathToFileURL(process.argv[2] + "/gallery.html").href + "?id=" + id);
await p.waitForTimeout(500);
console.log(w, id, await p.evaluate(() => { const W = window.innerWidth; return [...document.querySelectorAll("*")].filter(e => e.getBoundingClientRect().right > W + 1).slice(0, 4).map(e => e.tagName + "." + String(e.className).slice(0, 40) + " " + Math.round(e.getBoundingClientRect().right)); }));
await p.close(); }
await b.close();
