import assert from "node:assert/strict";
import { test } from "node:test";
import type { Json } from "./adapters.js";
import {
  CHR_GUESS_ARRAY,
  CHR_GUESS_HERDS,
  CHR_UNKNOWN_SHAPE,
  COMPANY_FULL_WITH_UNITS,
  LIVE_NUMBER_RESPONSE,
  REPORT_ANALYSIS_HTML,
  UNIT_BRANCH,
  UNIT_MAIN,
} from "./fixtures/units.js";
import { htmlToText } from "./htmlText.js";
import { adaptChrLivestock, adaptLiveNumber, adaptProductionUnitDetail, adaptReportAnalysisSection, buildProductionUnits, productionUnitRefs } from "./unitAdapters.js";

/* ---------- Produktionsenheder (katalog 20) ---------- */

test("productionUnitRefs læser company-fulds bekræftede felt {lassoId, pNumber}[]", () => {
  const refs = productionUnitRefs(COMPANY_FULL_WITH_UNITS);
  assert.deepEqual(refs, [
    { lassoId: "CVR-2-1000000020", pNumber: "1000000020" },
    { lassoId: "CVR-2-1000000021", pNumber: "1000000021" },
  ]);
});

test("productionUnitRefs giver en tom liste, når company-full ikke har produktionsenheder", () => {
  assert.deepEqual(productionUnitRefs({ name: "Uden enheder" }), []);
});

test("adaptProductionUnitDetail læser navn, adresse, branche, ansatte, status og oprettet", () => {
  const vm = adaptProductionUnitDetail({ lassoId: "CVR-2-1000000020", pNumber: "1000000020" }, UNIT_MAIN);
  assert.equal(vm.pNumber, "1000000020");
  assert.equal(vm.name, "Eksempel Byg A/S");
  assert.equal(vm.address?.street, "Prøvevej 1");
  assert.equal(vm.address?.zip, "8600");
  assert.equal(vm.industryCode, "412000");
  assert.equal(vm.industryText, "Opførelse af bygninger");
  assert.equal(vm.employees, 64);
  assert.equal(vm.status, "NORMAL");
  assert.equal(vm.created, "1998-04-01");
});

test("buildProductionUnits henter detaljer parallelt og markerer hovedenheden (samme adresse som virksomheden)", async () => {
  const raw: Record<string, Json> = { "CVR-2-1000000020": UNIT_MAIN, "CVR-2-1000000021": UNIT_BRANCH };
  const vm = await buildProductionUnits("CVR-1-99000001", COMPANY_FULL_WITH_UNITS, [], async (id) => raw[id]!);
  assert.equal(vm.units.length, 2);
  assert.equal(vm.units[0]!.pNumber, "1000000020");
  assert.equal(vm.units[0]!.isMain, true);
  assert.equal(vm.units[1]!.pNumber, "1000000021");
  assert.equal(vm.units[1]!.isMain, false);
  assert.equal(vm.total, undefined);
});

test("buildProductionUnits viser kun P-nummeret for en enhed, hvis dens detaljeopslag fejler", async () => {
  const vm = await buildProductionUnits("CVR-1-99000001", COMPANY_FULL_WITH_UNITS, [], async (id) => {
    if (id === "CVR-2-1000000021") throw new Error("boom");
    return UNIT_MAIN;
  });
  assert.equal(vm.units.length, 2);
  const failed = vm.units.find((u) => u.pNumber === "1000000021");
  assert.ok(failed, "den fejlede enhed skal stadig være med");
  assert.equal(failed!.name, undefined);
  assert.equal(failed!.address, undefined);
  const ok = vm.units.find((u) => u.pNumber === "1000000020");
  assert.equal(ok!.name, "Eksempel Byg A/S");
});

test("buildProductionUnits henter kun de første 25 enheder og sætter total, når der er flere", async () => {
  const companyRaw: Json = {
    lassoId: "CVR-1-1",
    productionUnits: Array.from({ length: 30 }, (_, i) => ({ lassoId: `CVR-2-${1000 + i}`, pNumber: String(1000 + i) })),
  };
  let calls = 0;
  const vm = await buildProductionUnits("CVR-1-1", companyRaw, [], async (id) => {
    calls++;
    return { pNumber: id.replace("CVR-2-", "") };
  });
  assert.equal(calls, 25, "kun de første 25 skal hentes");
  assert.equal(vm.units.length, 25);
  assert.equal(vm.total, 30);
});

test("buildProductionUnits falder tilbage til de gamle feltnavne-gæt, når company-full ikke har feltet", async () => {
  const legacy = [{ pNumber: "1", name: "Gammelt gæt" }];
  const vm = await buildProductionUnits("CVR-1-1", { name: "Uden enheder" }, legacy, async () => ({}));
  assert.deepEqual(vm.units, legacy);
});

/* ---------- Live number (katalog 08) ---------- */

test("adaptLiveNumber udelader obfuskerede numre og sorterer efter score", () => {
  const vm = adaptLiveNumber(LIVE_NUMBER_RESPONSE);
  assert.ok(vm);
  assert.equal(vm!.verifiedNumbers?.length, 2);
  assert.equal(vm!.verifiedNumbers![0]!.phoneNumber, "86123456");
  assert.equal(vm!.verifiedNumbers![0]!.score, 91);
  assert.equal(vm!.verifiedNumbers![1]!.phoneNumber, "20304050");
  assert.deepEqual(vm!.verifiedNumbers![0]!.sources, ["CVR"]);
  assert.deepEqual(vm!.verifiedNumbers![1]!.sources, ["Website"]);
  assert.equal(vm!.isRobinson, true);
  assert.equal(vm!.verifiedAt, "2026-09-20");
});

