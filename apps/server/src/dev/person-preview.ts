// Udviklerværktøj: skriver komponerede personsider (show_person, katalog 16) som HTML til visuel test.
// Brug: npx tsx apps/server/src/dev/person-preview.ts <ud-mappe> [navn eller CVR-3-id ...]
import { writeFileSync } from "node:fs";
import { composePerson, composePersonProbe, isPersonId } from "@lasso/spec";
import { textCard } from "../data/card.js";
import { DemoProvider } from "../data/demo.js";
import { findPerson } from "../data/personLookup.js";
import { resolveSpec } from "../data/resolve.js";
import { injectBoot, loadViewHtml } from "../web/page.js";

const [out, ...refs] = process.argv.slice(2);
if (!out) throw new Error("Angiv en ud-mappe");
const provider = new DemoProvider();
const html = await loadViewHtml();
for (const ref of refs.length ? refs : ["Bo Eksempel"]) {
  const id = isPersonId(ref) ? ref : (await findPerson(provider, ref))?.pick.lassoId;
  if (!id) throw new Error(`Ingen demoperson: ${ref}`);
  const dataset = await resolveSpec(composePersonProbe(id), provider);
  const spec = composePerson(id, dataset, { name: dataset.persons[id]?.name });
  const file = `${out}/person-${id}.html`;
  writeFileSync(file, injectBoot(html, { mode: "web", spec, dataset }, spec.title));
  console.log(file, spec.components.map((c) => `${c.type.replace("Lasso", "")}${c.column ? `@${c.column}` : ""}`).join(" "));
  console.log(textCard(spec, dataset));
}
