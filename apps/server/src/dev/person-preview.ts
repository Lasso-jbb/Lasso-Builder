// Udviklerværktøj: skriver komponerede personsider (show_person, katalog 16) som HTML til visuel test,
// én fil pr. personfokus (FOCUS=risiko,historik for kun nogle).
// Brug: npx tsx apps/server/src/dev/person-preview.ts <ud-mappe> [navn eller CVR-3-id ...]
import { writeFileSync } from "node:fs";
import { composePerson, composePersonProbe, isPersonFocus, isPersonId, PERSON_FOCUSES } from "@lasso/spec";
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
  for (const focus of (process.env.FOCUS?.split(",") ?? PERSON_FOCUSES).filter(isPersonFocus)) {
    const dataset = await resolveSpec(composePersonProbe(id, focus), provider);
    const spec = composePerson(id, dataset, { focus, name: dataset.persons[id]?.name });
    const file = `${out}/person-${id}-${focus}.html`;
    writeFileSync(file, injectBoot(html, { mode: "web", spec, dataset }, spec.title));
    console.log(file, spec.components.map((c) => `${c.type.replace("Lasso", "")}${c.column ? `@${c.column}` : ""}`).join(" "));
  }
}
