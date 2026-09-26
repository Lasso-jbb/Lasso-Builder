import assert from "node:assert/strict";
import { test } from "node:test";
import { adaptPerson, adaptPersonNetwork, adaptPersonSearch } from "./personAdapters.js";

// Former fra docs.lassox.com/api/people/people og /cvrnetwork (26.09.2026), opdigtede værdier.
const company = (lassoId: string, name: string, role: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  lassoId,
  cvr: Number(lassoId.slice(6)),
  name,
  status: "NORMAL",
  form: { code: 60, shortDescription: "A/S" },
  lifeTime: { from: "2012-05-14T00:00:00", to: null },
  type: "VIRKSOMHED",
  role,
  ...extra,
});

const current = {
  lassoId: "CVR-3-4000000001",
  unitNumber: 4000000001,
  name: "John Eksempel",
  type: "PERSON",
  address: { secret: false, value: { address1: "Prøvevej 40", postalCode: 1709, postalDistrict: "København V", municipality: { name: "KØBENHAVN", code: 101 } } },
  management: [company("CVR-1-11111111", "AKTIESELSKABET A/S", { mainType: "LEDELSESORGAN", type: "Direktør", originalType: "DIREKTION" })],
  owner: [company("CVR-1-22222222", "HOLDING ApS", { mainType: "REGISTER", type: "EJER" }, { ownership: { from: 1, to: 1 } })],
  lastUpdated: "2026-09-01T10:00:00",
};

const history = {
  name: "John Eksempel",
  management: [{ value: company("CVR-1-11111111", "AKTIESELSKABET A/S", { mainType: "LEDELSESORGAN", type: "Direktør", originalType: "DIREKTION" }), from: "2012-07-02T00:00:00", to: null, current: true }],
  board: {
    value: company("CVR-1-33333333", "GAMMEL A/S", { mainType: "LEDELSESORGAN", type: "Bestyrelsesmedlem", originalType: "BESTYRELSE" }, { status: "UNDER KONKURS", lifeTime: { from: "2010-01-01", to: "2020-03-01T00:00:00" } }),
    from: "2012-07-02T00:00:00",
    to: "2014-05-31T00:00:00",
    current: false,
  },
};

test("adaptPerson læser nuværende roller og fra–til fra historikken", () => {
  const p = adaptPerson("CVR-3-4000000001", current, history);
  assert.equal(p.name, "John Eksempel");
  assert.equal(p.city, "København V");
  assert.equal(p.municipality, "København");
  assert.equal(p.updated, "2026-09-01");
  const byName = Object.fromEntries(p.roles.map((r) => [r.companyName, r]));
  assert.deepEqual(
    { kind: byName["AKTIESELSKABET A/S"]!.kind, from: byName["AKTIESELSKABET A/S"]!.from, active: byName["AKTIESELSKABET A/S"]!.active },
    { kind: "direction", from: "2012-07-02", active: true },
  );
  assert.equal(byName["HOLDING ApS"]!.kind, "owner");
  assert.equal(byName["HOLDING ApS"]!.share, "100 %");
  assert.equal(byName["GAMMEL A/S"]!.active, false);
  assert.equal(byName["GAMMEL A/S"]!.to, "2014-05-31");
  assert.equal(byName["GAMMEL A/S"]!.companyStatus, "Under konkurs");
  assert.equal(byName["GAMMEL A/S"]!.companyStatusKind, "warning");
  assert.equal(byName["GAMMEL A/S"]!.companyEnded, "2020-03-01");
  assert.equal(p.roles.length, 3);
});

test("adaptPerson tåler ukendte former og hemmelig adresse", () => {
  const p = adaptPerson("CVR-3-1", { name: "X Prøve", address: { secret: true, value: { postalDistrict: "Aarhus" } }, board: "noget" });
  assert.equal(p.city, undefined);
  assert.deepEqual(p.roles, []);
  assert.equal(adaptPerson("CVR-3-1", null).name, "CVR-3-1");
});

test("adaptPersonNetwork beregner overlap og sorterer efter år", () => {
  const raw = [
    { name: "Mogens Eksempel", unitNo: 4000000009, companyRelation: [{ companyName: "Selskabet ApS", cvr: 12332112, status: "ophørt", currentRoles: [], overlaps: [{ from: "2012-11-01T00:00:00", to: "2013-06-17T00:00:00", theirRoles: ["Administrerende direktør"], ownRoles: ["Bestyrelsesformand"] }] }] },
    { name: "Anna Prøve", unitNo: 4000000010, companyRelation: [{ companyName: "Nu A/S", cvr: 11111111, status: "NORMAL", currentRoles: ["Direktør"], overlaps: [{ from: "2016-01-01T00:00:00", to: null, theirRoles: ["Direktør"] }] }] },
  ];
  const n = adaptPersonNetwork("CVR-3-4000000001", raw, "2026-01-01");
  assert.deepEqual(n.people.map((x) => x.name), ["Anna Prøve", "Mogens Eksempel"]);
  const [anna, mogens] = n.people;
  assert.equal(anna!.lassoId, "CVR-3-4000000010");
  assert.equal(anna!.overlapYears, 10);
  assert.equal(anna!.active, true);
  assert.equal(anna!.companies[0]!.companyId, "CVR-1-11111111");
  assert.equal(mogens!.active, false);
  assert.equal(mogens!.until, "2013-06-17");
  assert.equal(mogens!.companies[0]!.role, "administrerende direktør");
  assert.deepEqual(adaptPersonNetwork("x", { unexpected: true }).people, []);
});

test("adaptPersonSearch tager kun personer", () => {
  const rows = adaptPersonSearch({
    companies: { results: [{ lassoId: "CVR-1-12345678", name: "Firma A/S" }] },
    people: { results: [{ lassoId: "CVR-3-4000000001", name: "Mette Eksempel", city: "Aarhus" }, { lassoId: "CVR-1-1", name: "Fejl", type: "company" }] },
  });
  assert.deepEqual(rows, [{ lassoId: "CVR-3-4000000001", name: "Mette Eksempel", city: "Aarhus" }]);
});
