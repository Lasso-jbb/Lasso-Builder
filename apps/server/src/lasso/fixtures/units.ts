import type { Json } from "../adapters.js";

/**
 * Testfixtures for de fire nye datakilder (katalog 20, 08, 12/19): produktionsenheder, CHR,
 * live number og regnskabsanalyse. Formerne for company-full/produktionsenheder og live number
 * er bekræftet af Lassos dokumentation; CHR og regnskabsanalysens sektionsopdeling er BEKRÆFTET
 * MOD API 27.09.2026 (staging), se docs/endpoints-enheder-kontakt-analyse.md. CHR har desuden to
 * ældre, uverificerede gæt og én ukendt form, beholdt som reserve i adapteren og til at afprøve
 * dens defensivitet. Bruges kun af unitAdapters.test.ts.
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

/**
 * POST /modules/reportanalysis/{lassoId}, tom body: rent HTML-svar UDEN `sections` (bruges til
 * at afprøve fallback-stien til svarets `text`-felt).
 */
export const REPORT_ANALYSIS_HTML =
  "<p>Virksomheden har <b>vokset</b> markant de seneste år.</p><ul><li>Omsætning steget 12 %</li><li>Resultat steget 8 %</li></ul><br/>Konklusion: sund udvikling.";

/**
 * POST /modules/reportanalysis/{lassoId}, BEKRÆFTET MOD API 27.09.2026: sektioneret svar.
 * `revisoroplysninger` er bevidst tom, så tomme sektioner kan afprøves. `latestReport`/
 * `previousReport` bruges ikke af adapteren endnu (se docs/endpoints-enheder-kontakt-analyse.md).
 */
export const REPORT_ANALYSIS_RESPONSE: Json = {
  lassoId: "CVR-1-99000001",
  sections: {
    konklusion: "<b>Konklusion</b><br>Virksomheden har en sund og stabil udvikling.",
    resultat: "<b>Resultat</b><br>Årets resultat er steget 8 % i forhold til året før.",
    likviditet: "<b>Likviditet</b><br>Likviditetsgraden er forbedret og ligger over branchens gennemsnit.",
    balanceogkapitalforhold: "<b>Balance og kapitalforhold</b><br>Soliditetsgraden er stabil.",
    branchestatistik: "<b>Branchestatistik</b><br>Virksomheden ligger over branchens gennemsnitlige bruttofortjeneste.",
    revisoroplysninger: "",
    sprgsml:
      "<b>Strategilægning og budgetjustering</b><br>Overvej følgende: <br>- Bør investeringsplanen revideres? <br>- Er likviditetsberedskabet tilstrækkeligt?",
  },
  text: "<b>Konklusion</b><br>Virksomheden har en sund og stabil udvikling.",
  latestReport: { revenue: { unit: "DKK", value: 38_000_000, sources: ["Revenue"], possibleError: false, error: false } },
  previousReport: { revenue: { unit: "DKK", value: 34_000_000, sources: ["Revenue"], possibleError: false, error: false } },
};

/**
 * POST /modules/reportanalysis/{lassoId} i den bekræftede form (27.09.2026), med det, der er set i
 * de rigtige svar: hver sektion starter med sin egen titel i fed ("<b>Titel</b><br>…"), titlen kan
 * stå to gange, og teksten har Lassos "{Navn|LassoId}"-markup (revisoren). Navne og tal er
 * opdigtede; Crowes CVR-nummer er det rigtige.
 */
export const REPORT_ANALYSIS_WITH_ENTITIES: Json = {
  lassoId: "CVR-1-99000001",
  sections: {
    konklusion: "<b>Konklusion</b><br>Virksomheden har en sund og stabil udvikling.",
    resultat: "<b>Resultat</b><br>Resultatet er steget 8 % i forhold til året før.",
    likviditet: "",
    balanceogkapitalforhold:
      "<b>Balance og kapitalforhold</b><br><b>Balance og kapitalforhold</b><br>Virksomhedens samlede aktiver er steget til 120 mio. kr.<br><br>Egenkapitalen udgør 45 %.",
    branchestatistik: "",
    revisoroplysninger:
      "<b>Revisoroplysninger</b><br>En autoriseret revisor fra {Crowe Statsautoriseret Revisionsinteressentskab|CVR-1-33256876} har revideret årsrapporten. Underskrevet af {Peter Revisor Eksempel|CVR-3-4000000099}.",
    sprgsml: "<b>Strategilægning og budgetjustering</b><br>Overvej følgende: <br>- Bør investeringsplanen revideres?",
  },
  text: "<b>Konklusion</b><br>Virksomheden har en sund og stabil udvikling.",
};

