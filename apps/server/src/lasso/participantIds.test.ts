import assert from "node:assert/strict";
import { test } from "node:test";
import { adaptOwnership, adaptPeople, asLassoId, participantFieldNames, participantLassoId, participantNames } from "./adapters.js";
import { adaptBeneficialOwnershipDocumented, adaptOwnershipLegal } from "./ownershipAdapters.js";

/**
 * Lasso-ID'er på personer, ejere og revisor, så navnene kan åbnes (links på alle relationer).
 * Kun `lassoId` er bekræftet i company-full; ledelsens og bestyrelsens medlemmer er set uden, så
 * adapteren læser også indlejrede ID'er og afleder fra cvr (CVR-1-…) og unitNumber (CVR-3-…).
 */

// company-full, hvor ledelsen og bestyrelsen står uden lassoId på selve elementet (værdier opdigtede).
const COMPANY_WITHOUT_MEMBER_IDS = {
  lassoId: "CVR-1-11111111",
  name: "Test ApS",
  stakeholders: [{ name: "Holding ApS", type: "Company", lassoId: "CVR-1-22222222", role: { mainType: "EJER", type: "legal ejer" } }],
  management: {
    ceo: null,
    members: [
      { name: "Anne Direktør", unitNumber: 4000000001, role: { type: "direktør" }, from: "2020-01-01" },
      { participant: { name: "Bo Direktør", lassoId: "CVR-3-4000000002" }, role: { type: "direktør" } },
    ],
  },
  board: {
    chairman: { person: { name: "Carla Formand", lassoId: "cvr-3-4000000003" }, role: "Bestyrelsesformand" },
    members: [
      { entity: { name: "Dan Medlem", lassoId: "CVR-3-4000000004" }, name: "Dan Medlem", role: "Bestyrelsesmedlem" },
      { name: "Eva Medlem", relatedLassoId: "cvr-3-4000000005", role: "Bestyrelsesmedlem" },
      { name: "Finn Medlem", participant: { unitNumber: "4000000006" }, role: "Bestyrelsesmedlem" },
      { name: "Gitte Ejer", role: "Bestyrelsesmedlem" },
    ],
    alternates: [],
  },
  ownership: { owners: [{ name: "Gitte Ejer", type: "PERSON", lassoId: "CVR-3-4000000007", unitNumber: 4000000007 }] },
};

test("asLassoId normaliserer til store bogstaver og afviser alt andet end et Lasso-ID", () => {
  assert.equal(asLassoId("cvr-3-4009546580"), "CVR-3-4009546580");
  assert.equal(asLassoId(" CVR-1-24256790 "), "CVR-1-24256790");
  assert.equal(asLassoId("4009546580"), undefined);
  assert.equal(asLassoId("abc-123"), undefined);
  assert.equal(asLassoId(undefined), undefined);
});

test("participantLassoId: lassoId først, derefter indlejrede felter og relatedLassoId", () => {
  assert.equal(participantLassoId({ lassoId: "CVR-3-1", unitNumber: 9 }), "CVR-3-1");
  assert.equal(participantLassoId({ participant: { lassoId: "CVR-3-2" } }), "CVR-3-2");
  assert.equal(participantLassoId({ person: { lassoId: "CVR-3-3" } }), "CVR-3-3");
  assert.equal(participantLassoId({ entity: { lassoId: "CVR-1-12345678" } }), "CVR-1-12345678");
  assert.equal(participantLassoId({ relatedLassoId: "cvr-3-5" }), "CVR-3-5");
  // Et id, der ikke er et Lasso-ID, taber til et ægte Lasso-ID længere nede i listen.
  assert.equal(participantLassoId({ id: 42, participant: { lassoId: "CVR-3-6" } }), "CVR-3-6");
});

