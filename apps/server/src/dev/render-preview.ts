// Udviklerværktøj: skriver demo-visninger som HTML til visuel test (docs/design/VISUEL-TEST.md).
// Brug: npx tsx apps/server/src/dev/render-preview.ts <ud-mappe> [spec.json ...]
// Uden spec-filer skrives standardvisningerne (virksomhed, liste, sammenligning).
// Katalog 27: `--report <lassoId>` skriver i stedet report.html med A4-rapporten (ReportA4)
// for demovirksomheden, statisk renderet med styles.css og Poppins indlejret, så siden
// kan åbnes, skærmdumpes og printes (page.pdf) uden den byggede render-app. Kør fra repoets
// rod: tsx læser rodens tsconfig.json, som dækker alle pakker, så JSX i @lasso/ui oversættes.
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { companyTemplate, listTemplate, parseViewSpec, type ViewSpec } from "@lasso/spec";
import { DemoProvider } from "../data/demo.js";
import { resolveSpec } from "../data/resolve.js";
import { injectBoot, loadViewHtml } from "../web/page.js";

const args = process.argv.slice(2);
const reportAt = args.indexOf("--report");
const reportId = reportAt >= 0 ? args[reportAt + 1] : undefined;
if (reportAt >= 0) args.splice(reportAt, 2);
const [out, ...files] = args;
if (!out) throw new Error("Angiv en ud-mappe");
const provider = new DemoProvider();

if (reportId) {
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { ReportA4 } = await import("@lasso/ui");
  // Alt, rapporten bruger: stamdata, regnskab (5 år + fuldt regnskab), ledelse, ejere, reelle ejere, score, risiko og revisor.
  const spec = parseViewSpec({
    kind: "company",
    title: "Rapport",
    components: [
      { type: "LassoCompanyHead", company: reportId },
      { type: "LassoMultiYearTable", company: reportId, years: 5 },
      { type: "LassoIncomeStatement", company: reportId, years: 3 },
      { type: "LassoPersonList", company: reportId, show: "current" },
      { type: "LassoOwnerList", company: reportId },
      { type: "LassoBeneficialOwners", company: reportId },
      { type: "LassoScoreGauge", company: reportId },
      { type: "LassoRiskObservations", company: reportId },
      { type: "LassoAuditorIndependence", company: reportId },
    ],
  });
  const dataset = await resolveSpec(spec, provider);
  const require = createRequire(import.meta.url);
  const here = dirname(fileURLToPath(import.meta.url));
  const css = readFileSync(join(here, "../../../../packages/ui/src/styles.css"), "utf8");
  const fonts = ["400", "500", "600", "700"]
    .map((w) => {
      const file = require.resolve(`@fontsource/poppins/files/poppins-latin-${w}-normal.woff2`);
      const data = readFileSync(file).toString("base64");
      return `@font-face{font-family:"Poppins";font-style:normal;font-weight:${w};src:url(data:font/woff2;base64,${data}) format("woff2")}`;
    })
    .join("\n");
  const body = renderToStaticMarkup(createElement(ReportA4, { company: reportId, dataset }));
  const html = `<!doctype html><html lang="da"><head><meta charset="utf-8"><title>Virksomhedsrapport, ${dataset.companies[reportId]?.name ?? reportId}</title><style>${fonts}\n${css}\nhtml,body{margin:0;padding:0;background:var(--lasso-chrome)}</style></head><body><div class="lasso-root">${body}</div></body></html>`;
  writeFileSync(`${out}/report.html`, html);
  console.log(`${out}/report.html`);
} else {
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
}
