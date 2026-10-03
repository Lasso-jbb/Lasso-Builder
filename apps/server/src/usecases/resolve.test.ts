import assert from "node:assert/strict";
import { test } from "node:test";
import { loadConfig } from "../config.js";
import { DemoProvider } from "../data/demo.js";
import { candidatesAsText, resolveEntity } from "./resolve.js";

const ctx = { provider: new DemoProvider(), config: loadConfig({ LASSO_DATA_SOURCE: "demo" }) };

test("resolveEntity: ét match, flere match og intet match", async () => {
  const one = await resolveEntity(ctx, { kind: "person", query: "Gitte Prøve" });
  assert.equal(one.length, 1);
  assert.deepEqual(one[0], { kind: "person", id: "CVR-3-4000000007", name: "Gitte Prøve", subtitle: "Aalborg" });

  const many = await resolveEntity(ctx, { kind: "person", query: "Prøve" });
  assert.equal(many.length, 5, "standard højst 5");
  assert.equal((await resolveEntity(ctx, { kind: "person", query: "Prøve", limit: 50 })).length, 10, "højst 10");

  assert.deepEqual(await resolveEntity(ctx, { kind: "company", query: "Findes Ikke Overhovedet" }), []);
  assert.match(candidatesAsText("company", "Findes Ikke", []), /Ingen virksomheder matcher/);
});

test("resolveEntity: virksomheder får by, CVR og status; et id slås op direkte", async () => {
  const rev = await resolveEntity(ctx, { kind: "company", query: "Eksempel Revision" });
  assert.ok(rev.length >= 2);
  assert.equal(rev[0]!.subtitle, "Aarhus C, CVR 99000002, Aktiv");
  const byId = await resolveEntity(ctx, { kind: "company", query: "99000001" });
  assert.deepEqual(byId.map((c) => c.name), ["Eksempel Byg A/S"]);
  assert.match(candidatesAsText("company", "Eksempel Revision", rev), /^2 virksomheder for "Eksempel Revision" \(id \| navn \| detaljer\):\nCVR-1-99000002 \| Eksempel Revision Midt ApS \| Aarhus C, CVR 99000002, Aktiv/);
});

test("resolveEntity: en åben fane med navnet står først som præcist match, uden dublet fra søgningen", async () => {
  const open = [
    { kind: "person" as const, id: "CVR-3-4000000007", name: "Gitte Prøve" },
    { kind: "company" as const, id: "CVR-1-34580820", name: "LASSO X A/S" },
  ];
  const gitte = await resolveEntity(ctx, { kind: "person", query: "Gitte" }, open);
  assert.equal(gitte[0]!.id, "CVR-3-4000000007");
  assert.equal(gitte[0]!.subtitle, "åben fane");
  assert.equal(gitte.filter((c) => c.id === "CVR-3-4000000007").length, 1);
  // Et firma, demodata ikke kender, findes alligevel, fordi fanen er åben.
  const lasso = await resolveEntity(ctx, { kind: "company", query: "Lasso X" }, open);
  assert.deepEqual(lasso.map((c) => c.id), ["CVR-1-34580820"]);
  // Fanens type skal passe: en person-fane matcher ikke et virksomhedsopslag.
  assert.equal((await resolveEntity(ctx, { kind: "company", query: "Gitte Prøve" }, open)).length, 0);
});
