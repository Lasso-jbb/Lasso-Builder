import assert from "node:assert/strict";
import { test } from "node:test";
import type { Json } from "./adapters.js";
import {
  CHR_CONFIRMED_RESPONSE,
  CHR_GUESS_ARRAY,
  CHR_GUESS_HERDS,
  CHR_UNKNOWN_SHAPE,
  COMPANY_FULL_WITH_UNITS,
  LIVE_NUMBER_RESPONSE,
  REPORT_ANALYSIS_HTML,
  REPORT_ANALYSIS_RESPONSE,
  REPORT_ANALYSIS_WITH_ENTITIES,
  UNIT_BRANCH,
  UNIT_MAIN,
} from "./fixtures/units.js";
import { htmlToText } from "./htmlText.js";
import { adaptChrLivestock, adaptLiveNumber, adaptProductionUnitDetail, adaptReportAnalysisSections, buildProductionUnits, productionUnitRefs } from "./unitAdapters.js";

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

test("adaptReportAnalysisSections bygger sektioner i den bekræftede rækkefølge, med danske titler og kildelinje, og udelader tomme felter", () => {
  const sections = adaptReportAnalysisSections(REPORT_ANALYSIS_RESPONSE);
  assert.deepEqual(
    sections.map((s) => s.heading),
    ["Regnskabsanalyse: konklusion", "Resultat", "Likviditet", "Balance og kapitalforhold", "Branchestatistik", "Spørgsmål til overvejelse"],
  );
  for (const s of sections) assert.equal(s.note, "Kilde: Lasso regnskabsanalyse");
  assert.ok(sections[0]!.body.includes("Virksomheden har en sund og stabil udvikling."));
  assert.ok(sections.at(-1)!.body.includes("- Bør investeringsplanen revideres?"));
  assert.ok(sections.at(-1)!.body.includes("- Er likviditetsberedskabet tilstrækkeligt?"));
});

test("adaptReportAnalysisSections falder tilbage til svarets 'text' som én sektion, når 'sections' mangler", () => {
  const sections = adaptReportAnalysisSections(REPORT_ANALYSIS_HTML);
  assert.equal(sections.length, 1);
  assert.equal(sections[0]!.heading, "Regnskabsanalyse");
  assert.equal(sections[0]!.note, "Kilde: Lasso regnskabsanalyse");
  assert.ok(sections[0]!.body.includes("Konklusion: sund udvikling."));
});

test("adaptReportAnalysisSections fjerner sektionens egen titel fra brødteksten, også når den står to gange", () => {
  const sections = adaptReportAnalysisSections(REPORT_ANALYSIS_WITH_ENTITIES);
  const body = (h: string) => sections.find((s) => s.heading === h)?.body;
  assert.equal(body("Regnskabsanalyse: konklusion"), "Virksomheden har en sund og stabil udvikling.");
  assert.equal(body("Resultat"), "Resultatet er steget 8 % i forhold til året før.", "en sætning, der starter med samme ord, beholdes");
  assert.equal(body("Balance og kapitalforhold"), "Virksomhedens samlede aktiver er steget til 120 mio. kr.\n\nEgenkapitalen udgør 45 %.", "afsnit bevares");
  assert.ok(body("Revisoroplysninger")!.startsWith("En autoriseret revisor fra "));
  // En fed indledning, der ikke er sektionens titel, er indhold og beholdes.
  assert.equal(body("Spørgsmål til overvejelse"), "Strategilægning og budgetjustering\nOvervej følgende:\n- Bør investeringsplanen revideres?");
  // Den ældre fixture (én titel pr. sektion) giver også brødtekst uden titel.
  for (const s of adaptReportAnalysisSections(REPORT_ANALYSIS_RESPONSE).slice(0, 5)) {
    assert.ok(!/^(Konklusion|Resultat|Likviditet|Balance og kapitalforhold|Branchestatistik)\b/.test(s.body), s.body);
  }
});

