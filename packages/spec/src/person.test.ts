import assert from "node:assert/strict";
import { test } from "node:test";
import { composePerson, composePersonProbe, emptyDataset, isPersonId, parseViewSpec, personCompanies, personCounts, personRisk, roleKind, widthOf, type PersonVM } from "./index.js";

const ID = "CVR-3-4000000001";
const person: PersonVM = {
  lassoId: ID,
  name: "Mette Holm Eksempel",
  city: "København",
  roles: [
    { companyId: "CVR-1-11111111", companyName: "Data Eksempel A/S", kind: "direction", role: "Adm. direktør", from: "2012-05-14", active: true },
    { companyId: "CVR-1-11111111", companyName: "Data Eksempel A/S", kind: "board", role: "Bestyrelsesmedlem", from: "2016-01-01", active: true },
    { companyId: "CVR-1-22222222", companyName: "Holm Holding ApS", kind: "owner", role: "Ejer", share: "100 %", from: "2009-01-01", active: true },
    { companyId: "CVR-1-33333333", companyName: "Cloud Eksempel A/S", kind: "board", role: "Bestyrelsesmedlem", from: "2014-01-01", to: "2018-06-01", active: false, companyStatus: "Under konkurs", companyStatusKind: "warning", companyEnded: "2026-02-01" },
  ],
};

test("person-komponenterne valideres og har deres standardbredder", () => {
  const spec = parseViewSpec({
    kind: "person",
    title: "Mette",
    components: [
      { type: "LassoPersonHead", person: ID },
      { type: "LassoPersonRoles", person: ID },
      { type: "LassoPersonNetwork", person: ID },
      { type: "LassoPersonRisk", person: ID },
    ],
  });
  assert.equal(spec.kind, "person");
  assert.deepEqual(spec.components.map((c) => widthOf(c, "dashboard")), ["full", "full", "half", "half"]);
  assert.throws(() => parseViewSpec({ title: "x", components: [{ type: "LassoPersonHead" }] }));
});

test("isPersonId og roleKind", () => {
  assert.ok(isPersonId("CVR-3-4000000001"));
  assert.ok(!isPersonId("CVR-1-12345678"));
  assert.equal(roleKind("Adm. direktør"), "direction");
  assert.equal(roleKind("Bestyrelsesformand"), "board");
  assert.equal(roleKind("Reel ejer"), "owner");
  assert.equal(roleKind("EJER", "owner REGISTER"), "owner");
  assert.equal(roleKind("Interessent", "stakeholder"), "other");
});

test("roller samles pr. selskab, aktive først, og tælles", () => {
  const companies = personCompanies(person);
  assert.deepEqual(companies.map((c) => c.companyName), ["Holm Holding ApS", "Data Eksempel A/S", "Cloud Eksempel A/S"]);
  assert.deepEqual(personCounts(person), { activeRoles: 3, endedRoles: 1, activeCompanies: 2, companies: 3, firstYear: 2009 });
});

test("personrisiko: konkurs efter fratræden er ikke 'involveret'", () => {
  const r = personRisk(person);
  assert.equal(r.bankruptcies.length, 1);
  assert.equal(r.dissolutions.length, 0);
  assert.equal(r.bankruptcies[0]!.involved, false);
  assert.equal(r.bankruptcies[0]!.yearsBefore, 7);
  const still = personRisk({ ...person, roles: [{ ...person.roles[3]!, to: undefined, active: true, companyStatus: "Tvangsopløst" }] });
  assert.equal(still.dissolutions[0]!.involved, true);
});

test("composePerson: hoved og roller i fuld bredde, netværk | risiko i to kolonner", () => {
  const ds = emptyDataset("demo");
  ds.persons[ID] = person;
  ds.personNetworks[ID] = { lassoId: ID, people: [{ name: "Søren Eksempel", companies: [{ companyName: "Data Eksempel A/S" }], overlapYears: 14, active: true }] };
  const spec = composePerson(ID, ds);
  assert.equal(spec.layout, "columns");
  assert.equal(spec.title, "Mette Holm Eksempel");
  assert.deepEqual(spec.components.map((c) => `${c.type}${c.column ? `@${c.column}` : ""}`), ["LassoPersonHead", "LassoPersonRoles", "LassoPersonNetwork@1", "LassoPersonRisk@2"]);
});

test("composePerson: uden netværk står risiko alene i fuld bredde; alvorlig risiko rykker op", () => {
  const ds = emptyDataset("demo");
  ds.persons[ID] = { ...person, roles: [{ ...person.roles[3]!, to: undefined, active: true }] };
  const spec = composePerson(ID, ds);
  assert.deepEqual(spec.components.map((c) => `${c.type}${c.column ? `@${c.column}` : ""}`), ["LassoPersonHead", "LassoPersonRisk", "LassoPersonRoles"]);
});

test("composePerson uden persondata viser kun hovedet (som viser fejlen)", () => {
  const ds = emptyDataset("live");
  ds.errors[`person:${ID}`] = "Ikke fundet hos Lasso";
  assert.deepEqual(composePerson(ID, ds).components.map((c) => c.type), ["LassoPersonHead"]);
  assert.deepEqual(composePersonProbe(ID).components.map((c) => c.type), ["LassoPersonHead", "LassoPersonNetwork"]);
});
