import assert from "node:assert/strict";
import { test } from "node:test";
import { COMPONENT_CATALOG } from "@lasso/spec";
import { DemoProvider } from "../data/demo.js";
import { buildShowcase } from "./showcase.js";

test("/komponenter: begge faner får data, og alle katalogets komponenter er med", async () => {
  const boot = await buildShowcase(new DemoProvider(), { company: "CVR-1-99000001", person: "CVR-3-4000000001", peers: ["CVR-1-99000004", "CVR-1-99000008"], alternatives: ["CVR-1-99000004", "CVR-1-99000012"], compare: ["CVR-1-99000004", "CVR-1-99000008", "CVR-1-99000001"] });
  assert.equal(boot.tabs.length, 2);
  assert.ok(boot.tabs[0]!.dataset.companies["CVR-1-99000001"], "virksomhedens data mangler");
  assert.ok(boot.tabs[1]!.dataset.persons["CVR-3-4000000001"], "personens data mangler");
  const used = new Set(boot.tabs.flatMap((t) => t.items.map((x) => x.type)));
  assert.equal(used.size, COMPONENT_CATALOG.length);
  // Alternativerne: tomme typer kan vises med en anden virksomhed; kreditkomponenter aldrig (Creditsafe-kreditter).
  assert.equal(boot.alt.variants.LassoProperties?.length, 2);
  assert.equal(boot.alt.variants.LassoScoreGauge, undefined);
  assert.equal(boot.alt.compare.length, 3);
  assert.ok(boot.alt.dataset.companies["CVR-1-99000004"], "alternativets data mangler");
});
