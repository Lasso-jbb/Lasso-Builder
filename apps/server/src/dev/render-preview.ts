// Udviklerværktøj: skriver demo-visninger som HTML til visuel test (docs/design/VISUEL-TEST.md).
// Brug: npx tsx apps/server/src/dev/render-preview.ts <ud-mappe> [spec.json ...]
// Uden spec-filer skrives standardvisningerne (virksomhed, liste, sammenligning).
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { companyTemplate, listTemplate, parseViewSpec, type ViewSpec } from "@lasso/spec";
import { DemoProvider } from "../data/demo.js";
import { resolveSpec } from "../data/resolve.js";
import { injectBoot, loadViewHtml } from "../web/page.js";

const [out, ...files] = process.argv.slice(2);
if (!out) throw new Error("Angiv en ud-mappe");
const provider = new DemoProvider();
const html = await loadViewHtml();
const specs: Record<string, ViewSpec> = files.length
  ? Object.fromEntries(files.map((f) => [basename(f, ".json"), parseViewSpec(JSON.parse(readFileSync(f, "utf8")))]))
  : {
      company: companyTemplate("CVR-1-99000001", { name: "Demo", sections: ["header", "noegletal", "graf", "ledelse", "ejerskab"], years: 5 }),
      list: listTemplate({ query: "", criteria: [], limit: 8 }, { title: "Eksempelvirksomheder" }),
      compare: parseViewSpec({ title: "Sammenligning", components: [{ type: "LassoCompareTable", companies: ["CVR-1-99000001", "CVR-1-99000002", "CVR-1-99000003"] }] }),
    };
for (const [name, spec] of Object.entries(specs)) {
  const dataset = await resolveSpec(spec, provider);
  writeFileSync(`${out}/${name}.html`, injectBoot(html, { mode: "web", spec, dataset }, spec.title));
  console.log(`${out}/${name}.html`);
}