test("adaptLiveNumber beskærer til højst 3 numre, højeste score først", () => {
  const raw = {
    numbers: [
      { phoneNumber: "1", score: 10, callable: true },
      { phoneNumber: "2", score: 40, callable: true },
      { phoneNumber: "3", score: 30, callable: true },
      { phoneNumber: "4", score: 90, callable: true },
    ],
  };
  const vm = adaptLiveNumber(raw);
  assert.deepEqual(
    vm!.verifiedNumbers!.map((n) => n.phoneNumber),
    ["4", "2", "3"],
  );
});

test("adaptLiveNumber giver undefined for et tomt svar (ingen numre, ikke Robinson) og for et ikke-objekt", () => {
  assert.equal(adaptLiveNumber({ numbers: [] }), undefined);
  assert.equal(adaptLiveNumber(undefined), undefined);
  assert.equal(adaptLiveNumber("uventet"), undefined);
});

test("adaptLiveNumber giver Robinson-status, selv uden numre", () => {
  const vm = adaptLiveNumber({ isRobinson: true, numbers: [] });
  assert.equal(vm?.isRobinson, true);
  assert.equal(vm?.verifiedNumbers, undefined);
});

/* ---------- htmlToText (katalog 12/19, regnskabsanalysen) ---------- */

test("htmlToText fjerner tags og bevarer afsnit/linjeskift, <li> får et punktum", () => {
  const text = htmlToText(REPORT_ANALYSIS_HTML);
  assert.equal(text, "Virksomheden har vokset markant de seneste år.\n\n• Omsætning steget 12 %\n• Resultat steget 8 %\n\nKonklusion: sund udvikling.");
});

test("htmlToText afkoder standardentiteterne", () => {
  assert.equal(htmlToText("Tom &amp; Jerry &lt;3 &quot;venner&quot; &#39;altid&#39;&nbsp;sammen"), 'Tom & Jerry <3 "venner" \'altid\' sammen');
});

test("htmlToText fjerner scripts og styles helt (indhold og alt)", () => {
  assert.equal(htmlToText("<p>Tekst</p><script>alert(1)</script><style>.x{color:red}</style>"), "Tekst");
});

test("htmlToText tåler tomt eller manglende input", () => {
  assert.equal(htmlToText(undefined), "");
  assert.equal(htmlToText(null), "");
  assert.equal(htmlToText(""), "");
});

test("adaptReportAnalysisSection bygger en tekstsektion med kildelinje, ingen AI-mærke", () => {
  const section = adaptReportAnalysisSection(REPORT_ANALYSIS_HTML);
  assert.equal(section?.heading, "Regnskabsanalyse");
  assert.equal(section?.note, "Kilde: Lasso regnskabsanalyse");
  assert.ok(section?.body.includes("Konklusion: sund udvikling."));
});

test("adaptReportAnalysisSection giver undefined for et tomt eller ukendt svar", () => {
  assert.equal(adaptReportAnalysisSection(""), undefined);
  assert.equal(adaptReportAnalysisSection({}), undefined);
  assert.equal(adaptReportAnalysisSection(null), undefined);
});

/* ---------- CHR (katalog 20), UBEKRÆFTET svarform ---------- */

test("adaptChrLivestock læser gæt 1: pakket liste under 'herds'", () => {
  const vm = adaptChrLivestock("CVR-1-1", CHR_GUESS_HERDS);
  assert.equal(vm.chrNumber, "100001");
  assert.equal(vm.herds.length, 2);
  assert.equal(vm.herds[0]!.species, "Svin");
  assert.equal(vm.herds[0]!.count, 4200);
  assert.equal(vm.herds[1]!.species, "Kvæg");
  assert.equal(vm.events.length, 1);
  assert.equal(vm.events[0]!.title, "Velfærdskontrol");
  assert.equal(vm.events[0]!.date, "2025-11-21");
  assert.equal(vm.unavailableReason, undefined);
});

test("adaptChrLivestock læser gæt 2: rent array, dansk feltnavngivning", () => {
  const vm = adaptChrLivestock("CVR-1-1", CHR_GUESS_ARRAY);
  assert.equal(vm.chrNumber, "200002");
  assert.equal(vm.herds.length, 2);
  assert.equal(vm.herds[0]!.species, "Fjerkræ");
  assert.equal(vm.herds[0]!.count, 12000);
  assert.equal(vm.events.length, 1);
  assert.equal(vm.events[0]!.title, "Flytteforbud");
  assert.equal(vm.events[0]!.detail, "Salmonella");
  assert.equal(vm.unavailableReason, undefined);
});

test("adaptChrLivestock giver en tom VM med unavailableReason for en ukendt svarform", () => {
  const vm = adaptChrLivestock("CVR-1-1", CHR_UNKNOWN_SHAPE);
  assert.deepEqual(vm.herds, []);
  assert.deepEqual(vm.events, []);
  assert.equal(vm.unavailableReason, "CHR-svarets struktur er ikke verificeret endnu");
});