test("participantLassoId: cvr giver CVR-1-<8 cifre>, unitNumber giver CVR-3-<unitNumber>", () => {
  assert.equal(participantLassoId({ name: "Revision ApS", cvr: 33256876 }), "CVR-1-33256876");
  assert.equal(participantLassoId({ name: "Revision ApS", cvr: "33256876", unitNumber: 4001 }), "CVR-1-33256876", "cvr vinder over unitNumber");
  assert.equal(participantLassoId({ name: "Anne", unitNumber: 4009546580 }), "CVR-3-4009546580");
  assert.equal(participantLassoId({ name: "Anne", type: "PERSON", unitNumber: "4009546580" }), "CVR-3-4009546580");
  assert.equal(participantLassoId({ name: "Finn", participant: { unitNumber: 4000000006 } }), "CVR-3-4000000006");
  assert.equal(participantLassoId({ name: "Holding ApS", type: "VIRKSOMHED", unitNumber: 4001 }), undefined, "et selskab uden cvr får ikke et deltager-ID");
  assert.equal(participantLassoId({ name: "X", cvr: 123 }), undefined, "cvr skal være 8 cifre");
  assert.equal(participantLassoId({ name: "Uden ID" }), undefined);
  assert.equal(participantLassoId("Kun et navn"), undefined);
});

test("participantLassoId med unitNumber: 'person' (revisoren) kræver, at typen siger person", () => {
  assert.equal(participantLassoId({ name: "Revision", unitNumber: 4001 }, { unitNumber: "person" }), undefined);
  assert.equal(participantLassoId({ name: "Peter Revisor", type: "Person", unitNumber: 4001 }, { unitNumber: "person" }), "CVR-3-4001");
});

test("adaptPeople giver ledelsen og bestyrelsen Lasso-ID'er ad alle veje (også uden lassoId på elementet)", () => {
  const people = adaptPeople(COMPANY_WITHOUT_MEMBER_IDS);
  const byName = Object.fromEntries(people.map((p) => [p.name, p.lassoId]));
  assert.equal(byName["Anne Direktør"], "CVR-3-4000000001", "unitNumber");
  assert.equal(byName["Bo Direktør"], "CVR-3-4000000002", "participant.lassoId");
  assert.equal(byName["Carla Formand"], "CVR-3-4000000003", "person.lassoId, normaliseret");
  assert.equal(byName["Dan Medlem"], "CVR-3-4000000004", "entity.lassoId");
  assert.equal(byName["Eva Medlem"], "CVR-3-4000000005", "relatedLassoId");
  assert.equal(byName["Finn Medlem"], "CVR-3-4000000006", "participant.unitNumber");
  assert.equal(byName["Gitte Ejer"], "CVR-3-4000000007", "samme navn som en ejer med ét ID");
  assert.ok(!people.some((p) => p.name === "Holding ApS"), "ejere står stadig ikke i personlisten");
});

test("adaptPeople låner ikke et ID, når navnet hører til flere forskellige ID'er", () => {
  const people = adaptPeople({
    stakeholders: [
      { name: "Jens Hansen", lassoId: "CVR-3-1", role: { type: "direktør" } },
      { name: "Jens Hansen", lassoId: "CVR-3-2", role: { type: "bestyrelsesmedlem" } },
    ],
    board: { members: [{ name: "Jens Hansen", role: "Suppleant" }] },
  });
  assert.equal(people.find((p) => p.role === "Suppleant")?.lassoId, undefined);
});

test("participantNames kender også personer uden lassoId på elementet (til ejergrafens navne)", () => {
  const names = participantNames(COMPANY_WITHOUT_MEMBER_IDS);
  assert.equal(names.get("CVR-3-4000000001")?.name, "Anne Direktør");
});

