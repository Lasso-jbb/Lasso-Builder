import assert from "node:assert/strict";
import { test } from "node:test";
import { COMPARE_DEFAULT_METRICS, composeCompare, isRankingQuestion } from "./composeCompare.js";
import type { ViewComponent } from "./spec.js";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `CVR-1-${99000001 + i}`);
const types = (cs: ViewComponent[]) => cs.map((c) => c.type);
const of = <T extends ViewComponent["type"]>(cs: ViewComponent[], t: T) => cs.find((c) => c.type === t) as Extract<ViewComponent, { type: T }>;

test("composeCompare: 2 virksomheder giver tabel, linjegraf med benchmark og opfølgninger", () => {
  const [a, b] = ids(2) as [string, string];
  const spec = composeCompare([a, b], { names: { [a]: "Alfa A/S", [b]: "Beta ApS" } });
  assert.deepEqual(types(spec.components), ["LassoCompareTable", "LassoLineChart", "LassoFollowUps"]);
  assert.equal(spec.title, "Alfa A/S vs. Beta ApS");
  assert.deepEqual(of(spec.components, "LassoCompareTable").metrics, [...COMPARE_DEFAULT_METRICS]);
  const line = of(spec.components, "LassoLineChart");
  assert.equal(line.company, a);
  assert.equal(line.benchmark, b);
  assert.equal(line.metric, "omsaetning");
  assert.equal(line.years, 5);
  const labels = of(spec.components, "LassoFollowUps").prompts.map((p) => p.label);
  assert.deepEqual(labels, ["Vis Alfa A/S", "Vis Beta ApS", "Sammenlign på soliditetsgrad"]);
  assert.match(of(spec.components, "LassoFollowUps").prompts[0]!.prompt, new RegExp(a));
});

test("composeCompare: linjegrafen falder tilbage til bruttofortjeneste uden omsætning", () => {
  const [a, b] = ids(2) as [string, string];
  const spec = composeCompare([a, b], { values: { [a]: { bruttofortjeneste: 5 }, [b]: { bruttofortjeneste: 7 } } });
  assert.equal(of(spec.components, "LassoLineChart").metric, "bruttofortjeneste");
});

test("composeCompare: 3 virksomheder med nøgletal fra spørgsmålet", () => {
  const refs = ids(3);
  const spec = composeCompare(refs, { question: "Sammenlign soliditeten de sidste 3 år" });
  assert.deepEqual(types(spec.components), ["LassoCompareTable", "LassoLineChart", "LassoFollowUps"]);
  const table = of(spec.components, "LassoCompareTable");
  assert.equal(table.companies.length, 3);
  assert.equal(table.metrics[0], "soliditetsgrad");
  assert.ok(table.metrics.length <= 5);
  const line = of(spec.components, "LassoLineChart");
  assert.equal(line.metric, "soliditetsgrad");
  assert.equal(line.years, 3);
  assert.equal(of(spec.components, "LassoFollowUps").prompts[2]!.label, "Sammenlign på overskudsgrad");
});

test("composeCompare: 8 virksomheder uden metric giver rangering på omsætning og de 3 største i tabellen (Jakob 01.10)", () => {
  const refs = ids(8);
  const values = Object.fromEntries(refs.map((r, i) => [r, { omsaetning: i * 10 }]));
  const spec = composeCompare(refs, { values });
  assert.deepEqual(types(spec.components), ["LassoRanking", "LassoCompareTable"]);
  const ranking = of(spec.components, "LassoRanking");
  assert.equal(ranking.companies.length, 8);
  assert.equal(ranking.metric, "omsaetning");
  const table = of(spec.components, "LassoCompareTable");
  assert.deepEqual(table.companies, refs.slice(5));
  assert.equal(spec.title, "Sammenligning af 8 virksomheder");
});

test("composeCompare: 8 virksomheder uden omsætning rangeres på bruttofortjeneste", () => {
  const refs = ids(8);
  const values = Object.fromEntries(refs.map((r, i) => [r, { bruttofortjeneste: i, omsaetning: i === 0 ? 1 : null }]));
  assert.equal(of(composeCompare(refs, { values }).components, "LassoRanking").metric, "bruttofortjeneste");
});

test("composeCompare: metric angivet giver rangering først og tabel med ≤ 3 nøgletal", () => {
  const refs = ids(3);
  const spec = composeCompare(refs, { metric: "resultat" });
  assert.deepEqual(types(spec.components), ["LassoRanking", "LassoCompareTable"]);
  assert.equal(of(spec.components, "LassoRanking").metric, "resultat");
  assert.equal(of(spec.components, "LassoRanking").companies[0], refs[0]);
  const metrics = of(spec.components, "LassoCompareTable").metrics;
  assert.equal(metrics[0], "resultat");
  assert.ok(metrics.length <= 3);
});

test("composeCompare: 'hvem er størst' giver rangering først, med nøgletal fra spørgsmålet", () => {
  const refs = ids(4);
  const størst = composeCompare(refs, { question: "Hvem er størst af de fire?" });
  assert.deepEqual(types(størst.components), ["LassoRanking", "LassoCompareTable"]);
  assert.equal(of(størst.components, "LassoRanking").metric, "omsaetning");
  const soliditet = composeCompare(refs, { question: "Hvem har den højeste soliditetsgrad?" });
  assert.equal(soliditet.components[0]!.type, "LassoRanking");
  assert.equal(of(soliditet.components, "LassoRanking").metric, "soliditetsgrad");
  assert.ok(isRankingQuestion("Hvem har flest ansatte"));
  assert.ok(isRankingQuestion("hvem er bedst"));
  assert.ok(!isRankingQuestion("Sammenlign X og Y"));
});

test("composeCompare: 10 virksomheder med rangering giver tabel med højst 3", () => {
  const spec = composeCompare(ids(10), { metric: "ansatte" });
  assert.equal(of(spec.components, "LassoRanking").companies.length, 10);
  assert.equal(of(spec.components, "LassoCompareTable").companies.length, 3);
});

test("composeCompare: dubletter fjernes, og under 2 afvises", () => {
  const [a] = ids(1) as [string];
  assert.throws(() => composeCompare([a, a]));
});

test("composeCompare: lavest/mindst giver order asc; størst giver standard (desc)", () => {
  const refs = ids(4);
  const lav = of(composeCompare(refs, { question: "Hvem har lavest soliditet?" }).components, "LassoRanking");
  assert.equal(lav.order, "asc");
  assert.equal(lav.metric, "soliditetsgrad");
  assert.equal(of(composeCompare(refs, { question: "Hvem har mindst omsætning?" }).components, "LassoRanking").order, "asc");
  assert.equal(of(composeCompare(refs, { question: "Hvem har færrest ansatte?" }).components, "LassoRanking").order, "asc");
  assert.equal(of(composeCompare(refs, { question: "Hvem er størst?" }).components, "LassoRanking").order, "desc");
});