test("adaptReportAnalysisSections: ingen rå {Navn|LassoId}-markup i body, navnene som segmenter med Lasso-ID", () => {
  const sections = adaptReportAnalysisSections(REPORT_ANALYSIS_WITH_ENTITIES);
  const auditor = sections.find((s) => s.heading === "Revisoroplysninger")!;
  assert.equal(
    auditor.body,
    "En autoriseret revisor fra Crowe Statsautoriseret Revisionsinteressentskab har revideret årsrapporten. Underskrevet af Peter Revisor Eksempel.",
  );
  assert.ok(!/[{}|]/.test(auditor.body));
  assert.deepEqual(auditor.segments, [
    { text: "En autoriseret revisor fra " },
    { text: "Crowe Statsautoriseret Revisionsinteressentskab", lassoId: "CVR-1-33256876" },
    { text: " har revideret årsrapporten. Underskrevet af " },
    { text: "Peter Revisor Eksempel", lassoId: "CVR-3-4000000099" },
    { text: "." },
  ]);
  assert.equal(auditor.segments!.map((s) => s.text).join(""), auditor.body, "segmenterne er præcis brødteksten");
  // Sektioner uden navne med Lasso-ID har ingen segmenter.
  assert.equal(sections.find((s) => s.heading === "Resultat")!.segments, undefined);
});

test("adaptReportAnalysisSections giver en tom liste for et tomt eller ukendt svar", () => {
  assert.deepEqual(adaptReportAnalysisSections(""), []);
  assert.deepEqual(adaptReportAnalysisSections({}), []);
  assert.deepEqual(adaptReportAnalysisSections(null), []);
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

/* ---------- CHR (katalog 20), BEKRÆFTET MOD API 27.09.2026 ---------- */

test("adaptChrLivestock læser den bekræftede form: én række pr. livestockList.livestock, antal fra elementet der ender på 'i alt'", () => {
  const vm = adaptChrLivestock("CVR-1-1", CHR_CONFIRMED_RESPONSE);
  assert.equal(vm.chrNumber, "10033");
  assert.equal(vm.herds.length, 3);
  assert.equal(vm.herds[0]!.species, "Svin");
  assert.equal(vm.herds[0]!.category, "Kirurgiske/medicinske forsøg");
  assert.equal(vm.herds[0]!.count, 85);
  assert.equal(vm.herds[1]!.species, "Heste");
  assert.equal(vm.herds[1]!.category, "Kød, generelt");
  assert.equal(vm.herds[1]!.count, 2);
  assert.equal(vm.herds[2]!.species, "Høns af æglægningstype");
  assert.equal(vm.herds[2]!.count, 10);
  assert.equal(vm.unavailableReason, undefined);
});

test("adaptChrLivestock summerer livestockSize-værdierne, når intet element ender på 'i alt'", () => {
  const raw: Json = [
    {
      chrNumber: 99,
      property: { address: "Testvej 1", postalCode: 8000, postalDistrict: "Aarhus C", municipality: "Aarhus" },
      livestockList: { livestock: [{ animalType: "Test", livestockSize: [{ text: "Gruppe A", value: 3 }, { text: "Gruppe B", value: 4 }] }] },
    },
  ];
  const vm = adaptChrLivestock("CVR-1-1", raw);
  assert.equal(vm.herds[0]!.count, 7);
});

test("adaptChrLivestock sætter CHR-nummer og ejendommens adresse pr. besætningsrække", () => {
  const vm = adaptChrLivestock("CVR-1-1", CHR_CONFIRMED_RESPONSE);
  for (const h of vm.herds) {
    assert.equal(h.chrNumber, "10033");
    assert.equal(h.propertyAddress, "Orevej 5, 3660 Stenløse (Egedal)");
  }
});

test("adaptChrLivestock viser kun ejer/bruger for virksomheder (cvrNumber sat); privatpersoners navn og adresse lækkes aldrig", () => {
  const vm = adaptChrLivestock("CVR-1-1", CHR_CONFIRMED_RESPONSE);
  assert.equal(vm.ownerName, "NOVO NORDISK A/S");
  const serialized = JSON.stringify(vm);
  assert.ok(!serialized.includes("Anders Andersen"), "privatpersonens navn må ikke ende i VM'en");
});

test("adaptChrLivestock læser opdateringsdatoen som den seneste af property.lastUpdated og livestockSizeLastUpdated", () => {
  const vm = adaptChrLivestock("CVR-1-1", CHR_CONFIRMED_RESPONSE);
  assert.equal(vm.updated, "2025-11-06");
});

test("adaptChrLivestock læser 'problems' som en hændelseslinje, når veterinaryEventList.events er null", () => {
  const vm = adaptChrLivestock("CVR-1-1", CHR_CONFIRMED_RESPONSE);
  assert.equal(vm.events.length, 1);
  assert.equal(vm.events[0]!.title, "Bemærkning");
  assert.equal(vm.events[0]!.detail, "Ingen kendte aktuelle problemer");
});
