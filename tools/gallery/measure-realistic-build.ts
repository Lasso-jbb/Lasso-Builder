// Bygger målesiden med REALISTISKE data (A13). Brug (fra repoets rod):
//   npx tsx tools/gallery/measure-realistic-build.ts <ud-mappe>   -> <ud-mappe>/gallery.html + manifest.json
//   node tools/gallery/measure/measure-realistic.mjs <ud-mappe>   -> tools/gallery/measure/widths-realistic.json
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { parseViewSpec, savedPagesKey, type Dataset } from "@lasso/spec";
import { DemoProvider } from "../../apps/server/src/data/demo.js";
import { resolveSpec } from "../../apps/server/src/data/resolve.js";
import { REALISTIC, realisticize } from "./measure/realistic.js";

const out = process.argv[2];
if (!out) throw new Error("Angiv en ud-mappe");
mkdirSync(out, { recursive: true });
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const provider = new DemoProvider();
const data: Record<string, Dataset> = {};
const specs: Record<string, Record<string, unknown>> = {};
const manifest: Record<string, unknown>[] = [];
const problems: string[] = [];

for (const [i, e] of REALISTIC.entries()) {
  try {
    const spec = parseViewSpec({ title: e.name, layout: "stack", components: [{ ...e.comp, width: "full" }] });
    const ds = await resolveSpec(spec, provider);
    if (e.name === "LassoSavedPages") {
      const key = savedPagesKey({ kind: "all", limit: 8 });
      ds.savedPages[key] = { pages: [], total: 0, kind: "all", limit: 8 };
      delete ds.errors[`savedPages:${key}`];
    }
    realisticize(ds);
    e.mutate?.(ds);
    data[String(i)] = ds;
    specs[String(i)] = e.comp;
    // Længste etiket: længste navn (selskab/person) i de data, elementet faktisk tegner.
    let longest = 0;
    const scan = (v: unknown, k = ""): void => {
      if (typeof v === "string") {
        if (/^(name|companyName)$/.test(k)) longest = Math.max(longest, v.length);
      } else if (Array.isArray(v)) v.forEach((x) => scan(x, k));
      else if (v && typeof v === "object") for (const [kk, x] of Object.entries(v)) scan(x, kk);
    };
    scan(ds.companies); scan(ds.people); scan(ds.ownership); scan(ds.beneficialOwnership); scan(ds.contactPersons); scan(ds.persons); scan(ds.personNetworks);
    scan(ds.productionUnits); scan(ds.searches); scan(ds.savedPages); scan(ds.ownershipGraphs); scan(ds.changeFeeds); scan(ds.observations);
    manifest.push({ id: i, name: e.name, type: e.comp.type, variant: e.comp.variant, drivers: e.drivers, longestLabel: longest, errors: Object.values(ds.errors) });
  } catch (err) {
    problems.push(`${e.name}: ${(err as Error).message}`);
  }
}

const bundle = await build({ entryPoints: [join(here, "measure/client-realistic.tsx")], bundle: true, format: "iife", write: false, jsx: "automatic", minify: true, define: { "process.env.NODE_ENV": '"production"' }, logLevel: "warning" });
const js = bundle.outputFiles[0]!.text;
const css = readFileSync(join(here, "../../packages/ui/src/styles.css"), "utf8");
const fonts = ["400", "500", "600", "700"]
  .map((w) => {
    const file = require.resolve(`@fontsource/poppins/files/poppins-latin-${w}-normal.woff2`, { paths: [join(here, "../../apps/view")] });
    return `@font-face{font-family:"Poppins";font-style:normal;font-weight:${w};src:url(data:font/woff2;base64,${readFileSync(file).toString("base64")}) format("woff2")}`;
  })
  .join("\n");
const html = `<!doctype html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lasso-maaling</title>
<style>${fonts}\n${css}\nhtml,body{margin:0;padding:0;background:#fff}#stage{min-height:40px}</style></head>
<body><div id="stage"></div><script>window.__GALLERY_DATA__=${JSON.stringify(data).replace(/</g, "\\u003c")};window.__GALLERY_SPECS__=${JSON.stringify(specs).replace(/</g, "\\u003c")}</script><script>${js.replace(/<\/script/g, "<\\/script")}</script></body></html>`;
writeFileSync(join(out, "gallery.html"), html);
writeFileSync(join(out, "manifest.json"), JSON.stringify(manifest, null, 1));
console.log(`${manifest.length}/${REALISTIC.length} elementer -> ${join(out, "gallery.html")}`);
if (problems.length) console.log("Problemer:\n" + problems.join("\n"));