/**
 * GET /data/CHR/livestock/{cvr}?onlyCurrent=true, BEKRÆFTET MOD API 27.09.2026: rent array af
 * ejendomme. Ét element (samme CHR-nummer, tre besætningsrækker): en virksomhedsejet ("Svin",
 * med "i alt"-total), en privatejet ("Heste", ejerens navn må ikke lækkes) og en uden ejer
 * ("Høns"). `veterinaryEventList.events` er null (som i det virkelige eksempel); `problems` har
 * en tekst, der skal vises som en linje.
 */
export const CHR_CONFIRMED_RESPONSE: Json = [
  {
    chrNumber: 10033,
    property: {
      address: "Orevej 5",
      city: "Ganløse Mørke",
      postalCode: 3660,
      postalDistrict: "Stenløse",
      municipalityNumber: 240,
      municipality: "Egedal",
      startDate: "1994-04-21T00:00:00",
      lastUpdated: "2004-01-12T00:00:00",
    },
    veterinaryAndFoodAdministration: {
      veterinaryAndFoodAdministrationRegionNumber: 8,
      veterinaryAndFoodAdministrationRegion: "Fødevarestyrelsen Øst",
      veterinaryDepartment: "Veterinærenhed Øst",
      veterinarySection: "Veterinærenhed Øst",
    },
    stableCoordinates: { x: 705746.04, y: 6190509.464 },
    livestockList: {
      livestock: [
        {
          chrNumber: 10033,
          livestockNumber: 10033,
          animalTypeCode: 15,
          animalType: "Svin",
          usageTypeCode: 81,
          usageType: "Kirurgiske/medicinske forsøg",
          tradeType: "Kirurgisk/medicinsk forsøg, svin",
          tradabilityCode: 3,
          tradability: "Dyr må omsættes",
          livestockSize: [
            { text: "Søer, gylte og orner", value: 0 },
            { text: "Svin o. 30 kg undt. søer, gylte og orner", value: 50 },
            { text: "Smågrise mellem 7 og 30 kg", value: 35 },
            { text: "Svin i alt", value: 85 },
          ],
          livestockSizeLastUpdated: "2025-11-06T00:00:00",
          owner: {
            cvrNumber: 24256790,
            name: "NOVO NORDISK A/S  ",
            address: "Novo Alle 1",
            city: null,
            postalCode: 2880,
            postalDistrict: "Bagsværd",
            municipalityNumber: 159,
            municipality: "Gladsaxe",
            country: "Danmark",
            addressProtected: null,
            commerciallyProtected: false,
          },
          user: {
            cvrNumber: 24256790,
            name: "NOVO NORDISK A/S  ",
            address: "Novo Alle 1",
            postalCode: 2880,
            postalDistrict: "Bagsværd",
            municipality: "Gladsaxe",
          },
          startDate: "1994-04-21T00:00:00",
          endDate: null,
          lastUpdated: "2015-02-06T00:00:00",
          veterinarianInfo: { idSpecified: false, name: null },
        },
        {
          animalType: "Heste",
          usageType: "Kød, generelt",
          tradeType: "Øvrige hestehold",
          livestockSize: [
            { text: "Vallakker", value: 2 },
            { text: "Heste i alt", value: 2 },
          ],
          owner: { cvrNumber: null, name: "Anders Andersen (eksempel, må ikke lækkes)" },
        },
        {
          animalType: "Høns af æglægningstype",
          usageType: "AI overvågning",
          livestockSize: [{ text: "Dyr i alt", value: 10 }],
        },
      ],
      livestockCount: 4,
    },
    veterinaryEventList: { events: null, problems: "Ingen kendte aktuelle problemer" },
  },
];

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
