// Galleri over alle designelementer tegnet fra koden, mærket med Paper-numre.
// Brug (fra repoets rod):
//   npx tsx tools/gallery/build.ts <ud-mappe>          -> <ud-mappe>/gallery.html + manifest.json
//   node tools/gallery/shoot.mjs <ud-mappe> [filter]   -> PNG'er (1200/390) + galleri.pdf
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { parseViewSpec, type Dataset } from "@lasso/spec";
import { DemoProvider } from "../../apps/server/src/data/demo.js";
import { resolveSpec } from "../../apps/server/src/data/resolve.js";
import { entries as ENTRIES } from "./measure/entries.js";

const out = process.argv[2];
if (!out) throw new Error("Angiv en ud-mappe");
mkdirSync(out, { recursive: true });
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const provider = new DemoProvider();
const data: Record<string, Dataset> = {};
const problems: string[] = [];
for (const [i, e] of ENTRIES.entries()) {
  if (!e.spec) continue;
  try {
    const spec = parseViewSpec(e.spec);
    const ds = await resolveSpec(spec, provider);
    e.mutate?.(ds);
    data[String(i)] = ds;
  } catch (err) {
    problems.push(`${e.nr} ${e.title}: ${(err as Error).message}`);
  }
}

const bundle = await build({
  entryPoints: [join(here, "measure/client.tsx")],
  bundle: true,
  format: "iife",
  write: false,
  jsx: "automatic",
  minify: true,
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "warning",
});
const js = bundle.outputFiles[0]!.text;
const css = readFileSync(join(here, "../../packages/ui/src/styles.css"), "utf8");
const fonts = ["400", "500", "600", "700"]
  .map((w) => {
    const file = require.resolve(`@fontsource/poppins/files/poppins-latin-${w}-normal.woff2`, { paths: [join(here, "../../apps/view")] });
    return `@font-face{font-family:"Poppins";font-style:normal;font-weight:${w};src:url(data:font/woff2;base64,${readFileSync(file).toString("base64")}) format("woff2")}`;
  })
  .join("\n");

const html = `<!doctype html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lasso-galleri</title>
<style>${fonts}\n${css}\nhtml,body{margin:0;padding:0;background:#fff}#stage{min-height:40px}</style></head>
<body><div id="stage"></div><script>window.__GALLERY_DATA__=${JSON.stringify(data).replace(/</g, "\\u003c")}</script><script>${js.replace(/<\/script/g, "<\\/script")}</script></body></html>`;
writeFileSync(join(out, "gallery.html"), html);
const manifest = ENTRIES.map((e, i) => ({ id: i, nr: e.nr, title: e.title, node: e.node, only: e.only, desktopWidth: e.desktopWidth, note: e.note, kind: e.spec ? "spec" : "ui" }));
writeFileSync(join(out, "manifest.json"), JSON.stringify(manifest, null, 1));
console.log(`${ENTRIES.length} elementer -> ${join(out, "gallery.html")}`);
if (problems.length) console.log("Problemer:\n" + problems.join("\n"));
