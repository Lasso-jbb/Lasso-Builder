import assert from "node:assert/strict";
import { test } from "node:test";
import { adaptBeneficialOwnership, adaptOwnershipGraph } from "./adapters.js";
import {
  BENEDIKTSON_HOLDING_ID,
  EGGERT_HOLDING_ID,
  JAKOB_BENEDIKTSON_ID,
  JP_POLITIKEN_ID,
  LASSO_X_LASSO_ID,
  LASSO_X_NAME,
  beneficialOwnersEmptyCouldNotIdentify,
  beneficialOwnersEmptyExempt,
  beneficialOwnersEmptyFallbackManagement,
  beneficialOwnersEmptyNotYetRegistered,
  beneficialOwnersLassoXRaw,
  legalOwnersLassoXRaw,
  ownershipGraphLassoXRaw,
} from "./fixtures/ownership.js";
import { adaptBeneficialOwnershipDocumented, adaptOwnershipLegal, withFallbackPeople } from "./ownershipAdapters.js";

/**
 * Tester ejerskabsadapterne mod de svarformer, Lassos egen dokumentation beskriver
 * (docs/endpoints-ejerskab.md, kilde: "## Ownership" og "## People › Information and relations").
 * Fixtures: apps/server/src/lasso/fixtures/ownership.ts (LASSO X A/S-eksemplet).
 */

test("adaptBeneficialOwnershipDocumented: præcise procenter, sortering og via-rolle-tekst", () => {
  const o = adaptBeneficialOwnershipDocumented(LASSO_X_LASSO_ID, beneficialOwnersLassoXRaw)!;
  assert.ok(o, "genkender den dokumenterede form");
  assert.equal(o.owners.length, 4);
  // Sorteret størst først; Ella og Lili har begge 44 %.
  assert.deepEqual(
    o.owners.map((x) => x.name),
    ["Ella Kaalund Eggert", "Lili Kaalund Eggert", "Jakob Bech Benediktson", "Christian Weis Højfeldt"],
  );
  // Præcist tal, ikke et interval.
  assert.equal(o.owners[0]!.share, "44 %");
  assert.equal(o.owners[2]!.share, "15,84 %");
  assert.equal(o.owners[0]!.chain, undefined, "direkte ejerskab har ingen kæde-tekst");
  // throughRole=true vises som ", via rolle" i muted efter navnet (28.9), ikke som en ejerkæde.
  assert.equal(o.owners[3]!.throughRole, true);
  assert.equal(o.owners[3]!.chain, undefined);
  assert.equal(o.gaps, undefined);
});

test("adaptBeneficialOwnershipDocumented: tom owners-liste udleder forklaring af de fire dokumenterede årsager", () => {
  assert.match(adaptBeneficialOwnershipDocumented("x", beneficialOwnersEmptyExempt)!.gaps![0]!.reason!, /undtaget/i);
  assert.match(adaptBeneficialOwnershipDocumented("x", beneficialOwnersEmptyNotYetRegistered)!.gaps![0]!.reason!, /endnu ikke registreret/i);
  assert.match(adaptBeneficialOwnershipDocumented("x", beneficialOwnersEmptyCouldNotIdentify)!.gaps![0]!.reason!, /ikke.*identificere/i);
  assert.match(adaptBeneficialOwnershipDocumented("x", beneficialOwnersEmptyFallbackManagement)!.gaps![0]!.reason!, /25 %/);
  // fallbackDescription, når den er sat, vinder over de udledte tekster.
  const withDescription = { ...beneficialOwnersEmptyExempt, fallbackDescription: "Lassos egen forklaringstekst." };
  assert.equal(adaptBeneficialOwnershipDocumented("x", withDescription)!.gaps![0]!.reason, "Lassos egen forklaringstekst.");
});

test("28.9: de tre særlige tilstande udledes af couldNotIdentify, exemptionStatus og fallbackType", () => {
  assert.equal(adaptBeneficialOwnershipDocumented("x", beneficialOwnersEmptyCouldNotIdentify)!.special?.kind, "unidentified");
  const exempt = adaptBeneficialOwnershipDocumented("x", beneficialOwnersEmptyExempt)!.special;
  assert.equal(exempt?.kind, "exempt");
  assert.ok(exempt?.caveat);
  const mgmt = adaptBeneficialOwnershipDocumented("x", beneficialOwnersEmptyFallbackManagement)!.special;
  assert.equal(mgmt?.kind, "management");
  assert.equal(mgmt?.fallback, "management");
  assert.equal(adaptBeneficialOwnershipDocumented("x", beneficialOwnersEmptyNotYetRegistered)!.special, undefined);
  assert.equal(adaptBeneficialOwnershipDocumented(LASSO_X_LASSO_ID, beneficialOwnersLassoXRaw)!.special, undefined);
});

test("adaptBeneficialOwnershipDocumented: undefined for en form uden owners-array (falder tilbage)", () => {
  assert.equal(adaptBeneficialOwnershipDocumented("x", [{ name: "Anne", totalOwnerPercentageMin: 20 }]), undefined);
  assert.equal(adaptBeneficialOwnershipDocumented("x", { notOwners: [] }), undefined);
});

