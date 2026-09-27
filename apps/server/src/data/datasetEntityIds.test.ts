import assert from "node:assert/strict";
import { test } from "node:test";
import { composeProbe, emptyDataset } from "@lasso/spec";
import { DemoProvider } from "./demo.js";
import { datasetEntityIds, resolveSpec } from "./resolve.js";

/** De delte siders links (/k/, /p/, /e/, /v/): hvilke virksomheder og personer siden viser. */

test("datasetEntityIds samler ledelse, ejere, revisor, reelle ejere, nyheds- og tekstsegmenter, roller og netværk", () => {
  const ds = emptyDataset("live");
  ds.companies["CVR-1-11111111"] = { lassoId: "CVR-1-11111111", name: "Test ApS" };
  ds.people["CVR-1-11111111"] = [{ name: "Anne", role: "Direktør", lassoId: "CVR-3-4000000001" }, { name: "Uden ID", role: "Bestyrelsesmedlem" }];
  ds.ownership["CVR-1-11111111"] = {
    lassoId: "CVR-1-11111111",
    owners: [{ name: "Holding ApS", lassoId: "CVR-1-22222222", kind: "company" }],
    auditor: { name: "Crowe", lassoId: "CVR-1-33256876" },
  };
  ds.beneficialOwnership["CVR-1-11111111"] = { lassoId: "CVR-1-11111111", owners: [{ name: "Bo", lassoId: "CVR-4-5" }] };
  ds.news["CVR-1-11111111"] = {
    lassoId: "CVR-1-11111111",
    items: [{ source: "Lasso", headline: "x", extractSegments: [{ text: "Tanja", lassoId: "CVR-3-4007574142" }] }],
  };
  ds.textSections["CVR-1-11111111"] = {
    lassoId: "CVR-1-11111111",
    sections: [{ heading: "Revisoroplysninger", body: "Aaen", segments: [{ text: "Aaen", lassoId: "CVR-1-33241763" }] }],
  };
  ds.errors["people:CVR-1-44444444"] = "Ingen adgang (CVR-1-44444444)";
  const ids = datasetEntityIds(ds).sort();
  assert.deepEqual(ids, ["CVR-1-11111111", "CVR-1-22222222", "CVR-1-33241763", "CVR-1-33256876", "CVR-3-4000000001", "CVR-3-4007574142", "CVR-4-5"]);
});

test("datasetEntityIds tager kun gyldige virksomheds- og person-ID'er (ikke produktionsenheder eller små bogstaver)", () => {
  const ds = emptyDataset("live");
  ds.people["CVR-1-11111111"] = [
    { name: "A", role: "Direktør", lassoId: "cvr-3-1" },
    { name: "Enhed", role: "Deltager", lassoId: "CVR-2-1000000020" },
    { name: "B", role: "Deltager", lassoId: "CVR-1-123" },
  ];
  assert.deepEqual(datasetEntityIds(ds), ["CVR-1-11111111"]);
});

test("datasetEntityIds på demovirksomhedens side: personer, ejere og revisor er med", async () => {
  const ds = await resolveSpec(composeProbe("CVR-1-99000001", "overblik"), new DemoProvider());
  const ids = new Set(datasetEntityIds(ds));
  for (const p of ds.people["CVR-1-99000001"] ?? []) if (p.lassoId) assert.ok(ids.has(p.lassoId), p.name);
  assert.ok(ids.has("CVR-1-99000010"), "ejeren Eksempel Holding ApS");
  assert.ok(ids.has("CVR-1-99000002"), "revisoren Eksempel Revision Midt ApS");
});
