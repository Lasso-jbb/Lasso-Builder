import assert from "node:assert/strict";
import { test } from "node:test";
import {
  composeCompany,
  composePerson,
  companyTemplate,
  emptyDataset,
  parseAsk,
  type Dataset,
} from "@lasso/spec";
import { answerText } from "./answer.js";

// Opdigtede tal i samme form som Lassos rigtige svar.
const ID = "CVR-1-11111111";
function dataset(): Dataset {
  const ds = emptyDataset("live");
  ds.companies[ID] = {
    lassoId: ID,
    cvr: "11111111",
    name: "TESTFIRMA A/S",
    status: "Normal",
    statusKind: "active",
    form: "A/S",
    industryCode: "212000",
    industryText: "Fremstilling af farmaceutiske præparater",
    address: { street: "Testvej 1", zip: "2880", city: "Bagsværd", municipality: "Gladsaxe", region: "Hovedstaden" },
    founded: "1931-11-28",
    employees: 27279,
    phone: "44448888",
  };
  ds.financials[ID] = {
    lassoId: ID,
    currency: "DKK",
    years: [2023, 2024, 2025].map((year, i) => ({
      year,
      revenue: [232e9, 290e9, 309e9][i]!,
      grossProfit: [196e9, 245e9, 250e9][i]!,
      profit: [83e9, 101e9, -2e9][i]!,
      equity: [106e9, 143e9, 194e9][i]!,
      employees: [51046, 69480, 76343][i]!,
      liabilities: [140e9, 155e9, 168e9][i]!,
    })),
  };
  ds.people[ID] = [
    { name: "Anne Direktør", role: "Administrerende direktør", from: "2025-08-07" },
    { name: "Bo Formand", role: "Bestyrelsesformand", from: "2025-11-14" },
    { name: "Carla Medlem", role: "Bestyrelsesmedlem", from: "2020-01-01" },
    { name: "Dan Tidligere", role: "Bestyrelsesmedlem", from: "2010-01-01", to: "2020-01-01" },
  ];
  ds.ownership[ID] = {
    lassoId: ID,
    owners: [{ name: "Holding A/S", share: "25–33,32 %", votes: "66,67–89,99 %", kind: "company" }],
    auditor: { name: "DELOITTE STATSAUTORISERET REVISIONSPARTNERSELSKAB" },
  };
  return ds;
}

test("resumé viser EUR/USD-regnskaber i deres valuta, ikke som kroner (Vestas/Mærsk)", async () => {
  const { summarizeView } = await import("./summary.js");
  const ds = dataset();
  ds.financials[ID] = {
    ...ds.financials[ID]!,
    currency: "EUR",
    years: ds.financials[ID]!.years.map((y) => ({ ...y, revenue: 18_822_000_000, currency: "EUR", scope: "Koncern" as const })),
  };
  const spec = companyTemplate(ID, { chartMetric: "omsaetning", years: 3 });
  const summary = summarizeView(spec, ds);
  assert.match(summary, /omsætning 18,8 mia\. EUR/);
  assert.match(summary, /koncerntal; beløb i EUR, ikke kroner/);
  assert.ok(!summary.includes("mia. kr."), summary);
});

test("resuméet på risiko har kreditvurderingen (revisoruafhængigheden er slettet, Jakob 01.10)", async () => {
  const { summarizeView } = await import("./summary.js");
  const ds = dataset();
  ds.creditRatings[ID] = { lassoId: ID, state: "ok", source: "Creditsafe via Lasso", current: { internationalScore: "B", creditMax: 250_000, creditCurrency: "DKK", localScore: 62 } };
  const summary = summarizeView(composeCompany(ID, ds, { focus: "risiko", showAll: true }), ds);
  assert.match(summary, /Kreditvurdering \(Creditsafe\): /);
  assert.doesNotMatch(summary, /Revisoruafhængighed/);
});

test("resuméet til modellen har regnskabslinjen én gang, også på regnskab, hvor nøgletalskortene ikke står", async () => {
  const { summarizeView } = await import("./summary.js");
  const ds = dataset();
  ds.financialStatements[ID] = { lassoId: ID, currency: "DKK", incomeStatement: [{ year: 2025, revenue: 1_000_000, profit: 100_000 }], balanceSheet: [{ year: 2025, assetsTotal: 500_000 }], cashFlow: [] };
  for (const focus of ["overblik", "oekonomi", "regnskab"] as const) {
    const summary = summarizeView(composeCompany(ID, ds, { focus }), ds);
    assert.equal((summary.match(/Regnskab \d{4}/g) ?? []).length, 1, `${focus}:\n${summary}`);
  }
});

