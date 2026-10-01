import assert from "node:assert/strict";
import { test } from "node:test";
import { COMPONENT_CATALOG, companyRiskSummary, contactPersonGroup, DEFAULT_SHORTCUT_TOOLS, groupContactPersons, parseViewSpec, personRiskSummary, type PersonVM } from "./index.js";

test("08.1/30: LassoCompanyHead og LassoPersonHead tager variant og risk som valgfrie props", () => {
  const spec = parseViewSpec({
    title: "X",
    components: [
      { type: "LassoCompanyHead", company: "CVR-1-99000001" },
      { type: "LassoCompanyHead", company: "CVR-1-99000001", variant: "line", risk: true },
      { type: "LassoPersonHead", person: "CVR-3-4000000002", variant: "compact" },
    ],
  });
  assert.equal((spec.components[0] as { variant?: string }).variant, undefined, "show_company uden ændringer: standard er det fulde hoved");
  assert.equal((spec.components[1] as { variant?: string }).variant, "line");
  assert.throws(() => parseViewSpec({ title: "X", components: [{ type: "LassoCompanyHead", company: "CVR-1-99000001", variant: "stor" }] }));
});

test("08.4/modul 5 (Jakob 01.10): LassoShortcuts har katalogtekst og standardværktøjerne i portalens rækkefølge", () => {
  assert.deepEqual([...DEFAULT_SHORTCUT_TOOLS], ["overblik", "stamoplysninger", "noegletal", "ejerdiagram", "historik", "nyheder", "ejendomme", "tinglysning", "firmaindsigt"]);
  const entry = COMPONENT_CATALOG.find((e) => e.type === "LassoShortcuts");
  assert.ok(entry && /Brug til:.*Brug ikke når:.*Kræver:.*Eksempel:/s.test(entry.description));
  const spec = parseViewSpec({ title: "X", components: [{ type: "LassoShortcuts", company: "CVR-1-99000001", tools: ["ejerdiagram", "risiko"] }] });
  assert.equal(spec.components[0]!.type, "LassoShortcuts");
});

test("08.7: kontaktpersoner grupperes Direktion, Ledelse, Salg, IT-udvikling, Konsulenter, Øvrige", () => {
  assert.equal(contactPersonGroup({ role: "CEO" }), "Direktion");
  assert.equal(contactPersonGroup({ role: "Adm. direktør" }), "Direktion");
  assert.equal(contactPersonGroup({ role: "Salgschef" }), "Salg");
  assert.equal(contactPersonGroup({ role: "Key Account Manager" }), "Salg");
  assert.equal(contactPersonGroup({ role: "CTO" }), "IT-udvikling");
  assert.equal(contactPersonGroup({ role: "Økonomichef" }), "Ledelse");
  assert.equal(contactPersonGroup({ role: "Konsulent" }), "Konsulenter");
  assert.equal(contactPersonGroup({ role: "Receptionist" }), "Øvrige");
  assert.equal(contactPersonGroup({ role: "Receptionist", group: "Salg" }), "Salg");
  const groups = groupContactPersons([{ role: "Receptionist" }, { role: "CTO" }, { role: "CEO" }]).map((g) => g.group);
  assert.deepEqual(groups, ["Direktion", "IT-udvikling", "Øvrige"]);
});

test("24.4/16.1: risikolinjen kun ved 50+; info tælles som 'til orientering'", () => {
  const obs = (s: (0 | 25 | 50 | 100)[]) => ({ lassoId: "x", observations: s.map((severity, i) => ({ id: String(i), severity, title: `Fund ${i}` })) });
  assert.equal(companyRiskSummary(obs([25, 0])), null);
  assert.deepEqual(companyRiskSummary(obs([50, 25])), { severity: 50, text: "1 mulig vigtig observation: fund 0. 1 til orientering." });
  assert.equal(companyRiskSummary(obs([100, 50, 50]))?.text, "1 vigtig observation og 2 mulig vigtige.");
  const p: PersonVM = { lassoId: "CVR-3-1", name: "Prøve", roles: [], pep: { match: false }, strawman: { level: "none" } };
  assert.equal(personRiskSummary(p), null);
  assert.equal(personRiskSummary({ ...p, strawman: { level: "possible" } })?.text, "1 mulig vigtig observation: stråmandsindikator. Ingen PEP-match.");
});
