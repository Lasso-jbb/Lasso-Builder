import type { Json } from "../adapters.js";

/**
 * Testfixtures for de fire nye datakilder (katalog 20, 08, 12/19): produktionsenheder, CHR,
 * live number og regnskabsanalyse. Formerne for company-full/produktionsenheder og live number
 * er bekræftet af Lassos dokumentation (docs/endpoints-enheder-kontakt-analyse.md); CHR er
 * UBEKRÆFTET, så der er to gættede former og én ukendt, til at afprøve adapterens defensivitet.
 * Bruges kun af unitAdapters.test.ts.
 */

/** GET /{lassoId} (company-full), bekræftet form: to produktionsenhedsreferencer. */
export const COMPANY_FULL_WITH_UNITS: Json = {
  lassoId: "CVR-1-99000001",
  cvr: "99000001",
  name: "Eksempel Byg A/S",
  address: { address1: "Prøvevej 1", postalCode: "8600", postalDistrict: "Silkeborg" },
  productionUnits: [
    { lassoId: "CVR-2-1000000020", pNumber: "1000000020" },
    { lassoId: "CVR-2-1000000021", pNumber: "1000000021" },
  ],
};

/** GET /CVR-2-1000000020: hovedenheden, samme adresse som virksomheden ovenfor. */
export const UNIT_MAIN: Json = {
  lassoId: "CVR-2-1000000020",
  pNumber: "1000000020",
  unitNumber: 1000000020,
  name: "Eksempel Byg A/S",
  cvr: "99000001",
  status: "NORMAL",
  lifeTime: { from: "1998-04-01", to: null },
  address: { address1: "Prøvevej 1", postalCode: "8600", postalDistrict: "Silkeborg" },
  industry: { code: "412000", text: "Opførelse af bygninger" },
  employees: { interval: "5-9", count: 64, fullTimeEquivalentCount: 60, type: "quarterly", month: 3, year: 2026, quarter: 1 },
  creationDate: "1998-04-01",
};

/** GET /CVR-2-1000000021: en filial på en anden adresse end virksomheden. */
export const UNIT_BRANCH: Json = {
  lassoId: "CVR-2-1000000021",
  pNumber: "1000000021",
  unitNumber: 1000000021,
  name: "Eksempel Byg, Aarhus",
  cvr: "99000001",
  status: "NORMAL",
  lifeTime: { from: "2015-03-01", to: null },
  address: { address1: "Eksempelvej 12", postalCode: "8000", postalDistrict: "Aarhus C" },
  industry: { code: "412000", text: "Opførelse af bygninger" },
  employees: { interval: "1-4", count: 8, fullTimeEquivalentCount: 7, type: "quarterly", month: 3, year: 2026, quarter: 1 },
  creationDate: "2015-03-01",
};

/** GET /data/livenumber/{lassoId}, bekræftet form. Tredje nummer er obfuskeret og skal udelades. */
export const LIVE_NUMBER_RESPONSE: Json = {
  lassoId: "CVR-1-99000001",
  updated: "2026-09-20",
  isRobinson: true,
  isCommerciallyProtected: false,
  numbers: [
    { phoneNumber: "86123456", sources: [{ type: "CVR", timestamp: "2026-08-01", note: "CVR-registret" }], score: 91, explanation: "Bekræftet fra flere kilder", callable: true, obfuscated: false },
    { phoneNumber: "20304050", sources: [{ type: "Website", timestamp: "2026-07-15" }], score: 62, explanation: "Fundet på hjemmesiden", callable: true, obfuscated: false },
    { phoneNumber: "70XXXXXX", sources: [{ type: "Directory", timestamp: "2026-06-01" }], score: 40, callable: false, obfuscated: true },
  ],
};

/** POST /modules/reportanalysis/{lassoId}, tom body: tekst med simple HTML-tags (docs.lassox.com). */
export const REPORT_ANALYSIS_HTML =
  "<p>Virksomheden har <b>vokset</b> markant de seneste år.</p><ul><li>Omsætning steget 12 %</li><li>Resultat steget 8 %</li></ul><br/>Konklusion: sund udvikling.";

/** GET /data/CHR/livestock/{cvr}, UBEKRÆFTET form, gæt 1: pakket liste under "herds". */
export const CHR_GUESS_HERDS: Json = {
  chrNumber: "100001",
  herds: [
    { species: "Svin", type: "slagtesvin", count: 4200, chrNumber: "100001" },
    {
      species: "Kvæg",
      type: "malkekøer",
      count: 160,
      chrNumber: "100001",
      events: [{ type: "Velfærdskontrol", date: "2025-11-21", description: "Ingen anmærkninger" }],
    },
  ],
};

/** GET /data/CHR/livestock/{cvr}, UBEKRÆFTET form, gæt 2: rent array, dansk feltnavngivning. */
export const CHR_GUESS_ARRAY: Json = [
  { dyreart: "Fjerkræ", antal: 12000, chrId: "200002" },
  { dyreart: "Svin", antal: 300, chrId: "200002", haendelser: [{ name: "Flytteforbud", time: "2026-01-05", description: "Salmonella" }] },
];

/** GET /data/CHR/livestock/{cvr}: ukendt form, hverken en genkendt liste-nøgle eller et rent array. */
export const CHR_UNKNOWN_SHAPE: Json = { status: "ok", payload: { info: "uventet svarform" } };
