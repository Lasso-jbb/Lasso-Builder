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
  const p = adaptPerson("CVR-3-1", { name: "X Prøve", address: { secret: true, value: { postalDistrict: "Aarhus", postalCode: 8000, municipality: { name: "AARHUS" } } }, board: "noget" });
  assert.equal(p.city, undefined);
  assert.equal(p.zip, undefined);
  assert.equal(p.municipality, undefined);
  assert.equal(p.addressProtected, true);
  assert.deepEqual(p.roles, []);
  assert.equal(adaptPerson("CVR-3-1", null).name, "CVR-3-1");
  assert.equal(adaptPerson("CVR-3-1", null).addressProtected, undefined);
});

test("adaptPerson: stamoplysninger (postnummer, enhedsnummer, land) men aldrig gadenavn", () => {
  const p = adaptPerson("CVR-3-4000000001", current, history);
  assert.equal(p.zip, "1709");
  assert.equal(p.unitNumber, "4000000001");
  assert.equal(p.country, undefined);
  assert.equal(p.addressProtected, undefined);
  assert.ok(!JSON.stringify(p).includes("Prøvevej"));
  const abroad = adaptPerson("CVR-3-2", { name: "Y Prøve", address: { secret: false, value: { postalDistrict: "Malmö", countryCode: "SE" } } });
  assert.equal(abroad.country, "Sverige");
  assert.equal(adaptPerson("CVR-3-3", { name: "Z", address: { value: { countryCode: "DK" } } }).country, undefined);
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

test("adaptPersonNetwork: år sammen er den længste sammenhængende periode, ikke summen", () => {
  const rel = (cvr: number, from: string, to: string | null) => ({ companyName: `Selskab ${cvr} ApS`, cvr, status: "NORMAL", currentRoles: to ? [] : ["Direktør"], overlaps: [{ from, to, theirRoles: ["Direktør"] }] });
  const raw = [
    // 13 fælles selskaber i samme ti år: 10 år sammen, ikke 130.
    { name: "Mange Selskaber", unitNo: 4000000020, companyRelation: Array.from({ length: 13 }, (_, i) => rel(20000000 + i, "2010-01-01", "2020-01-01")) },
    // Et hul imellem bryder perioden: 2000–2005 og 2010–2012 giver 5 år.
    { name: "Med Hul", unitNo: 4000000021, companyRelation: [rel(30000001, "2000-01-01", "2005-01-01"), rel(30000002, "2010-01-01", "2012-01-01")] },
    // Rolle i ét selskab slutter 31.12, en ny i et andet begynder 01.01: én periode på 8 år.
    { name: "Tilstødende", unitNo: 4000000022, companyRelation: [rel(40000001, "2000-01-01", "2004-12-31"), rel(40000002, "2005-01-01", "2008-01-01")] },
    // Åben periode regnes til i dag.
    { name: "Stadig Sammen", unitNo: 4000000023, companyRelation: [rel(50000001, "2019-01-01", "2021-01-01"), rel(50000002, "2020-06-01", null)] },
  ];
  const n = adaptPersonNetwork("CVR-3-4000000001", raw, "2026-01-01");
  const years = Object.fromEntries(n.people.map((p) => [p.name, p.overlapYears]));
  assert.deepEqual(years, { "Mange Selskaber": 10, "Med Hul": 5, "Tilstødende": 8, "Stadig Sammen": 7 });
  // Sorteret efter år sammen, flest først.
  assert.deepEqual(n.people.map((p) => p.name), ["Mange Selskaber", "Tilstødende", "Stadig Sammen", "Med Hul"]);
});

test("adaptPersonSearch tager kun personer", () => {
  const rows = adaptPersonSearch({
    companies: { results: [{ lassoId: "CVR-1-12345678", name: "Firma A/S" }] },
    people: { results: [{ lassoId: "CVR-3-4000000001", name: "Mette Eksempel", city: "Aarhus" }, { lassoId: "CVR-1-1", name: "Fejl", type: "company" }] },
  });
  assert.deepEqual(rows, [{ lassoId: "CVR-3-4000000001", name: "Mette Eksempel", city: "Aarhus" }]);
});

test("adaptPersonNetwork (Jakob 30.09): stifter og revisor tæller ikke; ophørt uden slutdato er afsluttet, ikke 'siden'", () => {
  const raw = [
    // Kun stifter sammen: udelades helt.
    { name: "Kun Stifter", unitNo: 4000000030, companyRelation: [{ companyName: "Firma IVS", cvr: 30000030, status: "NORMAL", currentRoles: ["Stiftere"], overlaps: [{ from: "2014-01-03", to: null, theirRoles: ["Stiftere"], ownRoles: ["Stiftere"] }] }] },
    // Revisor i ét selskab, bestyrelse i et andet: kun bestyrelsen tæller.
    { name: "Revisor Og Bestyrelse", unitNo: 4000000031, companyRelation: [
      { companyName: "Revideret A/S", cvr: 30000031, status: "NORMAL", currentRoles: ["Underskrivende revisor"], overlaps: [{ from: "2017-01-01", to: null, theirRoles: ["Underskrivende revisor"], ownRoles: ["Direktør"] }] },
      { companyName: "Bestyrelse A/S", cvr: 30000032, status: "NORMAL", currentRoles: ["Bestyrelsesmedlem"], overlaps: [{ from: "2018-01-01", to: null, theirRoles: ["Bestyrelsesmedlem"], ownRoles: ["Direktør"] }] },
    ] },
    // Gået af bestyrelsen: åbent overlap, men ingen nuværende rolle -> afsluttet uden kendt slutdato.
    { name: "Gået Af", unitNo: 4000000033, companyRelation: [{ companyName: "Lasso X A/S", cvr: 34580820, status: "NORMAL", currentRoles: [], overlaps: [{ from: "2017-05-01", to: null, theirRoles: ["Bestyrelsesmedlem"], ownRoles: ["Direktør"] }] }] },
  ];
  const n = adaptPersonNetwork("CVR-3-4000000001", raw, "2026-01-01");
  assert.deepEqual(n.people.map((p) => p.name).sort(), ["Gået Af", "Revisor Og Bestyrelse"]);
  const rb = n.people.find((p) => p.name === "Revisor Og Bestyrelse")!;
  assert.deepEqual(rb.companies.map((c) => c.companyName), ["Bestyrelse A/S"]);
  const gone = n.people.find((p) => p.name === "Gået Af")!;
  assert.equal(gone.active, false);
  assert.equal(gone.companies[0]!.ended, true);
  assert.equal(gone.companies[0]!.to, undefined);
});
