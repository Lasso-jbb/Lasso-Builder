import assert from "node:assert/strict";
import { test } from "node:test";
import { adaptCompanyHistory } from "./historyAdapters.js";

// Antaget form (som personhistorikken): grupper med { value, from, to, current } og stamdata som lister.
const raw = {
  lassoId: "CVR-1-34580820",
  management: [
    { value: { name: "Jakob Bech Benediktson", lassoId: "CVR-3-4000455341", role: { type: "ADM. DIR" } }, from: "2014-06-01", current: true },
    { value: { name: "Christian Weis Højfeldt", role: { type: "ADM. DIR" } }, from: "2012-05-14", to: "2014-05-31", current: false },
  ],
  board: [{ value: { name: "Rasmus Schmiegelow", role: { type: "FORMAND" } }, from: "2025-02-20", current: true }],
  owners: [{ value: { name: "BENEDIKTSON HOLDING ApS", cvr: "31479282", ownership: { from: 0.15, to: 0.1999 }, voteRights: { from: 0.15, to: 0.1999 } }, from: "2022-07-13", current: true }],
  names: [{ value: "LASSO X ApS", from: "2015-06-15", to: "2018-04-24" }, { value: "HUBSTER ApS", from: "2012-05-14", to: "2014-05-30" }],
  addresses: [{ value: { address1: "Rådhuspladsen 37", postalCode: "1550", postalDistrict: "København V" }, from: "2018-08-10", to: "2021-08-02" }],
  employeesMonthly: [{ value: { count: 16 }, from: "2026-07-01" }, { value: { count: 17 }, from: "2026-05-01", to: "2026-07-01" }],
  industries: [{ value: { code: "581900", text: "Anden udgivervirksomhed" }, from: "2017-01-19", to: "2024-12-31" }],
};

test("virksomhedshistorik: relationer i portalens grupper og stamdata over tid, nyeste først", () => {
  const h = adaptCompanyHistory("CVR-1-34580820", raw);
  assert.equal(h.source, "history");
  const jakob = h.relations.filter((r) => r.name === "Jakob Bech Benediktson");
  assert.deepEqual(jakob.map((r) => r.group), ["adm", "direktion"]);
  assert.equal(jakob[0]!.current, true);
  assert.equal(h.relations.find((r) => r.name === "Christian Weis Højfeldt")?.to, "2014-05-31");
  assert.equal(h.relations.find((r) => r.group === "bestyrelse")?.role, "Formand");
  const owner = h.relations.find((r) => r.group === "legale-ejere")!;
  assert.equal(owner.lassoId, "CVR-1-31479282");
  assert.match(owner.share ?? "", /15–19,99/);
  assert.deepEqual(h.fields.map((f) => f.label), ["Navn", "Adresse", "Ansatte - månedligt", "Branche"]);
  assert.deepEqual(h.fields[0]!.entries.map((e) => e.value), ["LASSO X ApS", "HUBSTER ApS"]);
  assert.equal(h.fields[1]!.entries[0]!.value, "Rådhuspladsen 37, 1550 København V");
  assert.equal(h.fields[2]!.entries[0]!.value, "16");
  assert.equal(h.fields[3]!.entries[0]!.value, "581900: Anden udgivervirksomhed");
});

test("virksomhedshistorik: ukendt form giver tom historik med note, aldrig en undtagelse", () => {
  const h = adaptCompanyHistory("x", "ikke et objekt");
  assert.equal(h.relations.length, 0);
  assert.ok(h.note);
});
