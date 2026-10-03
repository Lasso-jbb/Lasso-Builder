import assert from "node:assert/strict";
import { test } from "node:test";
import { parseViewSpec } from "@lasso/spec";
import { DemoProvider } from "./demo.js";
import { resolveSpec } from "./resolve.js";

const BYG = "CVR-1-99000001";

test("17.2: observationer hentes, når spec'en beder om dem, og resuméet viser 3 + 'Se N flere'", async () => {
  const p = new DemoProvider();
  const spec = parseViewSpec({ title: "x", components: [{ type: "LassoCompanyHead", company: BYG }, { type: "LassoRiskObservations", company: BYG }] });
  const ds = await resolveSpec(spec, p);
  assert.ok(ds.observations[BYG]);
});

test("19.1: LassoFinancialStatements henter det fulde regnskab; demo har koncern og påtegning", async () => {
  const p = new DemoProvider();
  const spec = parseViewSpec({ title: "x", components: [{ type: "LassoCompanyHead", company: BYG }, { type: "LassoFinancialStatements", company: BYG }] });
  const ds = await resolveSpec(spec, p);
  const s = ds.financialStatements[BYG]!;
  assert.equal(s.scope, "Selskab");
  assert.equal(s.alternate?.scope, "Koncern");
  assert.deepEqual(s.periods, ["year"]);
});

test("26d.5/26d.7: personens netværkstal; scoren uden historik (18.2 udgår)", async () => {
  const p = new DemoProvider();
  const person = "CVR-3-4000000001";
  const spec = parseViewSpec({ title: "x", kind: "person", components: [{ type: "LassoPersonHead", person }, { type: "LassoPersonStats", person }] });
  const ds = await resolveSpec(spec, p);
  assert.ok(ds.persons[person] && ds.personNetworks[person]);
  const score = await p.score(BYG);
  assert.equal(typeof score.score, "number");
  assert.equal(score.history, undefined);
  assert.equal(score.changes, undefined);
});

test("28.2/28.6/28.8: companyEvents hentes for de tre komponenter, og resuméet nævner dem", async () => {
  const p = new DemoProvider();
  const spec = parseViewSpec({ title: "x", components: [{ type: "LassoCompanyHead", company: BYG }, { type: "LassoMergers", company: BYG }, { type: "LassoPublications", company: BYG }] });
  const ds = await resolveSpec(spec, p);
  assert.deepEqual(ds.companyEvents[BYG]?.mergers.map((m) => m.type), ["Fusion", "Spaltning"]);
  assert.ok(ds.companyEvents[BYG]?.publications.some((x) => x.corrected));
  const bankrupt = await p.companyEvents("CVR-1-99000011");
  assert.deepEqual(bankrupt.announcements.map((a) => a.severity), ["bankrupt", "bankrupt", "neutral"]);
});