test("B3: de nye spørgsmålstyper har hver en svarsætning, også som tom tilstand", () => {
  const ds = dataset();
  const spec = composeCompany(ID, ds, {});
  const answer = (q: string, topic?: string) => {
    const ask = parseAsk(q, "company", { name: "TESTFIRMA A/S", topic });
    return answerText(spec, ds, ask) ?? "";
  };
  // Tom tilstand først (ingen data i datasættet).
  assert.match(answer("Er der røde flag?"), /Røde flag: ikke hentet/);
  assert.match(answer("Har der været fusioner?"), /Fusioner og spaltninger: ingen registreret/);
  assert.match(answer("Hvilke meddelelser er der i Statstidende?"), /Statstidende: ingen meddelelser/);
  assert.match(answer("Vis de offentliggjorte dokumenter", "dokumenter"), /Offentliggjorte regnskaber: ingen offentliggjort/);
  assert.match(answer("Hvordan klarer de sig i forhold til branchen?"), /Branchesammenligning: ikke beregnet endnu/);
  assert.match(answer("Vis dem på et kort"), /Placering: ingen adresser med koordinater/);
  assert.match(answer("Vis hele regnskabet"), /Hele regnskabet: intet offentliggjort regnskab/);
  assert.match(answer("Hvad er selskabskapitalen?"), /Registrering: A\/S/);
  assert.match(answer("Giv mig en kort opsummering"), /^Opsummering: A\/S, Normal/);
  assert.match(answer("Hvad er der sket de sidste 30 dage?"), /Ændringer: ingen registrerede ændringer/);

  // Med data.
  ds.companyEvents[ID] = {
    lassoId: ID,
    mergers: [{ type: "Fusion", date: "2024-01-01", from: [{ name: "A ApS" }], to: [{ name: "B A/S" }] }],
    announcements: [{ date: "2025-03-01", type: "Rekonstruktion", severity: "bankrupt" }],
    publications: [{ kind: "Årsrapport", year: 2025 }],
  };
  ds.maps[ID] = { lassoId: ID, points: [{ id: "p", kind: "focus", name: "Hoved", lat: 55, lon: 12 }], missing: 1 };
  ds.changeFeeds[`company:${ID}|30|`] = { days: 30, total: 2, entries: [{ companyName: "TESTFIRMA A/S", type: "status", text: "Status ændret", at: "2025-05-01T10:00:00Z", source: "CVR", read: false }] };
  assert.match(answer("Har der været fusioner?"), /Fusioner og spaltninger: fusion 01\.01\.2024: A ApS → B A\/S/);
  assert.match(answer("Hvilke meddelelser er der i Statstidende?"), /Statstidende: 1 meddelelse \(01\.03\.2025 Rekonstruktion\)/);
  assert.match(answer("Vis de offentliggjorte dokumenter", "dokumenter"), /Offentliggjorte regnskaber: 1 \(årsrapport 2025\)/);
  assert.match(answer("Vis dem på et kort"), /Placering: 1 adresse på kortet, 1 uden koordinater/);
  assert.match(answer("Hvad er der sket de sidste 30 dage?"), /Ændringer seneste 30 dage: 2 \(Status ændret\)/);

  // Personen: antal roller.
  const pid = "CVR-3-4000000001";
  ds.persons[pid] = {
    lassoId: pid,
    name: "Mette Holm",
    roles: [
      { companyId: "CVR-1-1", companyName: "Et ApS", role: "Direktør", kind: "direction", active: true },
      { companyId: "CVR-1-2", companyName: "To ApS", role: "Bestyrelsesmedlem", kind: "board", active: false },
    ] as never,
  };
  const pspec = composePerson(pid, ds, { focus: "overblik" });
  const pask = parseAsk("Hvor mange roller har hun?", "person", { name: "Mette Holm" });
  assert.match(answerText(pspec, ds, pask) ?? "", /Roller: 2 selskaber, heraf 1 aktive og 1 ophørte; konkurser 0, tvangsopløsninger 0/);
});
