// B9: bygger layout-check.html med et udvalg af komponerede sider (spec + data indlejret).
// Brug: npx tsx tools/gallery/measure/layout-check-build.ts <ud-mappe>   (kaldes af layout-check.mjs)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { composeCompany, composePerson, composePersonProbe, composeProbe, type Dataset, type ViewSpec } from "@lasso/spec";
import { DemoProvider } from "../../../apps/server/src/data/demo.js";
import { resolveSpec } from "../../../apps/server/src/data/resolve.js";
import { sideSpec, type EvalFile } from "../../../apps/server/src/eval/run.js";

const out = process.argv[2];
if (!out) throw new Error("Angiv en ud-mappe");
mkdirSync(out, { recursive: true });
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const provider = new DemoProvider();

const BYG = "CVR-1-99000001";
const KRO = "CVR-1-99000004";
const BO = "CVR-3-4000000002";
const EVAL_IDS = ["c-offentliggoerelser-01", "p-netvaerk-02", "c-soliditet-01", "c-ejere-01", "p-roller-01", "c-historik-02"];

const pages: { id: string; spec: ViewSpec; ds: Dataset }[] = [];
for (const f of ["overblik", "netvaerk"] as const) {
  const ds = await resolveSpec(composePersonProbe(BO, f), provider);
  pages.push({ id: `${BO} ${f}`, spec: composePerson(BO, ds, { focus: f, name: ds.persons[BO]?.name }), ds });
}
for (const c of [BYG, KRO])
  for (const f of ["overblik", "risiko", "historik"] as const) {
    const ds = await resolveSpec(composeProbe(c, f), provider);
    pages.push({ id: `${c} ${f}`, spec: composeCompany(c, ds, { focus: f, name: ds.companies[c]?.name }), ds });
  }
const file = JSON.parse(readFileSync(join(here, "../../../packages/spec/src/eval/questions.json"), "utf8")) as EvalFile;
for (const id of EVAL_IDS) {
  const c = file.cases.find((x) => x.id === id);
  if (!c) throw new Error(`Ukendt eval-id ${id}`);
  const { spec, dataset } = await sideSpec(c, provider);
  pages.push({ id, spec, ds: dataset });
}

const bundle = await build({
  entryPoints: [join(here, "layout-check-client.tsx")],
  bundle: true, format: "iife", write: false, jsx: "automatic", minify: true,
  define: { "process.env.NODE_ENV": '"production"' }, logLevel: "warning",
});
const js = bundle.outputFiles[0]!.text;
const css = readFileSync(join(here, "../../../packages/ui/src/styles.css"), "utf8");
const fonts = ["400", "500", "600", "700"]
  .map((w) => {
    const f = require.resolve(`@fontsource/poppins/files/poppins-latin-${w}-normal.woff2`, { paths: [join(here, "../../../apps/view")] });
    return `@font-face{font-family:"Poppins";font-style:normal;font-weight:${w};src:url(data:font/woff2;base64,${readFileSync(f).toString("base64")}) format("woff2")}`;
  })
  .join("\n");
const data = pages.map((p) => ({ spec: p.spec, ds: p.ds }));
const html = `<!doctype html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Layout-tjek</title>
<style>${fonts}\n${css}\nhtml,body{margin:0;padding:0;background:#fff}</style></head>
<body><div id="stage"></div><script>window.__PAGES__=${JSON.stringify(data).replace(/</g, "\\u003c")}</script><script>${js.replace(/<\/script/g, "<\\/script")}</script></body></html>`;
writeFileSync(join(out, "layout-check.html"), html);
writeFileSync(join(out, "pages.json"), JSON.stringify(pages.map((p, i) => ({ index: i, id: p.id, types: p.spec.components.map((c) => c.type) })), null, 1));
console.log(`${pages.length} sider -> ${join(out, "layout-check.html")}`);
