import assert from "node:assert/strict";
import { test } from "node:test";
import { parseViewSpec } from "@lasso/spec";
import { textCard } from "./card.js";
import { DemoProvider } from "./demo.js";
import { resolveSpec } from "./resolve.js";

const BYG = "CVR-1-99000001";
const QUIET = "CVR-1-99000012";

test("17.2: observationer hentes, når spec'en beder om dem, og tekstkortet viser 3 + 'Se N flere'", async () => {
  const p = new DemoProvider();
  const spec = parseViewSpec({ title: "x", components: [{ type: "LassoCompanyHead", company: BYG }, { type: "LassoRiskObservations", company: BYG }] });
  const ds = await resolveSpec(spec, p);
  assert.ok(ds.observations[BYG]);
  const card = textCard(spec, ds)!;
  assert.match(card, /RISIKOOBSERVATIONER/);
  assert.match(card, /Høj: Negativ egenkapital hos ejer/);
  assert.doesNotMatch(card, /·/);
  const quiet = parseViewSpec({ title: "x", components: [{ type: "LassoCompanyHead", company: QUIET }, { type: "LassoRiskObservations", company: QUIET }] });
  assert.match(textCard(quiet, await resolveSpec(quiet, p))!, /Intet at bemærke, tjekket\s+│?\s*│?\s*25\.09\.2026/);
});

test("19.1: LassoFinancialStatements henter det fulde regnskab; demo har koncern og påtegning", async () => {
  const p = new DemoProvider();
  const spec = parseViewSpec({ title: "x", components: [{ type: "LassoCompanyHead", company: BYG }, { type: "LassoFinancialStatements", company: BYG }] });
  const ds = await resolveSpec(spec, p);
  const s = ds.financialStatements[BYG]!;
  assert.equal(s.scope, "Selskab");
  assert.equal(s.alternate?.scope, "Koncern");
  assert.deepEqual(s.periods, ["year"]);
  assert.match(textCard(spec, ds)!, /Revideret af/);
});

test("26d.5/26d.7: personens netværkstal og scorens historik i demodata", async () => {
  const p = new DemoProvider();
  const person = "CVR-3-4000000001";
  const spec = parseViewSpec({ title: "x", kind: "person", components: [{ type: "LassoPersonHead", person }, { type: "LassoPersonStats", person }] });
  const ds = await resolveSpec(spec, p);
  assert.ok(ds.persons[person] && ds.personNetworks[person]);
  assert.match(textCard(spec, ds)!, /NETVÆRKSTAL[^]*Konkurser/);
  const score = await p.score(BYG);
  assert.ok((score.history?.length ?? 0) <= 6 && (score.history?.length ?? 0) >= 2);
  assert.equal(score.history?.at(-1)?.score, score.score);
  assert.equal(score.changes?.length, 3);
});

test("28.2/28.6/28.8: companyEvents hentes for de tre komponenter, og tekstkortet nævner dem", async () => {
  const p = new DemoProvider();
  const spec = parseViewSpec({ title: "x", components: [{ type: "LassoCompanyHead", company: BYG }, { type: "LassoMergers", company: BYG }, { type: "LassoPublications", company: BYG }] });
  const ds = await resolveSpec(spec, p);
  assert.deepEqual(ds.companyEvents[BYG]?.mergers.map((m) => m.type), ["Fusion", "Spaltning"]);
  assert.ok(ds.companyEvents[BYG]?.publications.some((x) => x.corrected));
  const card = textCard(spec, ds)!;
  assert.match(card, /FUSIONER OG SPALTNINGER/);
  assert.match(card, /REGNSKABSPUBLICERING/);
  const bankrupt = await p.companyEvents("CVR-1-99000011");
  assert.equal(bankrupt.announcements[0]?.severity, "neutral");
  assert.ok(bankrupt.announcements.some((a) => a.severity === "bankrupt"));
});