test("adaptBeneficialOwnership (adapters.ts) læser den dokumenterede form FØRST, gætteformen stadig virker", () => {
  const documented = adaptBeneficialOwnership(LASSO_X_LASSO_ID, beneficialOwnersLassoXRaw);
  assert.equal(documented.owners[0]!.share, "44 %");
  // Den gamle, ubekræftede "ultimate owners"-gætteform (et rent array) virker stadig som reserve.
  const guessed = adaptBeneficialOwnership("CVR-1-1", [{ name: "Anne Eksempel", identifier: "CVR-3-1", totalOwnerPercentageMin: 20, totalOwnerPercentageMax: 24.99 }]);
  assert.equal(guessed.owners[0]!.name, "Anne Eksempel");
  assert.equal(guessed.owners[0]!.share, "20–24,99 %");
});

test("adaptOwnershipLegal: intervallet bevares (aldrig ét tal) og hasOwnersUnderFivePercent læses", () => {
  const o = adaptOwnershipLegal(LASSO_X_LASSO_ID, legalOwnersLassoXRaw)!;
  assert.ok(o, "genkender den dokumenterede form");
  assert.equal(o.hasOwnersUnderFivePercent, true);
  assert.equal(o.owners.length, 3);
  const eggert = o.owners.find((x) => x.name === "EGGERT HOLDING ApS")!;
  assert.equal(eggert.share, "5–9,99 %");
  assert.equal(eggert.kind, "company");
  const politiken = o.owners.find((x) => x.name === "JP/POLITIKENS HUS A/S")!;
  assert.equal(politiken.share, "25–33,32 %");
  // Størst ejer først.
  assert.deepEqual(
    o.owners.map((x) => x.name),
    ["JP/POLITIKENS HUS A/S", "BENEDIKTSON HOLDING ApS", "EGGERT HOLDING ApS"],
  );
});

test("adaptOwnershipLegal: undefined for en form uden owners-array (falder tilbage til company-full)", () => {
  assert.equal(adaptOwnershipLegal("x", { ownership: { owners: [] } }), undefined);
  assert.equal(adaptOwnershipLegal("x", []), undefined);
});

const GRAPH_OPTS = { ingoingDepth: 3, outgoingDepth: 0 };

test("adaptOwnershipGraph læser den dokumenterede relations/entities-form (LASSO X A/S)", () => {
  const g = adaptOwnershipGraph(LASSO_X_LASSO_ID, ownershipGraphLassoXRaw, GRAPH_OPTS);

  const root = g.nodes.find((n) => n.id === LASSO_X_LASSO_ID)!;
  assert.equal(root.root, true);
  assert.equal(root.name, LASSO_X_NAME);
  assert.equal(root.cvr, "34580820");
  assert.equal(root.form, "A/S");
  assert.equal(root.status, "NORMAL");

  const eggertEdge = g.edges.find((e) => e.from === EGGERT_HOLDING_ID && e.to === LASSO_X_LASSO_ID)!;
  assert.deepEqual(eggertEdge.share, [5, 9.99]);
  const benediktsonEdge = g.edges.find((e) => e.from === BENEDIKTSON_HOLDING_ID && e.to === LASSO_X_LASSO_ID)!;
  assert.deepEqual(benediktsonEdge.share, [15, 19.99]);
  const politikenEdge = g.edges.find((e) => e.from === JP_POLITIKEN_ID && e.to === LASSO_X_LASSO_ID)!;
  assert.deepEqual(politikenEdge.share, [25, 33.32]);

  // "_UNKNOWN"-knuden: navngivet, kind "company", flaget unknown.
  const unknownId = `${LASSO_X_LASSO_ID}_UNKNOWN`;
  const unknown = g.nodes.find((n) => n.id === unknownId)!;
  assert.ok(unknown, "den syntetiske UNKNOWN-knude findes");
  assert.equal(unknown.kind, "company");
  assert.equal(unknown.name, "Ukendt ejerskab (< 5 %)");
  assert.equal(unknown.unknown, true);
  const unknownEdge = g.edges.find((e) => e.from === unknownId)!;
  assert.deepEqual(unknownEdge.share, [0, 4.99]);

  // Personer under holdingselskaberne er "person"-knuder.
  assert.equal(g.nodes.find((n) => n.id === JAKOB_BENEDIKTSON_ID)?.kind, "person");
  assert.equal(g.nodes.find((n) => n.name === "Ella Kaalund Eggert")?.kind, "person");

  // De øvrige (ikke-UNKNOWN) noder er ikke fejlagtigt flaget som ukendte.
  assert.equal(root.unknown, undefined);
  assert.equal(g.nodes.find((n) => n.id === EGGERT_HOLDING_ID)?.unknown, undefined);
});

test("28.9: ledelsen som reelle ejere fyldes med de aktive direktører (bestyrelsen ved BOARD)", () => {
  const bo = adaptBeneficialOwnershipDocumented("x", beneficialOwnersEmptyFallbackManagement)!;
  const people = [
    { name: "Anne Eksempel", lassoId: "CVR-3-1", role: "Direktør" },
    { name: "Bo Eksempel", lassoId: "CVR-3-2", role: "Bestyrelsesformand" },
    { name: "Carla Prøve", lassoId: "CVR-3-3", role: "Direktør", to: "2020-01-01" },
  ];
  const filled = withFallbackPeople(bo, people);
  assert.deepEqual(filled.owners.map((o) => [o.name, o.role]), [["Anne Eksempel", "Direktør"]]);
  const board = withFallbackPeople({ ...bo, special: { ...bo.special!, fallback: "board" } }, people);
  assert.deepEqual(board.owners.map((o) => o.name), ["Bo Eksempel"]);
});
