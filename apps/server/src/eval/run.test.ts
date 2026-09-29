import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runEval, type EvalFile } from "./run.js";

test("runEval kører og giver ét plan-resultat pr. tilfælde", async () => {
  const file = JSON.parse(readFileSync(new URL("../../../../packages/spec/src/eval/questions.json", import.meta.url), "utf8")) as EvalFile;
  const report = await runEval();
  assert.equal(report.cases, file.cases.length);
  assert.equal(report.plan.total, file.cases.length);
  assert.equal(report.side.total, file.cases.filter((c) => c.dataInDemo).length);
  assert.equal(report.results.length, report.plan.total + report.side.total);
});
