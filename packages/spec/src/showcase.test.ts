import assert from "node:assert/strict";
import { test } from "node:test";
import { COMPONENT_CATALOG } from "./catalog.js";
import { showcaseTabs } from "./showcase.js";

const input = { company: "CVR-1-34580820", companyName: "LASSO X A/S", person: "CVR-3-4000455341", personName: "Jakob Bech Benediktson", peers: ["CVR-1-32828353", "CVR-1-31479282"] as [string, string] };

test("udstillingen bruger alle katalogets komponenter, og alle specs er gyldige", () => {
  const tabs = showcaseTabs(input);
  const used = new Set(tabs.flatMap((t) => t.items.map((x) => x.type)));
  const missing = COMPONENT_CATALOG.map((c) => c.type).filter((t) => !used.has(t));
  assert.deepEqual(missing, []);
});

test("numrene følger kataloget og står i orden på hver fane", () => {
  for (const t of showcaseTabs(input)) {
    const ns = t.items.map((x) => x.n);
    assert.deepEqual(ns, [...ns].sort((a, b) => a - b));
    for (const x of t.items) assert.equal(COMPONENT_CATALOG[x.n - 1]!.type, x.type);
  }
});
