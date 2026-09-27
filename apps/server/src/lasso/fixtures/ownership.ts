/**
 * Realistiske fixtures til apps/server/src/lasso/ownershipAdapters.test.ts, bygget på LASSO X A/S
 * (CVR-1-34580820)-eksemplet i Lassos egen dokumentation (se docs/endpoints-ejerskab.md og
 * scratchpad-referencen "## Ownership structure"): EGGERT HOLDING ApS ejer 5–9,99 %, BENEDIKTSON
 * HOLDING ApS 15–19,99 % og JP/POLITIKENS HUS A/S 25–33,32 % af LASSO X A/S.
 *
 * De legale ejeres andele (interval) og selskabsnavnene/-kæden er citeret direkte fra
 * dokumentationens eksempel. De bagvedliggende personers PRÆCISE reelle andel er IKKE opgivet i
 * dokumentationen (den viser kun grafen, ikke et fuldt /owners/beneficial-svar) og er derfor
 * illustrative eksempeltal i samme størrelsesorden — CVR- og Lasso-ID'er er også opdigtede, ikke
 * de rigtige numre for de nævnte selskaber/personer.
 */

export const LASSO_X_LASSO_ID = "CVR-1-34580820";
export const LASSO_X_NAME = "LASSO X A/S";

export const EGGERT_HOLDING_ID = "CVR-1-30000001";
export const BENEDIKTSON_HOLDING_ID = "CVR-1-30000002";
export const JP_POLITIKEN_ID = "CVR-1-30000003";
export const ELLA_EGGERT_ID = "CVR-3-4000000101";
export const LILI_EGGERT_ID = "CVR-3-4000000102";
export const JAKOB_BENEDIKTSON_ID = "CVR-3-4000000103";

/** GET /{lassoId}/owners/beneficial — dokumenteret form, udfyldt (reelle ejere). */
export const beneficialOwnersLassoXRaw = {
  couldNotIdentify: false,
  exemptionStatus: "NOT EXEMPT",
  fallbackDescription: null,
  fallbackType: null,
  owners: [
    {
      ownership: 0.44,
      voteRights: 0.44,
      throughRole: false,
      address: { postalCode: 2100, postalDistrict: "København Ø" },
      name: "Ella Kaalund Eggert",
      type: "PERSON",
      lassoId: ELLA_EGGERT_ID,
      unitNumber: 4000000101,
      role: { mainType: "REGISTER", type: "REEL EJER" },
      from: "2019-05-01",
    },
    {
      ownership: 0.44,
      voteRights: 0.44,
      throughRole: false,
      address: { postalCode: 2100, postalDistrict: "København Ø" },
      name: "Lili Kaalund Eggert",
      type: "PERSON",
      lassoId: LILI_EGGERT_ID,
      unitNumber: 4000000102,
      role: { mainType: "REGISTER", type: "REEL EJER" },
      from: "2019-05-01",
    },
    {
      // Illustrativt: 100 % af Benediktson Holding ApS, som selv ejer 15–19,99 % af LASSO X A/S.
      ownership: 0.1584,
      voteRights: 0.1584,
      throughRole: false,
      address: { postalCode: 2900, postalDistrict: "Hellerup" },
      name: "Jakob Bech Benediktson",
      type: "PERSON",
      lassoId: JAKOB_BENEDIKTSON_ID,
      unitNumber: 4000000103,
      role: { mainType: "REGISTER", type: "REEL EJER" },
      from: "2019-05-01",
    },
    {
      // Fallback-eksempel: ejerskab via en rolle (fx bestyrelse), ikke direkte kapitalejerskab.
      ownership: 0.05,
      voteRights: 0.05,
      throughRole: true,
      address: { postalCode: 1550, postalDistrict: "København V" },
      name: "Christian Weis Højfeldt",
      type: "PERSON",
      lassoId: "CVR-3-4000000104",
      unitNumber: 4000000104,
      role: { mainType: "REGISTER", type: "REEL EJER" },
      from: "2019-05-01",
    },
  ],
};

/** GET /{lassoId}/owners/beneficial — tom owners-liste: årsag 1, virksomheden er undtaget lovkravet. */
export const beneficialOwnersEmptyExempt = {
  couldNotIdentify: false,
  exemptionStatus: "EXEMPT",
  fallbackDescription: null,
  fallbackType: null,
  owners: [],
};

/** Årsag 2: ejerskabet er endnu ikke registreret (ingen af de øvrige felter forklarer det). */
export const beneficialOwnersEmptyNotYetRegistered = {
  couldNotIdentify: false,
  exemptionStatus: "NOT EXEMPT",
  fallbackDescription: null,
  fallbackType: null,
  owners: [],
};

/** Årsag 3: virksomheden har selv oplyst, at den ikke kan identificere sine reelle ejere. */
export const beneficialOwnersEmptyCouldNotIdentify = {
  couldNotIdentify: true,
  exemptionStatus: "UNKNOWN",
  fallbackDescription: null,
  fallbackType: null,
  owners: [],
};

/** Årsag 4: ingen enkeltperson har over 25 % — direktionen er registreret som fallback. */
export const beneficialOwnersEmptyFallbackManagement = {
  couldNotIdentify: false,
  exemptionStatus: "NOT EXEMPT",
  fallbackDescription: null,
  fallbackType: "MANAGEMENT",
  owners: [],
};

