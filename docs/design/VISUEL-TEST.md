# Visuel test mod Paper

1. `npm run build` (visningen skal være bygget).
2. Skriv en spec for din komponent i en JSON-fil, fx `/tmp/min.json`:
   `{ "title": "Test", "components": [{ "type": "LassoKeyValueList", "company": "CVR-1-99000001" }] }`
   Demovirksomheder: CVR-1-99000001 til CVR-1-99000012 (se `apps/server/src/data/demo.ts`).
3. `npx tsx apps/server/src/dev/render-preview.ts <ud-mappe> /tmp/min.json`
4. Tag skærmbilleder i 1200 og 390 px med Playwright. Chromium ligger i `/opt/pw-browsers`; kør ALDRIG `playwright install`.
   Er playwright ikke installeret, så `npm i --prefix <scratch-mappe> playwright@1.56` i din egen scratch-mappe.
   ```js
   import { chromium } from "playwright";
   const b = await chromium.launch();
   for (const w of [1200, 390]) {
     const p = await b.newPage({ viewport: { width: w, height: 900 } });
     await p.goto(`file://<ud-mappe>/min.html`); await p.waitForTimeout(600);
     await p.screenshot({ path: `<ud-mappe>/min-${w}.png`, fullPage: true }); await p.close();
   }
   await b.close();
   ```
5. Læs PNG'erne med Read og sammenlign med `get_screenshot` af elementet i Paper. Ret til det matcher.
