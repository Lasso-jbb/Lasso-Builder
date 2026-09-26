// Udviklerværktøj: skriver komponerede virksomhedsvisninger (show_company) som HTML til visuel test.
// Brug: npx tsx apps/server/src/dev/compose-preview.ts <ud-mappe> [lassoId] [focus ...]
import { writeFileSync } from "node:fs";
import { composeCompany, composeProbe, FOCUSES, type Focus } from "@lasso/spec";
import { DemoProvider } from "../data/demo.js";
import { resolveSpec } from "../data/resolve.js";
import { injectBoot, loadViewHtml } from "../web/page.js";

const [out, id = "CVR-1-99000001", ...focuses] = process.argv.slice(2);
if (!out) throw new Error("Angiv en ud-mappe");
const provider = new DemoProvider();
const html = await loadViewHtml();
for (const focus of (focuses.length ? focuses : FOCUSES) as Focus[]) {
  const dataset = await resolveSpec(composeProbe(id, focus), provider);
  const spec = composeCompany(id, dataset, { focus, name: dataset.companies[id]?.name });
  writeFileSync(`${out}/${focus}.html`, injectBoot(html, { mode: "web", spec, dataset }, spec.title));
  console.log(focus, spec.components.map((c) => `${c.type.replace("Lasso", "")}${c.column ? `@${c.column}` : ""}`).join(" "));
}
