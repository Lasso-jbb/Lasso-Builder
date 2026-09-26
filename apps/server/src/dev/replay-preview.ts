// Udviklerværktøj: tegner et gemt tool-svar (JSON-RPC-resultat fra show_company/show_person) igen
// med den aktuelle komponist og render-app, så rigtige data kan sammenlignes før/efter.
// Brug: npx tsx apps/server/src/dev/replay-preview.ts <svar.json> <ud.html>
import { readFileSync, writeFileSync } from "node:fs";
import { composeCompany, composePerson, DATASET_META_KEY, type Dataset, type Focus, type ViewSpec } from "@lasso/spec";
import { injectBoot, loadViewHtml } from "../web/page.js";

const [input, out] = process.argv.slice(2);
if (!input || !out) throw new Error("Brug: replay-preview.ts <svar.json> <ud.html>");
const raw = JSON.parse(readFileSync(input, "utf8"));
const result = raw.result ?? raw;
const old = result.structuredContent.spec as ViewSpec;
const dataset = result._meta[DATASET_META_KEY] as Dataset;
const head = old.components.find((c) => c.type === "LassoCompanyHead" || c.type === "LassoPersonHead") as { company?: string; person?: string } | undefined;
let spec: ViewSpec = old;
if (old.kind === "company" && head?.company) {
  const labels: Record<string, Focus> = { Økonomi: "oekonomi", Regnskab: "regnskab", Ejerskab: "ejerskab", Ledelse: "ledelse", Risiko: "risiko", Historik: "historik", Kontakt: "kontakt" };
  spec = composeCompany(head.company, dataset, { focus: labels[old.subtitle ?? ""] ?? "overblik", name: dataset.companies[head.company]?.name });
} else if (old.kind === "person" && head?.person) {
  spec = composePerson(head.person, dataset, { name: dataset.persons[head.person]?.name });
}
writeFileSync(out, injectBoot(await loadViewHtml(), { mode: "web", spec, dataset }, spec.title));
console.log(spec.components.map((c) => `${c.type.replace("Lasso", "")}${c.column ? `@${c.column}` : ""}`).join(" "));