/** GET /{lassoId}/owners/legal — dokumenteret form, LASSO X A/S' legale ejere. */
export const legalOwnersLassoXRaw = {
  hasOwnersUnderFivePercent: true,
  owners: [
    {
      ownership: { from: 0.05, to: 0.0999 },
      voteRights: { from: 0.05, to: 0.0999 },
      name: "EGGERT HOLDING ApS",
      type: "VIRKSOMHED",
      lassoId: EGGERT_HOLDING_ID,
      cvr: 30000001,
      address: { postalCode: 2100, postalDistrict: "København Ø" },
      role: { mainType: "REGISTER", type: "EJER", attributes: [{ type: "EJERANDEL_MEDDELELSE_DATO", value: "2019-05-01" }] },
      from: "2019-05-01",
    },
    {
      ownership: { from: 0.15, to: 0.1999 },
      voteRights: { from: 0.15, to: 0.1999 },
      name: "BENEDIKTSON HOLDING ApS",
      type: "VIRKSOMHED",
      lassoId: BENEDIKTSON_HOLDING_ID,
      cvr: 30000002,
      address: { postalCode: 2900, postalDistrict: "Hellerup" },
      role: { mainType: "REGISTER", type: "EJER", attributes: [{ type: "EJERANDEL_MEDDELELSE_DATO", value: "2019-05-01" }] },
      from: "2019-05-01",
    },
    {
      ownership: { from: 0.25, to: 0.3332 },
      voteRights: { from: 0.25, to: 0.3332 },
      name: "JP/POLITIKENS HUS A/S",
      type: "VIRKSOMHED",
      lassoId: JP_POLITIKEN_ID,
      cvr: 30000003,
      address: { postalCode: 1550, postalDistrict: "København V" },
      role: { mainType: "REGISTER", type: "EJER", attributes: [{ type: "EJERANDEL_MEDDELELSE_DATO", value: "2019-05-01" }] },
      from: "2019-05-01",
    },
  ],
};

/**
 * POST /modules/relations/graph — dokumenteret form (relations/entities), LASSO X A/S' ejergraf.
 * Inkluderer en "_UNKNOWN"-kant (den lovligt uregistrerede andel under 5 %) og et lag ned til de
 * bagvedliggende personer i to af holdingselskaberne.
 */
export const ownershipGraphLassoXRaw = {
  relations: [
    { id: "r1", type: "ownership", from: EGGERT_HOLDING_ID, to: LASSO_X_LASSO_ID, data: { ownershipPercentage: { label: "5-9,99%", from: 0.05, to: 0.0999 } }, metadata: {} },
    { id: "r2", type: "ownership", from: BENEDIKTSON_HOLDING_ID, to: LASSO_X_LASSO_ID, data: { ownershipPercentage: { label: "15-19,99%", from: 0.15, to: 0.1999 } }, metadata: {} },
    { id: "r3", type: "ownership", from: JP_POLITIKEN_ID, to: LASSO_X_LASSO_ID, data: { ownershipPercentage: { label: "25-33,32%", from: 0.25, to: 0.3332 } }, metadata: {} },
    {
      id: "r4",
      type: "unknownOwnership",
      from: `${LASSO_X_LASSO_ID}_UNKNOWN`,
      to: LASSO_X_LASSO_ID,
      data: { ownershipPercentage: { label: "0-4,99%", from: 0, to: 0.0499 } },
      metadata: {},
    },
    { id: "r5", type: "ownership", from: ELLA_EGGERT_ID, to: EGGERT_HOLDING_ID, data: { ownershipPercentage: { label: "44%", from: 0.44, to: 0.44 } }, metadata: {} },
    { id: "r6", type: "ownership", from: LILI_EGGERT_ID, to: EGGERT_HOLDING_ID, data: { ownershipPercentage: { label: "44%", from: 0.44, to: 0.44 } }, metadata: {} },
    { id: "r7", type: "ownership", from: JAKOB_BENEDIKTSON_ID, to: BENEDIKTSON_HOLDING_ID, data: { ownershipPercentage: { label: "100%", from: 1, to: 1 } }, metadata: {} },
  ],
  entities: [
    {
      id: LASSO_X_LASSO_ID,
      type: "company",
      data: {
        lassoId: LASSO_X_LASSO_ID,
        name: LASSO_X_NAME,
        cvr: "34580820",
        companyType: "A/S",
        status: "NORMAL",
        employees: 25,
        fte: 24,
        industryCode: "620100",
        trueOwners: {},
      },
    },
    { id: EGGERT_HOLDING_ID, type: "company", data: { lassoId: EGGERT_HOLDING_ID, name: "EGGERT HOLDING ApS", cvr: "30000001", companyType: "ApS", status: "NORMAL" } },
    { id: BENEDIKTSON_HOLDING_ID, type: "company", data: { lassoId: BENEDIKTSON_HOLDING_ID, name: "BENEDIKTSON HOLDING ApS", cvr: "30000002", companyType: "ApS", status: "NORMAL" } },
    { id: JP_POLITIKEN_ID, type: "company", data: { lassoId: JP_POLITIKEN_ID, name: "JP/POLITIKENS HUS A/S", cvr: "30000003", companyType: "A/S", status: "NORMAL" } },
    { id: ELLA_EGGERT_ID, type: "person", data: { name: "Ella Kaalund Eggert", trueOwnerships: {} } },
    { id: LILI_EGGERT_ID, type: "person", data: { name: "Lili Kaalund Eggert", trueOwnerships: {} } },
    { id: JAKOB_BENEDIKTSON_ID, type: "person", data: { name: "Jakob Bech Benediktson", trueOwnerships: {} } },
  ],
};
