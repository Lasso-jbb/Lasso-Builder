import assert from "node:assert/strict";
import { test } from "node:test";
import { COMPONENT_CATALOG } from "./catalog.js";
import { showcaseTabs } from "./showcase.js";

const input = { company: "CVR-1-34580820", companyName: "LASSO X A/S", person: "CVR-3-4000455341", personName: "Jakob Bech Benediktson", peers: ["CVR-1-32828353", "CVR-1-31479282"] as [string, string] };

/** Udgåede komponenter (Jakob 30.09): står stadig i kataloget (gamle specs), men ikke i udstillingen. */
const RETIRED: readonly string[] = ["LassoPersonRisk", "LassoPersonFacts"];

test("udstillingen bruger alle katalogets komponenter (undtagen de udgåede), og alle specs er gyldige", () => {
  const tabs = showcaseTabs(input);
  const used = new Set<string>(tabs.flatMap((t) => t.items.map((x) => x.type)));
  const missing = COMPONENT_CATALOG.map((c) => c.type).filter((t) => !used.has(t) && !RETIRED.includes(t));
  assert.deepEqual(missing, []);
  for (const t of RETIRED) {
    assert.ok(COMPONENT_CATALOG.some((c) => c.type === t), `${t} står stadig i kataloget`);
    assert.ok(!used.has(t), `${t} er udgået og vises ikke`);
  }
});

test("numrene følger kataloget og står i orden på hver fane", () => {
  for (const t of showcaseTabs(input)) {
    const ns = t.items.map((x) => x.n);
    assert.deepEqual(ns, [...ns].sort((a, b) => a - b));
    for (const x of t.items) assert.equal(COMPONENT_CATALOG[x.n - 1]!.type, x.type);
  }
});