test("adaptOwnership: ejer med cvr eller unitNumber og revisor med cvr får Lasso-ID'er", () => {
  const o = adaptOwnership("CVR-1-11111111", {
    ownership: {
      owners: [
        { name: "Moder ApS", type: "VIRKSOMHED", cvr: 22222222, ownership: { from: 1, to: 1 } },
        { name: "Anne Ejer", type: "PERSON", unitNumber: 4009546580, ownership: { from: 0.1, to: 0.1499 } },
      ],
    },
    accounting: { accountant: { name: "Crowe Statsautoriseret Revisionsinteressentskab", cvr: 33256876 } },
  });
  assert.equal(o.owners.find((x) => x.name === "Moder ApS")?.lassoId, "CVR-1-22222222");
  assert.equal(o.owners.find((x) => x.name === "Moder ApS")?.kind, "company");
  assert.equal(o.owners.find((x) => x.name === "Anne Ejer")?.lassoId, "CVR-3-4009546580");
  assert.equal(o.owners.find((x) => x.name === "Anne Ejer")?.kind, "person");
  assert.equal(o.auditor?.lassoId, "CVR-1-33256876");
});

test("adaptOwnership: revisor med lassoId, med indlejret ID, og uden ID", () => {
  assert.equal(adaptOwnership("x", { accounting: { accountant: { name: "R", lassoId: "CVR-1-33256876" } } }).auditor?.lassoId, "CVR-1-33256876");
  assert.equal(adaptOwnership("x", { accounting: { accountant: { name: "R", entity: { lassoId: "cvr-1-33256876" } } } }).auditor?.lassoId, "CVR-1-33256876");
  assert.equal(adaptOwnership("x", { accounting: { accountant: { name: "R", unitNumber: 4001 } } }).auditor?.lassoId, undefined);
  assert.equal(adaptOwnership("x", { accounting: { accountant: "Kun et navn" } }).auditor?.lassoId, undefined);
});

test("adaptOwnershipLegal: cvr -> CVR-1-…, unitNumber (person) -> CVR-3-…, lassoId uændret", () => {
  const o = adaptOwnershipLegal("CVR-1-11111111", {
    hasOwnersUnderFivePercent: false,
    owners: [
      { name: "EGGERT HOLDING ApS", type: "VIRKSOMHED", cvr: 36436344, ownership: { from: 0.05, to: 0.0999 } },
      { name: "Ella Eggert", type: "PERSON", unitNumber: 4009546580, ownership: { from: 0.1, to: 0.1499 } },
      { name: "JP/POLITIKENS HUS A/S", type: "VIRKSOMHED", lassoId: "CVR-1-10040403", cvr: 10040403, unitNumber: 4001 },
    ],
  })!;
  const byName = Object.fromEntries(o.owners.map((x) => [x.name, x.lassoId]));
  assert.equal(byName["EGGERT HOLDING ApS"], "CVR-1-36436344");
  assert.equal(byName["Ella Eggert"], "CVR-3-4009546580");
  assert.equal(byName["JP/POLITIKENS HUS A/S"], "CVR-1-10040403");
});

test("adaptBeneficialOwnershipDocumented: reel ejer med kun unitNumber får CVR-3-…", () => {
  const o = adaptBeneficialOwnershipDocumented("CVR-1-11111111", { owners: [{ name: "Ella Eggert", type: "PERSON", unitNumber: 4009546580, ownership: 0.44 }] })!;
  assert.equal(o.owners[0]!.lassoId, "CVR-3-4009546580");
});

test("participantFieldNames logger kun feltnavne (aldrig værdier) på første element i hver deltagerliste", () => {
  const fields = participantFieldNames(COMPANY_WITHOUT_MEMBER_IDS);
  assert.deepEqual(fields["management.members[0]"], ["name", "unitNumber", "role", "role.type", "from"]);
  assert.deepEqual(fields["board.chairman"], ["person", "person.name", "person.lassoId", "role"]);
  assert.equal(fields["management.ceo"], "mangler");
  assert.equal(fields["board.alternates[0]"], "tom");
  assert.deepEqual(fields["stakeholders[0]"], ["name", "type", "lassoId", "role", "role.mainType", "role.type"]);
  const json = JSON.stringify(fields);
  assert.ok(!json.includes("Anne") && !json.includes("4000000001"), "ingen værdier i loggen");
});
