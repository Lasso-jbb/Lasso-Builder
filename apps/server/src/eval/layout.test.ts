import assert from "node:assert/strict";
import { test } from "node:test";
import { runEval } from "./run.js";

/** Ø13/B9: layout-reglerne holder for alle 60 eval-sider (mindstebredde, smal ikke strakt, ikke over max). */
test("layout: alle 60 eval-sider overholder bredde-reglerne (0 overtrædelser)", async () => {
  const r = await runEval();
  assert.equal(r.layout.total, 60);
  assert.deepEqual(r.layout.violations.map((v) => `${v.id} ${v.type} ${v.width} (${v.rule}, grænse ${v.limit})`), []);
  assert.equal(r.layout.ok, 60);
});
